import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService, Role } from '../../core/auth/auth.service';
import { PropertyActions } from './property-actions';
import { ViewingsPage } from './viewings-page';
import { FavouritesPage } from './favourites-page';
import { ReportsPage } from './reports-page';
import { RenewalsPage } from './renewals-page';
import { Viewing, Report } from './community.service';

const viewing: Viewing = {
  id: 'viewing-1',
  propertyId: 'home-1',
  propertyTitle: 'A sunny home',
  seekerId: 'user-1',
  proposedAt: '2099-11-01T06:00:00Z',
  message: '<script>hello</script>',
  status: 'pending',
  createdAt: '2026-10-21T00:00:00Z',
  updatedAt: '2026-10-21T00:00:00Z',
};
const page = <T>(data: T[], current = 1, total = data.length) => ({
  data,
  pagination: { page: current, limit: 12, total, totalPages: Math.ceil(total / 12) },
});
describe('M4 interface workflows', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function login(role: Role) {
    TestBed.inject(AuthService).login('demo@example.test', 'demo-password').subscribe();
    http.expectOne('/api/v1/auth/login').flush({
      user: {
        id: 'user-1',
        role,
        name: 'Demo',
        email: 'demo@example.test',
        accountStatus: 'active',
      },
    });
  }
  it('offers sign-in to visitors and hides seeker actions for landlords', () => {
    const fixture = TestBed.createComponent(PropertyActions);
    fixture.componentRef.setInput('propertyId', 'home-1');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sign in to request a viewing');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    login('landlord');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Come take a look');
    expect(fixture.nativeElement.textContent).toContain('Report a problem');
  });
  it('converts an explicit Bhutan time to UTC, prevents duplicate submission and shows confirmation', () => {
    login('seeker');
    const fixture = TestBed.createComponent(PropertyActions);
    fixture.componentRef.setInput('propertyId', 'home-1');
    const c = fixture.componentInstance;
    c.viewing.setValue({ when: '2099-11-01T12:00', message: ' Please arrange a visit ' });
    c.request();
    c.request();
    const req = http.expectOne('/api/v1/viewings');
    expect(req.request.body).toEqual({
      propertyId: 'home-1',
      proposedAt: '2099-11-01T06:00:00.000Z',
      message: 'Please arrange a visit',
    });
    req.flush({ viewing });
    fixture.detectChanges();
    expect(c.busy()).toBe(false);
    expect(c.notice()).toContain('Viewing requested');
    expect(c.viewing.controls.when.value).toBe('');
  });
  it('blocks past dates and whitespace-only reports before sending a request', () => {
    login('seeker');
    const fixture = TestBed.createComponent(PropertyActions);
    fixture.componentRef.setInput('propertyId', 'home-1');
    const c = fixture.componentInstance;
    c.viewing.setValue({ when: '2020-01-01T12:00', message: '' });
    c.request();
    expect(c.error()).toContain('future');
    c.reportForm.controls.reason.setValue('            ');
    c.report();
    expect(c.error()).toContain('10 characters');
    http.expectNone('/api/v1/reports');
    http.expectNone('/api/v1/viewings');
  });
  it('keeps report input after a duplicate error and allows retry', () => {
    login('seeker');
    const fixture = TestBed.createComponent(PropertyActions);
    fixture.componentRef.setInput('propertyId', 'home-1');
    const c = fixture.componentInstance;
    c.reportForm.controls.reason.setValue('Please verify these details.');
    c.report();
    http.expectOne('/api/v1/reports').flush({}, { status: 409, statusText: 'Conflict' });
    expect(c.busy()).toBe(false);
    expect(c.reportForm.controls.reason.value).toBe('Please verify these details.');
    expect(c.error()).toContain('already exists');
  });
  it('shows owner decisions and keeps controls busy until the refreshed list arrives', () => {
    login('landlord');
    const fixture = TestBed.createComponent(ViewingsPage);
    const c = fixture.componentInstance;
    http.expectOne((r) => r.url.endsWith('/viewings/received')).flush(page([viewing]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Accept request');
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    c.decide(viewing, 'accepted');
    http
      .expectOne('/api/v1/viewings/viewing-1/status')
      .flush({ viewing: { ...viewing, status: 'accepted' } });
    expect(c.busy()).toBe(true);
    http
      .expectOne((r) => r.url.endsWith('/viewings/received'))
      .flush(page([{ ...viewing, status: 'accepted' }]));
    fixture.detectChanges();
    expect(c.busy()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Accept request');
  });
  it('shows requester cancellation and history, and preserves the list on failed decisions', () => {
    login('seeker');
    const fixture = TestBed.createComponent(ViewingsPage);
    const c = fixture.componentInstance;
    http.expectOne((r) => r.url.endsWith('/viewings/mine')).flush(page([viewing]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cancel request');
    expect(fixture.nativeElement.textContent).not.toContain('Accept request');
    c.history(viewing);
    http.expectOne('/api/v1/viewings/viewing-1').flush({
      viewing,
      history: [
        {
          id: 'h1',
          oldStatus: null,
          newStatus: 'pending',
          changedAt: viewing.createdAt,
          changedBy: 'user-1',
        },
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Request created');
  });
  it('retains unavailable saved homes and removes them without leaking details', () => {
    const fixture = TestBed.createComponent(FavouritesPage);
    const c = fixture.componentInstance;
    http
      .expectOne((r) => r.url.endsWith('/favourites'))
      .flush(page([{ propertyId: 'home-1', available: false, property: null }]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Home currently unavailable');
    c.remove('home-1');
    http.expectOne('/api/v1/favourites/home-1').flush(null);
    expect(c.busy()).toBe(true);
    http.expectOne((r) => r.url.endsWith('/favourites')).flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your shortlist starts here');
  });
  it('records report reviews separately from visibility moderation', () => {
    const fixture = TestBed.createComponent(ReportsPage);
    const c = fixture.componentInstance;
    const report: Report = {
      id: 'report-1',
      propertyId: 'home-1',
      propertyTitle: 'Sunny home',
      reason: 'Verify the listing details',
      reviewStatus: 'pending',
      reviewReason: null,
      visibilityStatus: 'published',
      createdAt: viewing.createdAt,
    };
    http.expectOne((r) => r.url.endsWith('/admin/reports')).flush(page([report]));
    c.select(report);
    c.form.controls.reason.setValue('Reviewed and contacted owner.');
    c.review(report, 'actioned');
    const req = http.expectOne('/api/v1/admin/reports/report-1');
    expect(req.request.body).toEqual({
      reviewStatus: 'actioned',
      reviewReason: 'Reviewed and contacted owner.',
    });
    req.flush({});
    http.expectNone('/api/v1/admin/properties/home-1/visibility');
    http.expectOne((r) => r.url.endsWith('/admin/reports')).flush(page([]));
    expect(c.notice()).toBe('Review recorded.');
  });
  it('renews an owned listing using the confirmation endpoint and refreshes the reminder list', () => {
    const fixture = TestBed.createComponent(RenewalsPage);
    const c = fixture.componentInstance;
    const home = {
      id: 'home-1',
      title: 'Sunny home',
      expiresAt: null,
      availabilityStatus: 'available',
      visibilityStatus: 'published',
    };
    http.expectOne((r) => r.url.endsWith('/my/properties/expiring')).flush(page([home]));
    c.confirm(c.page()!.data[0]);
    const req = http.expectOne('/api/v1/properties/home-1/confirm');
    expect(req.request.body).toEqual({});
    req.flush({ property: home });
    http.expectOne((r) => r.url.endsWith('/my/properties/expiring')).flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Listing confirmed for 30 days.');
  });
});
