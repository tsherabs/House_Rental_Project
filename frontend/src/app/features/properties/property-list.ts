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
  template: ` <header class="browse-hero">
      <div class="hero-copy">
        <p class="eyebrow">ROOTED IN THIMPHU. MADE FOR YOU.</p>
        <h1>A new chapter.<br /><em>A place to call home.</em></h1>
        <p>
          From quiet hillside apartments to a home near the heart of the city. Find your space in
          Thimphu.
        </p>
        <a class="button-link" routerLink="/properties" fragment="find-homes"
          >Explore available homes <span aria-hidden="true">↗</span></a
        >
        <div class="hero-notes">
          <span>Local neighbourhoods</span><span>Viewings made simple</span>
        </div>
      </div>
      <figure class="hero-photo">
        <img
          src="/images/thimphu-home.webp"
          alt="Illustration of a Bhutanese home overlooking a green mountain valley"
          fetchpriority="high"
          width="1440"
          height="960"
        />
        <figcaption>At home in the valley <small>Illustrative image</small></figcaption>
      </figure>
    </header>
    <div class="section-heading" id="find-homes">
      <div>
        <p class="eyebrow">FIND YOUR CORNER OF THE CITY</p>
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
      <button type="submit">Apply filters</button
      ><button type="button" class="secondary" (click)="reset()">Reset</button>
      @if (invalid()) {
        <p role="alert">
          Enter nonnegative rents, minimum no greater than maximum, and a whole bedroom count from 0
          to 20.
        </p>
      }
    </form>
    @if (loading()) {
      <p role="status">Loading homes…</p>
    }
    @if (error()) {
      <div role="alert">
        <p>{{ error() }}</p>
        <button (click)="retry()">Try again</button>
      </div>
    }
    @if (result(); as page) {
      <p role="status">{{ page.pagination.total }} homes found</p>
      <section class="property-grid" aria-label="Rental homes">
        @for (property of page.data; track property.id) {
          <app-property-card [property]="property" [query]="query" />
        }
      </section>
      @if (!page.data.length) {
        <p>No homes match these filters. Try a wider rent range or another neighbourhood.</p>
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
    }`,
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
