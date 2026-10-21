import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { API_BASE, Page, failureFrom } from '../../core/api';
import { Pagination } from '../../shared/pagination';
export interface Notification { id: string; kind: string; title: string; message: string; link: string; createdAt: string; readAt: string | null }
@Component({
  imports: [DatePipe, RouterLink, Pagination],
  template: `<header><p class="eyebrow">STAY UP TO DATE</p><h1>Your inbox</h1>
    <p>Viewing updates and listing decisions, all in one place. Times are shown in Bhutan time.</p></header>
    <div class="actions"><button class="secondary" [disabled]="busy()" (click)="load(1)">Refresh inbox</button>
      <label class="check"><input type="checkbox" [checked]="unreadOnly()" [disabled]="busy()" (change)="filter($event)" />Unread only</label>
      @if (page(); as result) { <span class="badge">{{ result.unreadCount }} unread</span> }
    </div>
    @if (busy()) { <p role="status">Updating inbox…</p> }
    @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (page(); as result) {
      <section class="workflow-list" aria-label="Notifications">
        @for (notice of result.data; track notice.id) { <article class="card card-body notification" [class.unread]="!notice.readAt">
          <div class="row-between"><h2>{{ notice.title }}</h2><span class="badge">{{ notice.readAt ? 'Read' : 'New' }}</span></div>
          <p>{{ notice.message }}</p><p><small>{{ notice.createdAt | date: 'd MMM y, h:mm a' : '+0600' }}</small></p>
          <div class="actions"><a [routerLink]="safeLink(notice.link)">Open related page</a>
            @if (!notice.readAt) { <button class="secondary" [disabled]="busy()" (click)="markRead(notice)">Mark as read</button> }
          </div>
        </article> } @empty { <div class="empty-state"><h2>{{ unreadOnly() ? 'You are all caught up' : 'No updates yet' }}</h2><p>New updates appear here after viewing requests or listing decisions. Use Refresh inbox to check again.</p></div> }
      </section>
      <app-pagination [pagination]="result.pagination" [busy]="busy()" (pageChange)="load($event)" />
    }`,
})
export class NotificationsPage {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);
  private readonly destroy = inject(DestroyRef);
  readonly page = signal<(Page<Notification> & { unreadCount: number }) | null>(null);
  readonly unreadOnly = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  constructor() { this.load(1); }
  safeLink(link: string) { return ['/viewings', '/properties', '/my-properties'].includes(link) ? link : '/properties'; }
  filter(event: Event) { this.unreadOnly.set((event.target as HTMLInputElement).checked); this.load(1); }
  load(number = 1) {
    this.busy.set(true); this.error.set('');
    const params = new HttpParams().set('page', number).set('limit', 10).set('unreadOnly', this.unreadOnly());
    this.http.get<Page<Notification> & { unreadCount: number }>(`${this.base}/notifications`, { params })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: (result) => { this.page.set(result); this.busy.set(false); },
        error: (e) => { this.error.set(failureFrom(e).message); this.busy.set(false); },
      });
  }
  markRead(notice: Notification) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.http.patch(`${this.base}/notifications/${encodeURIComponent(notice.id)}/read`, {})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: () => this.load(this.unreadOnly() ? 1 : this.page()?.pagination.page ?? 1),
        error: (e) => { this.error.set(failureFrom(e).message); this.busy.set(false); },
      });
  }
}
