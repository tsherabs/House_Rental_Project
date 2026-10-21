import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE, Page } from '../../core/api';
import { Role, User } from '../../core/auth/auth.service';

export interface UserFilters {
  role?: Role;
  accountStatus?: User['accountStatus'];
  page: number;
  limit: number;
}
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);
  users(filters: UserFilters) {
    const params: Record<string, string | number> = { page: filters.page, limit: filters.limit };
    if (filters.role) params['role'] = filters.role;
    if (filters.accountStatus) params['accountStatus'] = filters.accountStatus;
    return this.http.get<Page<User>>(`${this.base}/admin/users`, { withCredentials: true, params });
  }
  status(id: string, accountStatus: User['accountStatus'], reason: string) {
    return this.http.patch<{ user: User }>(
      `${this.base}/admin/users/${encodeURIComponent(id)}/status`,
      { accountStatus, reason: reason.trim() },
      { withCredentials: true },
    );
  }
}
