import { inject, Injectable, InjectionToken } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Property, PropertyFilters, PropertyPage } from './property';

export const PROPERTY_API_BASE = new InjectionToken<string>('PROPERTY_API_BASE', {
  providedIn: 'root',
  factory: () => '/api/v1',
});

@Injectable({ providedIn: 'root' })
export class PropertyService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(PROPERTY_API_BASE);
  list(filters: PropertyFilters) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<PropertyPage>(`${this.base}/properties`, { params });
  }
  detail(id: string) {
    return this.http.get<{ property: Property }>(
      `${this.base}/properties/${encodeURIComponent(id)}`,
    );
  }
}
