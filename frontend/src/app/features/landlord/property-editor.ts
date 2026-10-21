import { Component, inject, signal } from '@angular/core';
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
    return length >= min && length <= max ? null : { trimmedLength: true };
  };
export const moneyValidator = Validators.pattern(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/);
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
    <h1>{{ id ? 'Edit property' : 'Add a property' }}</h1>
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
      <form [formGroup]="form" (ngSubmit)="save()">
        <app-form-feedback [form]="form" [failure]="failure()" [labels]="labels" />
        <fieldset [disabled]="pending() || archived()">
          <legend>Property information</legend>
          <label
            >Title (5–160 characters)<input
              formControlName="title"
              maxlength="160"
              [attr.aria-invalid]="invalid('title')"
          /></label>
          <label
            >Description (20–5000 characters)<textarea
              formControlName="description"
              maxlength="5000"
              [attr.aria-invalid]="invalid('description')"
            ></textarea>
          </label>
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
          <p>Enter nonnegative amounts with up to 10 whole digits and 2 decimal places.</p>
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
          <div class="actions">
            <button type="submit" [disabled]="pending() || archived()">
              {{ pending() ? 'Saving…' : id ? 'Save changes' : 'Create property' }}</button
            ><a routerLink="/my-properties">Back to dashboard</a>
          </div>
        </fieldset>
      </form>
      @if (property(); as home) {
        <app-property-photos
          [propertyId]="home.id"
          [images]="home.images"
          [disabled]="archived() || pending()"
          (imagesChange)="photosChanged($event)"
        />
      } @else {
        <p>Save the property first, then add up to 8 photos.</p>
      }
    }
  </section>`,
})
export class PropertyEditor {
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
  readonly notice = signal('');
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
  save() {
    if (this.pending() || this.archived() || this.loading() || this.loadFailure()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
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
          this.notice.set('Property saved. You can manage photos below.');
          if (!this.id) void this.router.navigate(['/my-properties', response.property.id, 'edit']);
        },
        error: (error) => this.failure.set(failureFrom(error)),
      });
  }
}
