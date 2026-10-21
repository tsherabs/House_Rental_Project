import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Page, failureFrom } from '../../core/api';
import { Pagination } from '../../shared/pagination';
import { Property } from '../properties/property';
import { CommunityService } from './community.service';
@Component({
  imports: [DatePipe, RouterLink, Pagination],
  template: ` <header>
      <p class="eyebrow">KEEP YOUR LISTINGS CURRENT</p>
      <h1>Listing confirmations</h1>
      <p>
        Confirm your listing details to renew for 30 days. Hidden and rented listings keep their
        current status.
      </p>
      <a routerLink="/my-properties">← My properties</a>
    </header>
    @if (busy()) {
      <p role="status">Updating listings…</p>
    }
    @if (notice()) {
      <p role="status">{{ notice() }}</p>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button [disabled]="busy()" (click)="load()">Try again</button>
    }
    @if (page(); as result) {
      <section class="workflow-list">
        @for (p of result.data; track p.id) {
          <article class="card card-body">
            <h2>{{ p.title }}</h2>
            <p>{{ p.neighbourhood }} · {{ p.availabilityStatus }} · {{ p.visibilityStatus }}</p>
            <p>
              {{
                p.expiresAt
                  ? 'Expiry: ' + (p.expiresAt | date: 'd MMM y, h:mm a' : '+0600')
                  : 'Not yet confirmed'
              }}
            </p>
            <div class="actions">
              <a [routerLink]="['/my-properties', p.id, 'edit']">Review details</a
              ><button [disabled]="busy()" (click)="confirm(p)">Confirm details & renew</button>
            </div>
          </article>
        } @empty {
          <div class="empty-state">
            <h2>You’re up to date</h2>
            <p>No listings need confirmation within the next 7 days.</p>
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
export class RenewalsPage {
  private readonly api = inject(CommunityService);
  private readonly destroy = inject(DestroyRef);
  readonly page = signal<Page<Property> | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  constructor() {
    this.load();
  }
  load(number = this.page()?.pagination.page ?? 1) {
    this.busy.set(true);
    this.error.set('');
    this.api
      .expiring(number)
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
  confirm(p: Property) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .confirm(p.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.notice.set('Listing confirmed for 30 days.');
          this.load();
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(failureFrom(e).message);
        },
      });
  }
}
