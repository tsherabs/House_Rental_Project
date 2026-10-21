import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Page, failureFrom } from '../../core/api';
import { Pagination } from '../../shared/pagination';
import { PropertyCard } from '../properties/property-card';
import { CommunityService, Favourite } from './community.service';
@Component({
  imports: [RouterLink, Pagination, PropertyCard],
  template: ` <header>
      <p class="eyebrow">YOUR SHORTLIST</p>
      <h1>Homes to come back to.</h1>
      <p>Keep the places you love together while you decide.</p>
    </header>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button (click)="load()" [disabled]="busy()">Try again</button>
    }
    @if (busy()) {
      <p role="status">Updating favourites…</p>
    }
    @if (page(); as result) {
      <section class="property-grid">
        @for (f of result.data; track f.propertyId) {
          <div class="saved-home">
            @if (f.property; as home) {
              <app-property-card [property]="home" />
            } @else {
              <article class="card card-body">
                <h2>Home currently unavailable</h2>
                <p>
                  This saved listing is no longer publicly available. You can keep or remove it.
                </p>
              </article>
            }
            <button class="secondary" [disabled]="busy()" (click)="remove(f.propertyId)">
              Remove from favourites
            </button>
          </div>
        } @empty {
          <div class="empty-state">
            <h2>Your shortlist starts here</h2>
            <a routerLink="/properties">Explore homes →</a>
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
export class FavouritesPage {
  private readonly api = inject(CommunityService);
  private readonly destroy = inject(DestroyRef);
  readonly page = signal<Page<Favourite> | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  constructor() {
    this.load();
  }
  load(number = this.page()?.pagination.page ?? 1) {
    this.busy.set(true);
    this.error.set('');
    this.api
      .favourites(number)
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
  remove(id: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .remove(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.load();
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(failureFrom(e).message);
        },
      });
  }
}
