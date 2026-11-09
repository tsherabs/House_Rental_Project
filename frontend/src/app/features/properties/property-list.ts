import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  combineLatest,
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { PropertyService } from './property.service';
import { PropertyFilters, PropertyPage } from './property';
import { PropertyCard } from './property-card';

@Component({
  selector: 'app-property-list',
  imports: [ReactiveFormsModule, PropertyCard, RouterLink],
  styleUrl: './property-list.css',
  template: ` <header class="home-intro">
      <div class="intro-copy">
        <h1>A new chapter.<br /><em>A place to call home.</em></h1>
        <p>
          From quiet hillside apartments to a home near the heart of the city. Find your space in
          Thimphu.
        </p>
        <a class="button-link explore-link" routerLink="/properties" fragment="find-homes">
          Explore available homes
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          >
            <path d="M4 12h15m-6-6 6 6-6 6" />
          </svg>
        </a>
        <p class="intro-note">Local neighbourhoods. A place for your everyday.</p>
      </div>
      <figure class="city-portrait">
        <img
          src="/images/thimphu-central.jpg"
          alt="Real photograph of central Thimphu, with traditional rooftops and Tashichho Dzong against the green hillside"
          width="1440"
          height="960"
          fetchpriority="high"
        />
        <figcaption>
          <span>Thimphu, from a different perspective.</span
          ><a href="/photo-credits.html">Photograph: Christopher J. Fynn · 2019</a>
        </figcaption>
      </figure>
    </header>
    <div class="section-heading" id="find-homes">
      <div>
        <h2>Homes worth coming home to.</h2>
      </div>
      <span>Thimphu, Bhutan</span>
    </div>
    <form [formGroup]="form" (ngSubmit)="apply()" class="filters" aria-label="Filter properties">
      <label
        >Neighbourhood<input
          formControlName="neighbourhood"
          maxlength="100"
          placeholder="Search neighbourhood"
      /></label>
      <label
        >Minimum rent (Nu.)<input type="number" formControlName="minRent" min="0" step="0.01"
      /></label>
      <label
        >Maximum rent (Nu.)<input type="number" formControlName="maxRent" min="0" step="0.01"
      /></label>
      <label
        >Bedrooms<input type="number" formControlName="bedrooms" min="0" max="20" step="1"
      /></label>
      <label>Move in by<input type="date" formControlName="availableFrom" /></label>
      <label
        >Sort by<select formControlName="sort">
          <option value="recent">Most recent</option>
          <option value="rent_asc">Rent: low to high</option>
          <option value="rent_desc">Rent: high to low</option>
        </select></label
      >
      <label class="check"
        ><input type="checkbox" formControlName="waterAvailable" /> Water available</label
      >
      <label class="check"
        ><input type="checkbox" formControlName="parkingAvailable" /> Parking available</label
      >
      <div class="filter-actions">
        <button type="submit">Find homes</button
        ><button type="button" class="secondary" (click)="reset()">Clear filters</button>
      </div>
      @if (invalid()) {
        <p role="alert">
          Enter nonnegative rents, minimum no greater than maximum, and a whole bedroom count from 0
          to 20.
        </p>
      }
    </form>
    @if (loading()) {
      <div role="status" class="search-loading">
        <span class="loading-dot" aria-hidden="true"></span>Loading homes…
      </div>
      <div class="listing-skeletons" aria-hidden="true">
        <div></div>
        <div></div>
        <div></div>
      </div>
    }
    @if (error()) {
      <div role="alert">
        <p>{{ error() }}</p>
        <button (click)="retry()">Try again</button>
      </div>
    }
    @if (result(); as page) {
      <p role="status">
        {{ page.pagination.total }} {{ page.pagination.total === 1 ? 'home' : 'homes' }} found
      </p>
      <section class="property-grid" aria-label="Rental homes">
        @for (property of page.data; track property.id) {
          <app-property-card [property]="property" [query]="query" />
        }
      </section>
      @if (!page.data.length) {
        <div class="empty-state">
          <h2>A different search could open a door.</h2>
          <p>No homes match these filters. Try a wider rent range or another neighbourhood.</p>
          <button class="secondary" (click)="reset()">Clear filters</button>
        </div>
      }
      @if (page.pagination.totalPages > 1) {
        <nav class="pagination" aria-label="Results pages">
          <button [disabled]="page.pagination.page <= 1" (click)="go(page.pagination.page - 1)">
            Previous
          </button>
          <span>Page {{ page.pagination.page }} of {{ page.pagination.totalPages }}</span>
          <button
            [disabled]="page.pagination.page >= page.pagination.totalPages"
            (click)="go(page.pagination.page + 1)"
          >
            Next
          </button>
        </nav>
      }
    }
    <section class="place-story" aria-labelledby="place-story-title">
      <figure>
        <img
          src="/images/thimphu-valley.jpg"
          alt="Thimphu valley framed by pine trees, with clouds resting on the surrounding mountains"
          width="1440"
          height="1080"
          loading="lazy"
          decoding="async"
        />
        <figcaption>
          Thimphu valley, July 2016. <a href="/photo-credits.html">Photo: Afifa Afrin</a>
        </figcaption>
      </figure>
      <div class="place-story-copy">
        <h2 id="place-story-title">The neighbourhood is part of the home.</h2>
        <p>A familiar route to work. A view you stop to look at. Space for the way you live.</p>
        <p>
          Start with your budget and location, compare the homes you like, then arrange a viewing to
          see how a place feels in person.
        </p>
        <a class="text-link" routerLink="/compare"
          >Compare your shortlist <span aria-hidden="true">→</span></a
        >
        <p class="photo-context">
          City photography gives a sense of place. Listing photos are supplied by landlords.
        </p>
      </div>
    </section>`,
})
export class PropertyList {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PropertyService);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new BehaviorSubject(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly invalid = signal(false);
  readonly result = signal<PropertyPage | null>(null);
  query: Record<string, string> = {};
  readonly form = inject(FormBuilder).nonNullable.group({
    neighbourhood: [''],
    minRent: ['', Validators.min(0)],
    maxRent: ['', Validators.min(0)],
    bedrooms: ['', [Validators.min(0), Validators.max(20)]],
    availableFrom: [''],
    sort: ['recent'],
    waterAvailable: [false],
    parkingAvailable: [false],
  });
  constructor() {
    this.form.controls.neighbourhood.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroy))
      .subscribe(() => this.apply());
    combineLatest([this.route.queryParamMap, this.reload])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.result.set(null);
        }),
        switchMap(([params]) => {
          this.query = Object.fromEntries(params.keys.map((key) => [key, params.get(key)!]));
          const number = (key: string, fallback: number) => {
            const value = Number(params.get(key));
            return Number.isInteger(value) && value >= 1 ? value : fallback;
          };
          const sort = params.get('sort');
          const filters: PropertyFilters = {
            sort: sort === 'rent_asc' || sort === 'rent_desc' ? sort : 'recent',
            page: number('page', 1),
            limit: Math.min(number('limit', 12), 50),
          };
          this.form.reset(
            {
              neighbourhood: params.get('neighbourhood') ?? '',
              minRent: params.get('minRent') ?? '',
              maxRent: params.get('maxRent') ?? '',
              bedrooms: params.get('bedrooms') ?? '',
              availableFrom: params.get('availableFrom') ?? '',
              sort: filters.sort,
              waterAvailable: params.get('waterAvailable') === 'true',
              parkingAvailable: params.get('parkingAvailable') === 'true',
            },
            { emitEvent: false },
          );
          if (!this.valid()) {
            this.loading.set(false);
            return of(null);
          }
          const value = this.form.getRawValue();
          Object.assign(filters, {
            minRent: value.minRent === '' ? undefined : String(value.minRent),
            maxRent: value.maxRent === '' ? undefined : String(value.maxRent),
            bedrooms: value.bedrooms === '' ? undefined : Number(value.bedrooms),
            neighbourhood: value.neighbourhood.trim() || undefined,
            availableFrom: value.availableFrom || undefined,
          });
          for (const key of ['waterAvailable', 'parkingAvailable'] as const) {
            if (params.get(key) === 'true' || params.get(key) === 'false')
              filters[key] = params.get(key) === 'true';
          }
          return this.api.list(filters).pipe(
            catchError(() => {
              this.error.set('Unable to load homes. Please try again.');
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((page) => {
        this.loading.set(false);
        if (
          page &&
          page.pagination.totalPages > 0 &&
          page.pagination.page > page.pagination.totalPages
        ) {
          this.go(page.pagination.totalPages);
          return;
        }
        this.result.set(page);
      });
  }
  private valid() {
    const v = this.form.getRawValue();
    const valid =
      this.form.valid &&
      [v.minRent, v.maxRent].every(
        (value) => value === '' || /^\d+(\.\d{1,2})?$/.test(String(value)),
      ) &&
      (v.bedrooms === '' || Number.isInteger(Number(v.bedrooms))) &&
      (v.minRent === '' || v.maxRent === '' || Number(v.minRent) <= Number(v.maxRent));
    this.invalid.set(!valid);
    return valid;
  }
  apply() {
    if (!this.valid()) return;
    const value = this.form.getRawValue();
    const query: Record<string, unknown> = { page: 1, limit: this.query['limit'] || 12 };
    for (const [key, val] of Object.entries(value))
      if (val !== '' && val !== false) query[key] = val;
    void this.router.navigate(['/properties'], { queryParams: query });
  }
  reset() {
    void this.router.navigate(['/properties']);
  }
  go(page: number) {
    void this.router.navigate(['/properties'], { queryParams: { ...this.query, page } });
  }
  retry() {
    this.reload.next(this.reload.value + 1);
  }
}
