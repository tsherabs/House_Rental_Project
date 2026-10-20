export interface PropertyImage {
  id: string;
  url: string;
  displayOrder: number;
}
export interface Property {
  id: string;
  ownerId?: string;
  title: string;
  description: string;
  monthlyRent: string;
  deposit: string;
  bedrooms: number;
  neighbourhood: string;
  landmarks: string | null;
  waterAvailable: boolean;
  parkingAvailable: boolean;
  moveInDate: string;
  availabilityStatus: 'available' | 'rented';
  visibilityStatus: 'draft' | 'published' | 'hidden' | 'archived';
  confirmedAt: string | null;
  expiresAt: string | null;
  images: PropertyImage[];
  createdAt: string;
  updatedAt: string;
}
export interface PropertyPage {
  data: Property[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export interface PropertyFilters {
  minRent?: string;
  maxRent?: string;
  bedrooms?: number;
  neighbourhood?: string;
  waterAvailable?: boolean;
  parkingAvailable?: boolean;
  availableFrom?: string;
  sort: 'recent' | 'rent_asc' | 'rent_desc';
  page: number;
  limit: number;
}
