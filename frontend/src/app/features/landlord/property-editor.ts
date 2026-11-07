import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, catchError, finalize, of, switchMap, tap } from 'rxjs';
import { Failure, failureFrom } from '../../core/api';
import { FormFeedback } from '../../shared/form-feedback';
import { Property } from '../properties/property';
import { LandlordService, PropertyInput } from './landlord.service';
import { PropertyPhotos } from './property-photos';

const trimmedLength =
  (min: number, max: number): ValidatorFn =>
  (control) => {
    const length = String(control.value ?? '').trim().length;
    return length >= min && length <= max ? null : { trimmedLength: { min, max } };
  };
export const moneyValidator: ValidatorFn = (control) =>
  /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(String(control.value ?? '')) ? null : { money: true };
export const calendarDate: ValidatorFn = (control) => {
  const value = String(control.value ?? '');
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !value.startsWith('0000') &&
    !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value
    ? null
    : { calendarDate: true };
};
@Component({
  selector: 'app-property-editor',
  imports: [ReactiveFormsModule, RouterLink, FormFeedback, PropertyPhotos],
  styleUrl: './landlord.css',
  template: ` <section class="editor">
    <a routerLink="/my-properties">← My properties</a>
    <header class="editor-heading">
      <h1>{{ id ? 'Edit property' : 'Add a property' }}</h1>
      <p>
        {{
          id
            ? 'Keep your details and photos up to date for home seekers.'
            : 'Add your rental in two simple steps. All fields are required unless marked optional.'
        }}
      </p>
    </header>
    <ol class="listing-steps" aria-label="Listing progress">
      <li [class.complete]="property()">
        <span>1</span>
        <div>
          <strong>Property details</strong
          ><small>{{
            property() ? 'Saved to your account' : 'Describe your home and publish'
          }}</small>
        </div>
      </li>
      <li [class.complete]="property()?.images?.length">
        <span>2</span>
        <div>
          <strong>Add photos</strong
          ><small>{{ property() ? 'Ready to upload below' : 'Available after you save' }}</small>
        </div>
      </li>
    </ol>
    @if (loading()) {
      <p role="status">Loading property…</p>
    }
    @if (loadFailure(); as error) {
      <p role="alert">{{ error.message }}</p>
      <button (click)="reload()">Retry</button>
    }
    @if (!loading() && !loadFailure()) {
      @if (notice()) {
        <p role="status" class="saved">{{ notice() }}</p>
      }
      @if (property()?.visibilityStatus === 'hidden') {
        <p>This listing is hidden. Editing does not restore public visibility.</p>
      }
      @if (archived()) {
        <p>This property is archived and cannot be edited.</p>
      }
      <div class="editor-layout">
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="editor-feedback" tabindex="-1">
            @if (submittedInvalid()) {
              <p role="alert">
                Your changes have not been saved. Check the fields below, then save again.
              </p>
            }
            <app-form-feedback [form]="form" [failure]="failure()" [labels]="labels" />
          </div>
          <fieldset [disabled]="pending() || archived()">
            <legend>Tell us about your home</legend>
            <label
              >Property title<input
                placeholder="e.g. Sunny two-bedroom home in Taba"
                formControlName="title"
                maxlength="160"
                [attr.aria-invalid]="invalid('title')"
              /><small>5–160 characters. Include what makes the home special.</small></label
            >
            <label
              >Description<textarea
                placeholder="Describe the rooms, natural light, access and anything a tenant should know."
                formControlName="description"
                maxlength="5000"
                [attr.aria-invalid]="invalid('description')"
              ></textarea
              ><small>At least 20 characters. A little detail helps tenants decide.</small>
            </label>
          </fieldset>
          <fieldset [disabled]="pending() || archived()">
            <legend>Rent &amp; deposit</legend>
            <div class="fields">
              <label
                >Monthly rent (Nu.)<input
                  formControlName="monthlyRent"
                  inputmode="decimal"
                  placeholder="18000.00"
                  [attr.aria-invalid]="invalid('monthlyRent')"
              /></label>
              <label
                >Deposit (Nu.)<input
                  formControlName="deposit"
                  inputmode="decimal"
                  placeholder="18000.00"
                  [attr.aria-invalid]="invalid('deposit')"
              /></label>
            </div>
            <p class="field-hint">
              Enter amounts without commas, for example 18000 or 18000.50. Enter 0 if there is no
              deposit.
            </p>
          </fieldset>
          <fieldset [disabled]="pending() || archived()">
            <legend>Location &amp; essentials</legend>
            <div class="fields">
              <label
                >Bedrooms (0–20)<input
                  formControlName="bedrooms"
                  type="number"
                  min="0"
                  max="20"
                  step="1"
                  [attr.aria-invalid]="invalid('bedrooms')"
              /></label>
              <label
                >Neighbourhood<input
                  formControlName="neighbourhood"
                  maxlength="100"
                  placeholder="e.g. Changzamtog"
                  [attr.aria-invalid]="invalid('neighbourhood')"
              /></label>
            </div>
            <label
              >Landmarks (optional)<textarea formControlName="landmarks" maxlength="500"></textarea>
            </label>
            <label
              >Move-in date<input
                formControlName="moveInDate"
                type="date"
                [attr.aria-invalid]="invalid('moveInDate')"
            /></label>
            <label class="check"
              ><input type="checkbox" formControlName="waterAvailable" /> Water available</label
            >
            <label class="check"
              ><input type="checkbox" formControlName="parkingAvailable" /> Parking available</label
            >
            <p class="field-hint">
              {{
                property()
                  ? 'Changes are saved when you select Save changes.'
                  : 'Publishing makes this home visible to seekers. You can add photos immediately afterwards.'
              }}
            </p>
            @if (submittedInvalid()) {
              <p role="alert">Some details need attention. Check the highlighted fields above.</p>
            }
            @if (failure(); as error) {
              <p role="alert">
                {{ error.message }} Your entries are still here so you can try again.
              </p>
            }
            <div class="actions editor-actions">
              <button type="submit" [disabled]="pending() || archived()">
                {{
                  pending() ? 'Saving…' : id ? 'Save changes' : 'Publish property & add photos'
                }}</button
              ><a routerLink="/my-properties">Back to dashboard</a>
            </div>
          </fieldset>
        </form>
        <aside class="listing-guide">
          <img
            src="/images/valley-living-room.webp"
            alt="Illustrative Bhutanese living room with a mountain view"
            width="1440"
            height="960"
          />
          <div>
            <small>AI-generated inspiration · not a listing</small>
            <h2>Help someone picture life here.</h2>
            <p>Clear details make a confident first impression.</p>
            <ul>
              <li>Explain what the monthly rent includes.</li>
              <li>Mention nearby roads and familiar landmarks.</li>
              <li>Add bright, recent photos of the actual home after saving.</li>
            </ul>
            <p class="guide-note">
              Your photos are separate from your property details. A photo upload problem does not
              undo a saved listing.
            </p>
          </div>
        </aside>
      </div>
      @if (property(); as home) {
        <div id="property-photos" class="photo-step">
          <app-property-photos
            [propertyId]="home.id"
            [images]="home.images"
            [disabled]="archived() || pending()"
            (imagesChange)="photosChanged($event)"
          />
          <a class="button-link" routerLink="/my-properties">Done — go to my properties</a>
        </div>
      } @else {
        <div class="photo-step photo-step-locked">
          <h2>Next: show your home</h2>
          <p>
            Publish the property above to unlock photo uploads. Add up to 8 photos of the actual
            rental.
          </p>
        </div>
      }
    }
  </section>`,
})
export class PropertyEditor {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly submittedInvalid = signal(false);
  private readonly api = inject(LandlordService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly refresh = new BehaviorSubject(0);
  id: string | null = null;
  readonly property = signal<Property | null>(null);
  readonly loading = signal(false);
  readonly pending = signal(false);
  readonly loadFailure = signal<Failure | null>(null);
  readonly failure = signal<Failure | null>(null);
  readonly notice = signal(
    this.route.snapshot.queryParamMap.get('created') === 'true'
      ? 'Property saved. Your listing is in My properties. Add photos below.'
      : '',
  );
  readonly labels = {
    title: 'Title (5–160 characters)',
    description: 'Description (20–5000 characters)',
    monthlyRent: 'Monthly rent',
    deposit: 'Deposit',
    bedrooms: 'Bedrooms (whole number, 0–20)',
    neighbourhood: 'Neighbourhood (2–100 characters)',
    landmarks: 'Landmarks',
    moveInDate: 'Move-in date',
  };
  readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', [Validators.required, trimmedLength(5, 160)]],
    description: ['', [Validators.required, trimmedLength(20, 5000)]],
    monthlyRent: ['', [Validators.required, moneyValidator]],
    deposit: ['', [Validators.required, moneyValidator]],
    bedrooms: [
      0,
      [
        Validators.required,
        Validators.min(0),
        Validators.max(20),
        ((c) => (Number.isInteger(c.value) ? null : { integer: true })) as ValidatorFn,
      ],
    ],
    neighbourhood: ['', [Validators.required, trimmedLength(2, 100)]],
    landmarks: ['', Validators.maxLength(500)],
    waterAvailable: [false],
    parkingAvailable: [false],
    moveInDate: ['', [Validators.required, calendarDate]],
  });
  constructor() {
    combineLatest([this.route.paramMap, this.refresh])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.loadFailure.set(null);
        }),
        switchMap(([params]) => {
          this.id = params.get('id');
          return this.id
            ? this.api.get(this.id).pipe(
                catchError((error) => {
                  this.loadFailure.set(failureFrom(error));
                  return of(null);
                }),
              )
            : of(null);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        this.loading.set(false);
        this.property.set(response?.property ?? null);
        if (response) {
          const home = response.property;
          this.form.reset({
            title: home.title,
            description: home.description,
            monthlyRent: home.monthlyRent,
            deposit: home.deposit,
            bedrooms: home.bedrooms,
            neighbourhood: home.neighbourhood,
            landmarks: home.landmarks ?? '',
            waterAvailable: home.waterAvailable,
            parkingAvailable: home.parkingAvailable,
            moveInDate: home.moveInDate,
          });
        }
      });
  }
  archived() {
    return this.property()?.visibilityStatus === 'archived';
  }
  reload() {
    this.refresh.next(this.refresh.value + 1);
  }
  invalid(name: keyof typeof this.form.controls) {
    return this.form.controls[name].touched && this.form.controls[name].invalid;
  }
  photosChanged(images: Property['images']) {
    this.property.update((home) => (home ? { ...home, images } : null));
  }
  private focusFeedback() {
    const feedback = this.element.nativeElement.querySelector<HTMLElement>('.editor-feedback');
    feedback?.focus();
    feedback?.scrollIntoView?.({ block: 'start' });
  }
  save() {
    if (this.pending() || this.archived() || this.loading() || this.loadFailure()) return;
    this.form.markAllAsTouched();
    this.submittedInvalid.set(this.form.invalid);
    if (this.form.invalid) {
      this.focusFeedback();
      return;
    }
    const value = this.form.getRawValue();
    const body: PropertyInput = {
      ...value,
      title: value.title.trim(),
      description: value.description.trim(),
      neighbourhood: value.neighbourhood.trim(),
      landmarks: value.landmarks.trim() || null,
    };
    this.pending.set(true);
    this.failure.set(null);
    this.notice.set('');
    (this.id ? this.api.update(this.id, body) : this.api.create(body))
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: (response) => {
          this.property.set(response.property);
          this.form.markAsPristine();
          const created = !this.id;
          // Record the persisted ID immediately: a second click must PATCH, never POST again.
          this.id = response.property.id;
          this.notice.set(
            'Property saved. Your listing is in My properties. Add or manage photos below.',
          );
          if (created)
            void this.router.navigate(['/my-properties', response.property.id, 'edit'], {
              queryParams: { created: 'true' },
              fragment: 'property-photos',
              replaceUrl: true,
            });
        },
        error: (error) => {
          this.failure.set(failureFrom(error));
          this.focusFeedback();
        },
      });
  }
}
