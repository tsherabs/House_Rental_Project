import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService, safeReturnUrl, User } from './auth.service';
import { sessionInterceptor } from './session.interceptor';
import { roleGuard } from './role.guard';
import { Component } from '@angular/core';
import { AuthPage, passwordBytes } from '../../features/auth/auth-page';
import { FormControl } from '@angular/forms';

const landlord: User = { id: 'owner', name: 'Pema', email: 'pema@example.com', role: 'landlord', accountStatus: 'active', createdAt: '2026-10-20T00:00:00Z' };
@Component({ template: 'Private page' }) class PrivatePage {}
describe('Cookie authentication', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([sessionInterceptor])), provideHttpClientTesting(), provideRouter([
      { path: 'login', component: AuthPage }, { path: 'register', component: AuthPage, data: { register: true } },
      { path: 'private', component: PrivatePage, canActivate: [roleGuard], data: { roles: ['landlord'] } },
      { path: 'forbidden', component: PrivatePage }, { path: 'my-properties', component: PrivatePage },
    ])] });
    http = TestBed.inject(HttpTestingController); auth = TestBed.inject(AuthService);
  });
  afterEach(() => http.verify());
  it('initializes from the server and shares concurrent account reads', () => {
    auth.refresh().subscribe(); auth.refresh().subscribe();
    const req = http.expectOne('/api/v1/auth/me'); expect(req.request.withCredentials).toBe(true);
    req.flush({ user: landlord }); expect(auth.user()?.role).toBe('landlord');
  });
  it('registers only the public payload and does not establish a session', () => {
    auth.register({ name: ' Pema ', email: ' PEMA@example.com ', password: ' long password ', role: 'landlord' }).subscribe();
    const req = http.expectOne('/api/v1/auth/register');
    expect(req.request.body).toEqual({ name: 'Pema', email: 'pema@example.com', password: ' long password ', role: 'landlord' });
    req.flush({ user: landlord }); expect(auth.user()).toBeNull();
  });
  it('sets login state and destroys it only after successful logout', () => {
    auth.login(' PEMA@example.com ', 'password').subscribe();
    http.expectOne('/api/v1/auth/login').flush({ user: landlord });
    expect(auth.user()?.id).toBe('owner');
    auth.logout().subscribe(); const logout = http.expectOne('/api/v1/auth/logout');
    expect(logout.request.body).toEqual({}); logout.flush(null, { status: 204, statusText: 'No Content' });
    expect(auth.user()).toBeNull();
  });
  it('allows public browsing when the account service is unavailable', () => {
    auth.refresh().subscribe(); http.expectOne('/api/v1/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(auth.user()).toBeNull(); expect(auth.unavailable()).toBe(true);
  });
  it('redirects a guest away from a protected route', async () => {
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/private');
    await vi.waitFor(() => http.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' }));
    await navigation; expect(TestBed.inject(Router).url).toContain('/login?returnUrl=%2Fprivate');
  });
  it('rejects a signed-in user with the wrong role', async () => {
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/private');
    await vi.waitFor(() => http.expectOne('/api/v1/auth/me').flush({ user: { ...landlord, role: 'seeker' } }));
    await navigation; expect(TestBed.inject(Router).url).toBe('/forbidden');
  });
  it('validates UTF-8 password length and unsafe redirects', () => {
    expect(passwordBytes(new FormControl('é'.repeat(37)))).toEqual({ passwordBytes: true });
    expect(passwordBytes(new FormControl('a'.repeat(72)))).toBeNull();
    for (const url of ['//evil.test', '/\\evil.test', '/login', 'https://evil.test']) expect(safeReturnUrl(url)).toBeNull();
    expect(safeReturnUrl('/my-properties?page=2')).toBe('/my-properties?page=2');
  });
  it('offers no admin registration and rejects invalid forms before HTTP', async () => {
    const harness = await RouterTestingHarness.create(); const component = await harness.navigateByUrl('/register', AuthPage);
    expect(harness.routeNativeElement?.querySelector('option[value="admin"]')).toBeNull();
    component.submit(); expect(component.form.invalid).toBe(true); http.expectNone('/api/v1/auth/register');
  });
  it('submits login and navigates to the role dashboard', async () => {
    const harness = await RouterTestingHarness.create(); const component = await harness.navigateByUrl('/login', AuthPage);
    component.form.patchValue({ email: 'pema@example.com', password: 'password' }); component.submit();
    expect(component.pending()).toBe(true); http.expectOne('/api/v1/auth/login').flush({ user: landlord });
    await harness.fixture.whenStable(); expect(TestBed.inject(Router).url).toBe('/my-properties');
    expect(component.form.controls.password.value).toBe('');
  });
});
