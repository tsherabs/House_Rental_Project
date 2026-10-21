import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Page, failureFrom } from '../../core/api';
import { Pagination } from '../../shared/pagination';
import { CommunityService, Viewing, History } from './community.service';
@Component({
  imports: [DatePipe, Pagination],
  template: `<header>
      <p class="eyebrow">MAKE YOUR NEXT MOVE</p>
      <h1>{{ landlord ? 'Viewing requests' : 'My viewings' }}</h1>
      <p>
        {{
          landlord
            ? 'Arrange visits and help people find their next home.'
            : 'Your upcoming visits and the story of each request.'
        }}
        All times are Bhutan time.
      </p>
    </header>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button (click)="load()" [disabled]="busy()">Refresh requests</button>
    }
    @if (busy()) {
      <p role="status">Updating viewings…</p>
    }
    @if (page(); as result) {
      <section class="workflow-list">
        @for (v of result.data; track v.id) {
          <article class="card card-body">
            <div class="row-between">
              <h2>{{ v.propertyTitle }}</h2>
              <span class="badge" [attr.data-status]="v.status">{{ v.status }}</span>
            </div>
            <p class="visit-date">{{ v.proposedAt | date: 'EEE, d MMM y, h:mm a' : '+0600' }}</p>
            @if (v.message) {
              <p class="description">{{ v.message }}</p>
            }
            <div class="actions">
              @if (landlord && v.status === 'pending') {
                <button [disabled]="busy()" (click)="decide(v, 'accepted')">Accept request</button>
                <button class="secondary" [disabled]="busy()" (click)="decide(v, 'rejected')">
                  Reject
                </button>
              }
              @if (!landlord && (v.status === 'pending' || v.status === 'accepted')) {
                <button class="secondary" [disabled]="busy()" (click)="cancel(v)">
                  Cancel request
                </button>
              }
              <button class="secondary" [disabled]="busy()" (click)="history(v)">
                View history
              </button>
            </div>
            @if (selected() === v.id) {
              <ol class="timeline" aria-label="Viewing status history">
                @for (entry of entries(); track entry.id) {
                  <li>
                    <strong>{{ entry.newStatus }}</strong> ·
                    {{ entry.changedAt | date: 'd MMM y, h:mm a' : '+0600' }}
                    <small>{{
                      entry.oldStatus ? 'Previously ' + entry.oldStatus : 'Request created'
                    }}</small>
                  </li>
                }
              </ol>
            }
          </article>
        } @empty {
          <div class="empty-state">
            <h2>No viewings yet</h2>
            <p>
              {{
                landlord
                  ? 'Requests for your properties will appear here.'
                  : 'Open a home you like and choose a time to visit.'
              }}
            </p>
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
export class ViewingsPage {
  private readonly api = inject(CommunityService);
  private readonly destroy = inject(DestroyRef);
  readonly landlord = inject(AuthService).user()?.role === 'landlord';
  readonly page = signal<Page<Viewing> | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly selected = signal('');
  readonly entries = signal<History[]>([]);
  constructor() {
    this.load();
  }
  load(number = this.page()?.pagination.page ?? 1) {
    this.busy.set(true);
    this.error.set('');
    this.api
      .viewings(this.landlord, number)
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (p) => this.page.set(p),
        error: (e) => this.error.set(failureFrom(e).message),
      });
  }
  private change(action: Observable<unknown>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    action.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.busy.set(false);
        this.selected.set('');
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(failureFrom(e).message);
      },
    });
  }
  decide(v: Viewing, status: 'accepted' | 'rejected') {
    this.change(this.api.decide(v.id, status));
  }
  cancel(v: Viewing) {
    if (window.confirm('Cancel this viewing request?')) this.change(this.api.cancel(v.id));
  }
  history(v: Viewing) {
    this.busy.set(true);
    this.error.set('');
    this.selected.set('');
    this.api
      .detail(v.id)
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (r) => {
          this.entries.set(r.history);
          this.selected.set(v.id);
        },
        error: (e) => this.error.set(failureFrom(e).message),
      });
  }
}
