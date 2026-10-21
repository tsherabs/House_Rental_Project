import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, map, Observable, of, shareReplay, tap, timeout } from 'rxjs';
import { API_BASE } from '../api';

export type Role = 'seeker' | 'landlord' | 'admin';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  accountStatus: 'active' | 'suspended';
  createdAt: string;
}
export interface Registration {
  name: string;
  email: string;
  password: string;
  role: 'seeker' | 'landlord';
}
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);
  private readonly current = signal<User | null>(null);
  readonly user = this.current.asReadonly();
  readonly unavailable = signal(false);
  private pending?: Observable<User | null>;
  refresh(): Observable<User | null> {
    if (this.pending) return this.pending;
    this.pending = this.http
      .get<{ user: User }>(`${this.base}/auth/me`, { withCredentials: true })
      .pipe(
        timeout(8000),
        map((response) => (response.user.accountStatus === 'active' ? response.user : null)),
        tap((user) => {
          this.current.set(user);
          this.unavailable.set(false);
        }),
        catchError((error) => {
          this.current.set(null);
          this.unavailable.set(![401, 403].includes(error.status));
          return of(null);
        }),
        finalize(() => {
          this.pending = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.pending;
  }
  login(email: string, password: string) {
    return this.http
      .post<{ user: User }>(
        `${this.base}/auth/login`,
        { email: email.trim().toLowerCase(), password },
        { withCredentials: true },
      )
      .pipe(
        tap((response) => {
          this.current.set(response.user.accountStatus === 'active' ? response.user : null);
          this.unavailable.set(false);
        }),
      );
  }
  register(body: Registration) {
    return this.http.post<{ user: User }>(
      `${this.base}/auth/register`,
      {
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        password: body.password,
        role: body.role,
      },
      { withCredentials: true },
    );
  }
  logout() {
    return this.http
      .post<void>(`${this.base}/auth/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this.clear()));
  }
  clear() {
    this.current.set(null);
  }
  home(user: User | null = this.user()) {
    return user?.role === 'landlord'
      ? '/my-properties'
      : user?.role === 'admin'
        ? '/admin'
        : '/properties';
  }
}

// Accept only application-local URLs, never protocol-relative or backslash URLs.
export function safeReturnUrl(value: string | null): string | null {
  return value?.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\u0000-\u0020]/.test(value) &&
    !/^\/(login|register)([/?#]|$)/.test(value)
    ? value
    : null;
}
