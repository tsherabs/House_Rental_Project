import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE } from '../../core/api';
import { Property, PropertyImage, PropertyPage } from '../properties/property';

export interface PropertyInput {
  title: string; description: string; monthlyRent: string; deposit: string; bedrooms: number;
  neighbourhood: string; landmarks: string | null; waterAvailable: boolean; parkingAvailable: boolean; moveInDate: string;
}
@Injectable({ providedIn: 'root' })
export class LandlordService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);
  private readonly credentials = { withCredentials: true };
  list(page = 1) { return this.http.get<PropertyPage>(`${this.base}/my/properties`, { ...this.credentials, params: { page, limit: 12 } }); }
  get(id: string) { return this.http.get<{ property: Property }>(`${this.base}/my/properties/${encodeURIComponent(id)}`, this.credentials); }
  create(body: PropertyInput) { return this.http.post<{ property: Property }>(`${this.base}/properties`, body, this.credentials); }
  update(id: string, body: Partial<PropertyInput>) { return this.http.patch<{ property: Property }>(`${this.base}/properties/${encodeURIComponent(id)}`, body, this.credentials); }
  availability(id: string, availabilityStatus: Property['availabilityStatus']) { return this.http.patch<{ property: Property }>(`${this.base}/properties/${encodeURIComponent(id)}/availability`, { availabilityStatus }, this.credentials); }
  archive(id: string) { return this.http.delete<void>(`${this.base}/properties/${encodeURIComponent(id)}`, this.credentials); }
  upload(id: string, files: File[]) {
    const body = new FormData(); files.forEach(file => body.append('images', file));
    return this.http.post<{ images: PropertyImage[] }>(`${this.base}/properties/${encodeURIComponent(id)}/images`, body, { ...this.credentials, reportProgress: true, observe: 'events' });
  }
  removeImage(id: string, imageId: string) { return this.http.delete<void>(`${this.base}/properties/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`, this.credentials); }
  orderImages(id: string, imageIds: string[]) { return this.http.patch<{ images: PropertyImage[] }>(`${this.base}/properties/${encodeURIComponent(id)}/images/order`, { imageIds }, this.credentials); }
}
