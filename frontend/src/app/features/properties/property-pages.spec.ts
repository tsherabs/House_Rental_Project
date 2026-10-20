import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { routes } from '../../app.routes';
import { PropertyList } from './property-list';

const home = {
  id: 'home-1',
  title: 'Sunny apartment',
  neighbourhood: 'Changzamtog',
  description: '<script>unsafe</script> Sunny home',
  monthlyRent: '18000.00',
  deposit: '18000.00',
  bedrooms: 2,
  waterAvailable: true,
  parkingAvailable: false,
  moveInDate: '2026-11-01',
  availabilityStatus: 'available',
  images: [],
};
const page = { data: [home], pagination: { page: 1, limit: 12, total: 1, totalPages: 1 } };

describe('Seeker property pages', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads URL filters and navigates from a result to safe property details', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/properties?minRent=10000&bedrooms=2');
    const request = http.expectOne((r) => r.url === '/api/v1/properties');
    expect(request.request.params.get('minRent')).toBe('10000');
    request.flush(page);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Sunny apartment');
    const link = harness.routeNativeElement?.querySelector('article a');
    expect(link?.getAttribute('href')).toContain('/properties/home-1');
    await harness.navigateByUrl('/properties/home-1');
    http.expectOne('/api/v1/properties/home-1').flush({ property: home });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('18,000.00');
    expect(harness.routeNativeElement?.querySelector('script')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('<script>unsafe</script>');
  });
  it('shows loading and empty states', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/properties');
    expect(harness.routeNativeElement?.textContent).toContain('Loading homes');
    http
      .expectOne((r) => r.url === '/api/v1/properties')
      .flush({ data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No homes match');
  });
  it('retries after a network error', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/properties', PropertyList);
    http
      .expectOne((r) => r.url === '/api/v1/properties')
      .flush({}, { status: 500, statusText: 'Server error' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Unable to load homes');
    component.retry();
    http.expectOne((r) => r.url === '/api/v1/properties').flush(page);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Sunny apartment');
  });
  it('rejects an inverted rent range without calling the API', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/properties?minRent=20000&maxRent=10000');
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('minimum no greater than maximum');
  });
  it('shows an unavailable state for missing property details', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/properties/missing');
    http
      .expectOne('/api/v1/properties/missing')
      .flush({}, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('no longer available');
  });
  it('keeps numeric zero rent and resets pagination when filters change', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/properties?page=3', PropertyList);
    http
      .expectOne((r) => r.url === '/api/v1/properties')
      .flush({ ...page, pagination: { ...page.pagination, page: 3, total: 30, totalPages: 3 } });
    component.form.patchValue({ minRent: 0 as unknown as string });
    component.apply();
    await harness.fixture.whenStable();
    const request = http.expectOne((r) => r.url === '/api/v1/properties');
    expect(request.request.params.get('minRent')).toBe('0');
    expect(request.request.params.get('page')).toBe('1');
    request.flush(page);
  });
});
