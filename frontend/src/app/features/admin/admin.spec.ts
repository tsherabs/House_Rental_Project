import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AdminService } from './admin.service';
import { AdminUsers } from './admin-users';
import { AuthService, User } from '../../core/auth/auth.service';

const admin: User = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'admin',
  accountStatus: 'active',
  createdAt: '2026-10-20T00:00:00Z',
};
const user: User = { ...admin, id: 'seeker-1', name: 'Pema', role: 'seeker' };
const page = { data: [admin, user], pagination: { page: 1, limit: 12, total: 2, totalPages: 1 } };
describe('Admin account management', () => {
  let http: HttpTestingController;
  let api: AdminService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/users', component: AdminUsers }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(AdminService);
    TestBed.inject(AuthService).login('admin@example.com', 'password').subscribe();
    http.expectOne('/api/v1/auth/login').flush({ user: admin });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });
  it('sends only supported filters and status/reason payloads', () => {
    api.users({ page: 2, limit: 12, role: 'landlord', accountStatus: 'suspended' }).subscribe();
    const request = http.expectOne(
      '/api/v1/admin/users?page=2&limit=12&role=landlord&accountStatus=suspended',
    );
    expect(request.request.withCredentials).toBe(true);
    request.flush(page);
    api.status(user.id, 'suspended', '  Repeated policy violations  ').subscribe();
    const change = http.expectOne('/api/v1/admin/users/seeker-1/status');
    expect(change.request.method).toBe('PATCH');
    expect(change.request.body).toEqual({
      accountStatus: 'suspended',
      reason: 'Repeated policy violations',
    });
    change.flush({ user });
  });
  it('prevents self-suspension in both UI and submit handler', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/admin/users', AdminUsers);
    http.expectOne('/api/v1/admin/users?page=1&limit=12').flush(page);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Your current account');
    component.select(admin);
    expect(component.selected()).toBeNull();
    component.selected.set(admin);
    component.statusForm.controls.reason.setValue('Long enough reason');
    component.save();
    http.expectNone('/api/v1/admin/users/admin-1/status');
  });
  it('requires an audit reason and confirmation then refreshes account state', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/admin/users', AdminUsers);
    http.expectOne('/api/v1/admin/users?page=1&limit=12').flush(page);
    component.select(user);
    component.save();
    http.expectNone('/api/v1/admin/users/seeker-1/status');
    component.statusForm.controls.reason.setValue('Repeated policy violations');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.save();
    http
      .expectOne('/api/v1/admin/users/seeker-1/status')
      .flush({ user: { ...user, accountStatus: 'suspended' } });
    http
      .expectOne('/api/v1/admin/users?page=1&limit=12')
      .flush({ ...page, data: [{ ...user, accountStatus: 'suspended' }] });
    expect(component.selected()).toBeNull();
    expect(component.notice()).toBe('Account suspended.');
  });
  it('restores filters from the URL and resets the page when applying a filter', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/admin/users?role=landlord&page=2', AdminUsers);
    http
      .expectOne('/api/v1/admin/users?page=2&limit=12&role=landlord')
      .flush({ ...page, pagination: { ...page.pagination, page: 2, totalPages: 2 } });
    expect(component.filters.controls.role.value).toBe('landlord');
    component.filters.controls.accountStatus.setValue('suspended');
    component.apply();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('page=1');
    http
      .expectOne('/api/v1/admin/users?page=1&limit=12&role=landlord&accountStatus=suspended')
      .flush(page);
  });
  it('keeps a rejected status change visible for correction', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/admin/users', AdminUsers);
    http.expectOne('/api/v1/admin/users?page=1&limit=12').flush(page);
    component.select(user);
    component.statusForm.controls.reason.setValue('Repeated policy violations');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.save();
    http
      .expectOne('/api/v1/admin/users/seeker-1/status')
      .flush({}, { status: 409, statusText: 'Conflict' });
    expect(component.actionFailure()?.message).toContain('Refresh');
    expect(component.selected()?.id).toBe(user.id);
    expect(component.pending()).toBe(false);
  });
});
