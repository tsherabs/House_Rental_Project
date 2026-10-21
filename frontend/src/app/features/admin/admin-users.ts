import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, catchError, finalize, of, switchMap, tap } from 'rxjs';
import { Failure, failureFrom, Page } from '../../core/api';
import { AuthService, User } from '../../core/auth/auth.service';
import { FormFeedback } from '../../shared/form-feedback';
import { Pagination } from '../../shared/pagination';
import { AdminService, UserFilters } from './admin.service';

@Component({
  imports: [RouterLink, ReactiveFormsModule, DatePipe, FormFeedback, Pagination],
  styleUrl: './admin-users.css',
  template: ` <a routerLink="/admin">← Administration</a>
    <h1>User accounts</h1>
    <form [formGroup]="filters" (ngSubmit)="apply()" class="filters" aria-label="Filter users">
      <label
        >Role<select formControlName="role">
          <option value="">All roles</option>
          <option value="seeker">Seeker</option>
          <option value="landlord">Landlord</option>
          <option value="admin">Administrator</option>
        </select></label
      >
      <label
        >Account status<select formControlName="accountStatus">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select></label
      >
      <button type="submit" [disabled]="pending()">Apply filters</button>
    </form>
    @if (failure(); as error) {
      <p role="alert">{{ error.message }}</p>
      <button [disabled]="pending()" (click)="reload()">Refresh users</button>
    }
    @if (loading()) {
      <p role="status">Loading users…</p>
    }
    @if (notice()) {
      <p role="status">{{ notice() }}</p>
    }
    @if (selected(); as user) {
      <section class="card card-body status-editor" aria-labelledby="status-title">
        <h2 id="status-title">
          {{ user.accountStatus === 'active' ? 'Suspend' : 'Reactivate' }} {{ user.name }}
        </h2>
        <p>
          {{
            user.accountStatus === 'active'
              ? 'Suspension revokes existing sessions and prevents protected actions.'
              : 'The user will need to sign in again after reactivation.'
          }}
        </p>
        <form [formGroup]="statusForm" (ngSubmit)="save()">
          <app-form-feedback
            [form]="statusForm"
            [failure]="actionFailure()"
            [labels]="{ reason: 'Reason (10–1000 characters)' }"
          />
          <label
            >Reason (required, 10–1000 characters)<textarea
              #reasonInput
              formControlName="reason"
              maxlength="1000"
              rows="4"
              [attr.aria-invalid]="
                statusForm.controls.reason.touched && statusForm.controls.reason.invalid
              "
            ></textarea>
          </label>
          <div class="actions">
            <button type="submit" [disabled]="pending()">
              {{ pending() ? 'Saving…' : 'Confirm status change' }}</button
            ><button type="button" class="secondary" [disabled]="pending()" (click)="cancel()">
              Cancel
            </button>
          </div>
        </form>
      </section>
    }
    @if (result(); as page) {
      <p>{{ page.pagination.total }} users</p>
      <div class="table-scroll">
        <table>
          <caption>
            User accounts and access status
          </caption>
          <thead>
            <tr>
              <th scope="col">Name / email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Joined (Bhutan)</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            @for (user of page.data; track user.id) {
              <tr>
                <td>{{ user.name }}<br />{{ user.email }}</td>
                <td>{{ user.role }}</td>
                <td>{{ user.accountStatus }}</td>
                <td>{{ user.createdAt | date: 'mediumDate' : '+0600' }}</td>
                <td>
                  @if (user.id === auth.user()?.id) {
                    <span>Your current account</span>
                  } @else {
                    <button [disabled]="pending()" (click)="select(user)">
                      {{ user.accountStatus === 'active' ? 'Suspend' : 'Reactivate' }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5">No users match these filters.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <app-pagination [pagination]="page.pagination" [busy]="pending()" (pageChange)="go($event)" />
    }`,
})
export class AdminUsers {
  private readonly api = inject(AdminService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly refresh = new BehaviorSubject(0);
  private readonly fb = inject(FormBuilder);
  readonly loading = signal(true);
  readonly pending = signal(false);
  readonly result = signal<Page<User> | null>(null);
  readonly selected = signal<User | null>(null);
  readonly failure = signal<Failure | null>(null);
  readonly actionFailure = signal<Failure | null>(null);
  readonly notice = signal('');
  readonly filters = this.fb.nonNullable.group({ role: [''], accountStatus: [''] });
  readonly statusForm = this.fb.nonNullable.group({
    reason: [
      '',
      [
        Validators.required,
        Validators.maxLength(1000),
        (control) => (String(control.value).trim().length >= 10 ? null : { reasonLength: true }),
      ],
    ],
  });
  constructor() {
    combineLatest([this.route.queryParamMap, this.refresh])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.failure.set(null);
          this.result.set(null);
        }),
        switchMap(([params]) => {
          const role = params.get('role');
          const status = params.get('accountStatus');
          const n = Number(params.get('page'));
          const filters: UserFilters = {
            page: Number.isInteger(n) && n > 0 && n <= 1000000 ? n : 1,
            limit: 12,
          };
          if (role === 'seeker' || role === 'landlord' || role === 'admin') filters.role = role;
          if (status === 'active' || status === 'suspended') filters.accountStatus = status;
          this.filters.reset(
            { role: filters.role ?? '', accountStatus: filters.accountStatus ?? '' },
            { emitEvent: false },
          );
          return this.api.users(filters).pipe(
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
  apply() {
    this.cancel();
    void this.router.navigate(['/admin/users'], {
      queryParams: { ...this.filters.getRawValue(), page: 1 },
    });
  }
  go(page: number) {
    this.cancel();
    void this.router.navigate(['/admin/users'], {
      queryParams: { ...this.route.snapshot.queryParams, page },
    });
  }
  reload() {
    this.refresh.next(this.refresh.value + 1);
  }
  select(user: User) {
    if (this.pending() || user.id === this.auth.user()?.id) return;
    this.selected.set(user);
    this.statusForm.reset();
    this.actionFailure.set(null);
    this.notice.set('');
  }
  cancel() {
    if (!this.pending()) {
      this.selected.set(null);
      this.actionFailure.set(null);
      this.statusForm.reset();
    }
  }
  save() {
    const user = this.selected();
    if (this.pending() || !user || user.id === this.auth.user()?.id) return;
    this.statusForm.markAllAsTouched();
    if (this.statusForm.invalid) return;
    const status = user.accountStatus === 'active' ? 'suspended' : 'active';
    if (
      !window.confirm(
        `${status === 'suspended' ? 'Suspend' : 'Reactivate'} ${user.name}? This change will be recorded with your reason.`,
      )
    )
      return;
    this.pending.set(true);
    this.actionFailure.set(null);
    this.notice.set('');
    this.api
      .status(user.id, status, this.statusForm.controls.reason.value)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.selected.set(null);
          this.statusForm.reset();
          this.notice.set(`Account ${status === 'active' ? 'reactivated' : 'suspended'}.`);
          this.reload();
        },
        error: (error) => this.actionFailure.set(failureFrom(error)),
      });
  }
}
