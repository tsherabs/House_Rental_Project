import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PropertyService } from './property.service';

describe('PropertyService proposed contract', () => {
  let service: PropertyService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PropertyService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('sends combined filters including zero bedrooms and false facility values', () => {
    service
      .list({
        sort: 'rent_asc',
        page: 2,
        limit: 12,
        minRent: '0.00',
        bedrooms: 0,
        waterAvailable: false,
        neighbourhood: 'Chang zamtog',
      })
      .subscribe();
    const request = http.expectOne((r) => r.url === '/api/v1/properties');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('minRent')).toBe('0.00');
    expect(request.request.params.get('bedrooms')).toBe('0');
    expect(request.request.params.get('waterAvailable')).toBe('false');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('neighbourhood')).toBe('Chang zamtog');
    request.flush({ data: [], pagination: { page: 2, limit: 12, total: 0, totalPages: 0 } });
  });
  it('uses the detail envelope and retains decimal money strings', () => {
    service
      .detail('home-1')
      .subscribe((response) => expect(response.property.monthlyRent).toBe('18000.00'));
    http.expectOne('/api/v1/properties/home-1').flush({ property: { monthlyRent: '18000.00' } });
  });
  it('propagates API errors for the page to handle', () => {
    service.detail('missing').subscribe({ error: (error) => expect(error.status).toBe(404) });
    http
      .expectOne('/api/v1/properties/missing')
      .flush({ error: { code: 'NOT_FOUND' } }, { status: 404, statusText: 'Not Found' });
  });
});
