import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, catchError, of, switchMap, tap } from 'rxjs';
import { PropertyService } from './property.service';
import { Property } from './property';
import { PropertyActions } from '../community/property-actions';

@Component({
  selector: 'app-property-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, PropertyActions],
  template: ` <a routerLink="/properties" [queryParams]="route.snapshot.queryParams"
      >← Back to homes</a
    >
    @if (loading()) {
      <p role="status">Loading property…</p>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button (click)="retry()">Try again</button>
    }
    @if (property(); as home) {
      <header>
        <p class="eyebrow">{{ home.neighbourhood }}</p>
        <h1>{{ home.title }}</h1>
        <span class="badge">{{ home.availabilityStatus }}</span>
      </header>
      <section class="gallery" aria-label="Property photos">
        @for (photo of home.images; track photo.id; let i = $index) {
          <img
            [src]="photo.url"
            [alt]="home.title + ' — photo ' + (i + 1)"
            (error)="broken($event)"
          />
        } @empty {
          <p class="no-photo">No photos available for this home.</p>
        }
      </section>
      <section class="details">
        <div>
          <h2>About this home</h2>
          <p class="description">{{ home.description }}</p>
          <h2>Facilities and location</h2>
          <dl>
            <dt>Bedrooms</dt>
            <dd>{{ home.bedrooms }}</dd>
            <dt>Water</dt>
            <dd>{{ home.waterAvailable ? 'Available' : 'Not available' }}</dd>
            <dt>Parking</dt>
            <dd>{{ home.parkingAvailable ? 'Available' : 'Not available' }}</dd>
            <dt>Neighbourhood</dt>
            <dd>{{ home.neighbourhood }}</dd>
            @if (home.landmarks) {
              <dt>Landmarks</dt>
              <dd>{{ home.landmarks }}</dd>
            }
            <dt>Move-in date</dt>
            <dd>{{ home.moveInDate | date: 'longDate' : '+0600' }}</dd>
          </dl>
        </div>
        <aside class="card card-body">
          <h2>Rental costs</h2>
          <p>Monthly rent</p>
          <strong>{{ home.monthlyRent | currency: 'BTN' : 'Nu. ' : '1.2-2' }}</strong>
          <p>Deposit: {{ home.deposit | currency: 'BTN' : 'Nu. ' : '1.2-2' }}</p>
          <hr />
          <app-property-actions [propertyId]="home.id" />
        </aside>
      </section>
    }`,
})
export class PropertyDetail {
  readonly route = inject(ActivatedRoute);
  private readonly api = inject(PropertyService);
  private readonly reload = new BehaviorSubject(0);
  readonly property = signal<Property | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() {
    combineLatest([this.route.paramMap, this.reload])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.property.set(null);
        }),
        switchMap(([params]) =>
          this.api.detail(params.get('id') ?? '').pipe(
            catchError((error) => {
              this.error.set(
                error.status === 404
                  ? 'This property is no longer available.'
                  : 'Unable to load this property. Please try again.',
              );
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        this.loading.set(false);
        this.property.set(
          response
            ? {
                ...response.property,
                images: [...response.property.images].sort(
                  (a, b) => a.displayOrder - b.displayOrder,
                ),
              }
            : null,
        );
      });
  }
  retry() {
    this.reload.next(this.reload.value + 1);
  }
  broken(event: Event) {
    const image = event.target as HTMLImageElement;
    image.alt = 'Photo unavailable';
  }
}
