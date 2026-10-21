import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { Page, failureFrom } from '../../core/api';
import { Pagination } from '../../shared/pagination';
import { CommunityService, Report } from './community.service';
@Component({
  imports: [ReactiveFormsModule, DatePipe, Pagination],
  template: ` <header>
      <p class="eyebrow">ADMINISTRATION</p>
      <h1>Listing reports</h1>
      <p>Review concerns, record your decision and manage listing visibility.</p>
    </header>
    <label class="compact-field"
      >Review status<select [value]="filter" (change)="setFilter($event)" [disabled]="busy()">
        <option value="pending">Pending</option>
        <option value="actioned">Actioned</option>
        <option value="dismissed">Dismissed</option>
        <option value="">All reports</option>
      </select></label
    >
    @if (busy()) {
      <p role="status">Updating reports…</p>
    }
    @if (notice()) {
      <p role="status">{{ notice() }}</p>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button [disabled]="busy()" (click)="load()">Refresh reports</button>
    }
    @if (page(); as result) {
      <section class="workflow-list">
        @for (r of result.data; track r.id) {
          <article class="card card-body">
            <div class="row-between">
              <h2>{{ r.propertyTitle }}</h2>
              <span class="badge">{{ r.reviewStatus }}</span>
            </div>
            <p class="description">{{ r.reason }}</p>
            <small
              >{{ r.createdAt | date: 'd MMM y, h:mm a' : '+0600' }} · Listing
              {{ r.visibilityStatus }}</small
            >
            @if (r.reviewReason) {
              <p>Review: {{ r.reviewReason }}</p>
            }
            <p>
              <button class="secondary" [disabled]="busy()" (click)="select(r)">
                Review / manage visibility
              </button>
            </p>
            @if (selected() === r.id) {
              <form class="stack" [formGroup]="form">
                <label
                  >Reason for this action<textarea
                    formControlName="reason"
                    minlength="10"
                    maxlength="1000"
                    rows="3"
                    required
                  ></textarea>
                </label>
                <small
                  >10–1,000 characters. Reviewing a report and changing visibility are separate
                  actions.</small
                >
                <div class="actions">
                  @if (r.reviewStatus === 'pending') {
                    <button
                      type="button"
                      [disabled]="busy() || form.invalid"
                      (click)="review(r, 'actioned')"
                    >
                      Mark actioned
                    </button>
                    <button
                      type="button"
                      class="secondary"
                      [disabled]="busy() || form.invalid"
                      (click)="review(r, 'dismissed')"
                    >
                      Dismiss report
                    </button>
                  }
                  @if (r.visibilityStatus !== 'archived') {
                    <button
                      type="button"
                      class="secondary"
                      [disabled]="busy() || form.invalid"
                      (click)="visibility(r)"
                    >
                      {{ r.visibilityStatus === 'hidden' ? 'Unhide listing' : 'Hide listing' }}
                    </button>
                  }
                </div>
              </form>
            }
          </article>
        } @empty {
          <div class="empty-state">
            <h2>All clear</h2>
            <p>No reports match this filter.</p>
          </div>
        }
      </section>
      <app-pagination
        [pagination]="result.pagination"
        [busy]="busy()"
        (pageChange)="load($event)"
      />
    }`,
})
export class ReportsPage {
  private readonly api = inject(CommunityService);
  private readonly destroy = inject(DestroyRef);
  readonly form = inject(FormBuilder).nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
  });
  readonly page = signal<Page<Report> | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly selected = signal('');
  filter = 'pending';
  constructor() {
    this.load();
  }
  setFilter(event: Event) {
    this.filter = (event.target as HTMLSelectElement).value;
    this.selected.set('');
    this.load(1);
  }
  select(r: Report) {
    this.selected.set(r.id);
    this.form.reset();
  }
  load(number = this.page()?.pagination.page ?? 1) {
    this.busy.set(true);
    this.error.set('');
    this.api
      .reports(this.filter, number)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (p) => {
          this.busy.set(false);
          if (!p.data.length && number > 1) this.load(number - 1);
          else this.page.set(p);
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(failureFrom(e).message);
        },
      });
  }
  private run(action: Observable<unknown>, message: string) {
    if (this.busy() || this.form.invalid || this.form.controls.reason.value.trim().length < 10)
      return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    action.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(message);
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(failureFrom(e).message);
      },
    });
  }
  review(r: Report, status: 'dismissed' | 'actioned') {
    this.run(
      this.api.review(r.id, status, this.form.controls.reason.value.trim()),
      'Review recorded.',
    );
  }
  visibility(r: Report) {
    const status = r.visibilityStatus === 'hidden' ? 'published' : 'hidden';
    if (
      window.confirm(
        status === 'hidden'
          ? 'Hide this listing from public search?'
          : 'Unhide this listing? Rental and expiry restrictions still apply.',
      )
    )
      this.run(
        this.api.visibility(r.propertyId, status, this.form.controls.reason.value.trim()),
        'Listing visibility updated.',
      );
  }
}
