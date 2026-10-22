import { Component, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import { ComparisonService } from './comparison.service';
import { PropertyService } from './property.service';
import { Property } from './property';
type Entry = { id: string; property: Property | null; error: string };
@Component({
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `<header>
      <p class="eyebrow">YOUR SHORTLIST</p>
      <h1>Find the right fit</h1>
      <p>Compare up to three homes side by side. Your selection is saved in this browser.</p>
      <div class="actions">
        <a routerLink="/properties" class="button-link">Choose homes</a>
        <button class="secondary" [disabled]="busy() || !compare.ids().length" (click)="refresh()">
          Refresh details
        </button>
      </div>
    </header>
    @if (busy()) {
      <p role="status">Checking current listing details…</p>
    }
    @if (!compare.ids().length) {
      <section class="empty-state">
        <h2>Your comparison starts here</h2>
        <p>
          Choose “Compare home” on a listing. Add two or three homes to compare their rent, deposit
          and facilities.
        </p>
      </section>
    }
    @for (entry of entries(); track entry.id) {
      @if (!entry.property) {
        <div class="card card-body">
          <p role="alert">{{ entry.error }}</p>
          <button (click)="compare.toggle(entry.id)">Remove unavailable selection</button>
        </div>
      }
    }
    @if (homes().length) {
      <p class="comparison-hint">
        On a small screen, scroll the comparison table sideways to see every home.
      </p>
      <div
        class="comparison-scroll"
        tabindex="0"
        role="region"
        aria-label="Home comparison table, scroll horizontally on small screens"
      >
        <table class="comparison-table">
          <caption>
            Current listing details — refresh before arranging a visit
          </caption>
          <thead>
            <tr>
              <th scope="col">Compare</th>
              @for (home of homes(); track home.id) {
                <th scope="col">
                  @if (home.images.length) {
                    <img [src]="home.images[0].url" [alt]="home.title" />
                  }
                  <a [routerLink]="['/properties', home.id]">{{ home.title }}</a>
                  <button
                    class="secondary"
                    [attr.aria-label]="'Remove ' + home.title + ' from comparison'"
                    (click)="compare.toggle(home.id)"
                  >
                    Remove
                  </button>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Monthly rent</th>
              @for (home of homes(); track home.id) {
                <td>{{ home.monthlyRent | currency: 'BTN' : 'Nu. ' : '1.2-2' }}</td>
              }
            </tr>
            <tr>
              <th scope="row">Deposit</th>
              @for (home of homes(); track home.id) {
                <td>{{ home.deposit | currency: 'BTN' : 'Nu. ' : '1.2-2' }}</td>
              }
            </tr>
            <tr>
              <th scope="row">Neighbourhood</th>
              @for (home of homes(); track home.id) {
                <td>{{ home.neighbourhood }}</td>
              }
            </tr>
            <tr>
              <th scope="row">Bedrooms</th>
              @for (home of homes(); track home.id) {
                <td>{{ home.bedrooms }}</td>
              }
            </tr>
            <tr>
              <th scope="row">Water</th>
              @for (home of homes(); track home.id) {
                <td>{{ home.waterAvailable ? 'Available' : 'Not available' }}</td>
              }
            </tr>
            <tr>
              <th scope="row">Parking</th>
              @for (home of homes(); track home.id) {
                <td>{{ home.parkingAvailable ? 'Available' : 'Not available' }}</td>
              }
            </tr>
            <tr>
              <th scope="row">Move-in date</th>
              @for (home of homes(); track home.id) {
                <td>{{ home.moveInDate | date: 'mediumDate' : '+0600' }}</td>
              }
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Open a home to estimate the full move-in budget or request a viewing. Availability can
        change.
      </p>
    }`,
})
export class ComparisonPage {
  readonly compare = inject(ComparisonService);
  private readonly api = inject(PropertyService);
  private readonly revision = signal(0);
  readonly busy = signal(false);
  readonly entries = signal<Entry[]>([]);
  readonly homes = computed(() =>
    this.entries().flatMap((entry) => (entry.property ? [entry.property] : [])),
  );
  constructor() {
    effect((cleanup) => {
      this.revision();
      const ids = this.compare.ids();
      this.entries.set([]);
      this.busy.set(ids.length > 0);
      if (!ids.length) return;
      const subscription = forkJoin(
        ids.map((id) =>
          this.api
            .detail(id)
            .pipe(
              catchError((error) =>
                of({
                  property: null,
                  error:
                    error.status === 404
                      ? 'A selected home is no longer available. Remove it and choose another.'
                      : 'Could not check a selected home. Refresh details to try again.',
                }),
              ),
            ),
        ),
      ).subscribe((results) => {
        this.entries.set(
          results.map((result, i) => ({
            id: ids[i],
            property: result.property,
            error: 'error' in result ? result.error : '',
          })),
        );
        this.busy.set(false);
      });
      cleanup(() => subscription.unsubscribe());
    });
  }
  refresh() {
    this.revision.update((v) => v + 1);
  }
}
