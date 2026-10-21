import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE, Page } from '../../core/api';
import { Property } from '../properties/property';

export type ViewingStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export interface Viewing {
  id: string;
  propertyId: string;
  propertyTitle: string;
  seekerId: string;
  proposedAt: string;
  message: string | null;
  status: ViewingStatus;
  createdAt: string;
  updatedAt: string;
}
export interface History {
  id: string;
  oldStatus: ViewingStatus | null;
  newStatus: ViewingStatus;
  changedAt: string;
  changedBy: string;
}
export interface Favourite {
  propertyId: string;
  createdAt: string;
  available: boolean;
  property: Property | null;
}
export interface Report {
  id: string;
  propertyId: string;
  propertyTitle: string;
  reason: string;
  reviewStatus: 'pending' | 'dismissed' | 'actioned';
  reviewReason: string | null;
  visibilityStatus: Property['visibilityStatus'];
  createdAt: string;
}
@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);
  request(propertyId: string, proposedAt: string, message: string) {
    return this.http.post<{ viewing: Viewing }>(`${this.base}/viewings`, {
      propertyId,
      proposedAt,
      message,
    });
  }
  viewings(landlord: boolean, page = 1) {
    return this.http.get<Page<Viewing>>(`${this.base}/viewings/${landlord ? 'received' : 'mine'}`, {
      params: { page, limit: 12 },
    });
  }
  detail(id: string) {
    return this.http.get<{ viewing: Viewing; history: History[] }>(`${this.base}/viewings/${id}`);
  }
  decide(id: string, status: 'accepted' | 'rejected') {
    return this.http.patch<{ viewing: Viewing }>(`${this.base}/viewings/${id}/status`, { status });
  }
  cancel(id: string) {
    return this.http.post<{ viewing: Viewing }>(`${this.base}/viewings/${id}/cancel`, {});
  }
  favourites(page = 1) {
    return this.http.get<Page<Favourite>>(`${this.base}/favourites`, {
      params: { page, limit: 12 },
    });
  }
  save(propertyId: string) {
    return this.http.post(`${this.base}/favourites`, { propertyId });
  }
  remove(propertyId: string) {
    return this.http.delete(`${this.base}/favourites/${propertyId}`);
  }
  report(propertyId: string, reason: string) {
    return this.http.post(`${this.base}/reports`, { propertyId, reason });
  }
  reports(reviewStatus: string, page = 1) {
    return this.http.get<Page<Report>>(`${this.base}/admin/reports`, {
      params: { ...(reviewStatus ? { reviewStatus } : {}), page, limit: 12 },
    });
  }
  review(id: string, reviewStatus: 'dismissed' | 'actioned', reviewReason: string) {
    return this.http.patch(`${this.base}/admin/reports/${id}`, { reviewStatus, reviewReason });
  }
  visibility(id: string, visibilityStatus: 'hidden' | 'published', reason: string) {
    return this.http.patch(`${this.base}/admin/properties/${id}/visibility`, {
      visibilityStatus,
      reason,
    });
  }
  confirm(id: string) {
    return this.http.post<{ property: Property }>(`${this.base}/properties/${id}/confirm`, {});
  }
  expiring(page = 1) {
    return this.http.get<Page<Property>>(`${this.base}/my/properties/expiring`, {
      params: { page, limit: 12 },
    });
  }
}
