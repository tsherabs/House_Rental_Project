import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, catchError, finalize, of, switchMap, tap } from 'rxjs';
import { Failure, failureFrom } from '../../core/api';
import { Property, PropertyPage } from '../properties/property';
import { LandlordService } from './landlord.service';
import { Pagination } from '../../shared/pagination';

@Component({
  selector: 'app-landlord-dashboard',
  imports: [RouterLink, CurrencyPipe, Pagination],
  styleUrl: './landlord.css',
  template: ` <header>
      <p class="eyebrow">LANDLORD WORKSPACE</p>
      <h1>My properties</h1>
      <a routerLink="/my-properties/new">Add a property</a>
    </header>
    @if (loading()) {
      <p role="status">Loading your properties…</p>
    }
    @if (failure(); as error) {
      <p role="alert">{{ error.message }}</p>
      <button (click)="reload()">Refresh properties</button>
    }
    @if (notice()) {
      <p role="status">{{ notice() }}</p>
    }
    @if (result(); as page) {
      <p>{{ page.pagination.total }} properties</p>
      <section class="property-grid" aria-label="Your properties">
        @for (property of page.data; track property.id) {
          <article class="card card-body">
            <h2>{{ property.title }}</h2>
            <p>{{ property.neighbourhood }}</p>
            <strong>{{ property.monthlyRent | currency: 'BTN' : 'Nu. ' : '1.2-2' }} / month</strong>
            <p>
              Rental: <span class="badge">{{ property.availabilityStatus }}</span>
            </p>
            <p>Visibility: {{ property.visibilityStatus }}</p>
            @if (property.visibilityStatus !== 'archived') {
              <div class="actions">
                <a [routerLink]="['/my-properties', property.id, 'edit']">Edit and photos</a>
                <button [disabled]="pending()" (click)="availability(property)">
                  {{
                    property.availabilityStatus === 'available' ? 'Mark rented' : 'Mark available'
                  }}
                </button>
                <button class="secondary" [disabled]="pending()" (click)="archive(property)">
                  Archive
                </button>
              </div>
            } @else {
              <p>Archived — retained for your records.</p>
            }
          </article>
        } @empty {
          <p>You have no properties yet. Add your first listing to get started.</p>
        }
      </section>
      <app-pagination [pagination]="page.pagination" [busy]="pending()" (pageChange)="go($event)" />
    }`,
})
export class LandlordDashboard {
  private readonly api = inject(LandlordService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly refresh = new BehaviorSubject(0);
  readonly result = signal<PropertyPage | null>(null);
  readonly loading = signal(true);
  readonly pending = signal(false);
  readonly failure = signal<Failure | null>(null);
  readonly notice = signal('');
  constructor() {
    combineLatest([this.route.queryParamMap, this.refresh])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.failure.set(null);
          this.result.set(null);
        }),
        switchMap(([params]) => {
          const n = Number(params.get('page'));
          return this.api.list(Number.isInteger(n) && n > 0 && n <= 1000000 ? n : 1).pipe(
            catchError((error) => {
              this.failure.set(failureFrom(error));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
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
  reload() {
    this.refresh.next(this.refresh.value + 1);
  }
  go(page: number) {
    void this.router.navigate(['/my-properties'], { queryParams: { page } });
  }
  availability(property: Property) {
    if (this.pending()) return;
    const status = property.availabilityStatus === 'available' ? 'rented' : 'available';
    if (
      !window.confirm(
        status === 'rented'
          ? 'Mark this property rented? It will leave public search and stop new viewing requests.'
          : 'Mark this property available? Visibility and expiry restrictions still apply.',
      )
    )
      return;
    this.pending.set(true);
    this.failure.set(null);
    this.notice.set('');
    this.api
      .availability(property.id, status)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.notice.set(`Property marked ${status}.`);
          this.reload();
        },
        error: (error) => this.failure.set(failureFrom(error)),
      });
  }
  archive(property: Property) {
    if (
      this.pending() ||
      !window.confirm(
        `Archive “${property.title}”? It will no longer be editable or publicly listed.`,
      )
    )
      return;
    this.pending.set(true);
    this.failure.set(null);
    this.notice.set('');
    this.api
      .archive(property.id)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.notice.set('Property archived.');
          this.reload();
        },
        error: (error) => this.failure.set(failureFrom(error)),
      });
  }
}
