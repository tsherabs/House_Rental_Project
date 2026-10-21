import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { failureFrom } from '../../core/api';
import { CommunityService } from './community.service';

@Component({
  selector: 'app-property-actions',
  imports: [ReactiveFormsModule, RouterLink],
  template: ` @if (notice()) {
      <p role="status">{{ notice() }}</p>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    @if (!auth.user()) {
      <p>Ready to see this home?</p>
      <a
        class="button-link"
        routerLink="/login"
        [queryParams]="{ returnUrl: '/properties/' + propertyId() }"
        >Sign in to request a viewing</a
      >
    }
    @if (auth.user()?.role === 'seeker') {
      <button class="secondary full-width" [disabled]="busy() || saved()" (click)="save()">
        {{ saved() ? '♥ Saved to favourites' : '♡ Save this home' }}
      </button>
      <h2>Come take a look</h2>
      <form class="stack" [formGroup]="viewing" (ngSubmit)="request()">
        <label
          >Preferred date and time<input
            type="datetime-local"
            formControlName="when"
            required
            aria-describedby="viewing-time-help"
        /></label>
        <small id="viewing-time-help"
          >Bhutan time (UTC+6). The landlord will confirm your request.</small
        >
        <label
          >Message (optional)<textarea
            formControlName="message"
            maxlength="1000"
            rows="3"
            placeholder="Introduce yourself or ask a question"
          ></textarea>
        </label>
        <button [disabled]="busy() || viewing.invalid">Request viewing</button>
      </form>
      <p><a routerLink="/viewings">View my requests →</a></p>
    }
    @if (auth.user()) {
      <details class="report-form">
        <summary>Report a problem with this listing</summary>
        <form class="stack" [formGroup]="reportForm" (ngSubmit)="report()">
          <label
            >What seems wrong?<textarea
              formControlName="reason"
              minlength="10"
              maxlength="1000"
              rows="3"
              required
            ></textarea>
          </label>
          <small>Please describe the issue in 10–1,000 characters.</small>
          <button class="secondary" [disabled]="busy() || reportForm.invalid">Send report</button>
        </form>
      </details>
    }`,
})
export class PropertyActions {
  readonly propertyId = input.required<string>();
  readonly auth = inject(AuthService);
  private readonly api = inject(CommunityService);
  private readonly destroy = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly viewing = this.fb.nonNullable.group({
    when: ['', Validators.required],
    message: ['', Validators.maxLength(1000)],
  });
  readonly reportForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
  });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly saved = signal(false);
  private run(action: Observable<unknown>, message: string, done: () => void = () => {}) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    action
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.notice.set(message);
          done();
        },
        error: (e) => this.error.set(failureFrom(e).message),
      });
  }
  save() {
    this.run(this.api.save(this.propertyId()), 'Home saved. Find it in your favourites.', () =>
      this.saved.set(true),
    );
  }
  request() {
    if (this.viewing.invalid) return;
    const value = this.viewing.getRawValue();
    const time = new Date(value.when + '+06:00');
    if (!Number.isFinite(time.getTime()) || time.getTime() <= Date.now()) {
      this.error.set('Choose a future date and time in Bhutan time.');
      return;
    }
    this.run(
      this.api.request(this.propertyId(), time.toISOString(), value.message.trim()),
      'Viewing requested. Follow its status in My viewings.',
      () => this.viewing.reset(),
    );
  }
  report() {
    const reason = this.reportForm.controls.reason.value.trim();
    if (reason.length < 10 || this.reportForm.invalid) {
      this.error.set('Describe the issue in at least 10 characters.');
      return;
    }
    this.run(
      this.api.report(this.propertyId(), reason),
      'Report sent for administrator review.',
      () => this.reportForm.reset(),
    );
  }
}
