import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, User } from './core/auth/auth.service';
describe('App', () => {
  it('provides a browse link and accessible content target', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('nav a').textContent).toContain(
      'Thimphu HomeFinder',
    );
    expect(fixture.nativeElement.querySelector('main').id).toBe('main');
  });
  it('shows role-specific links and keeps a session after failed logout', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const user: User = {
      id: 'owner',
      name: 'Pema',
      email: 'pema@example.com',
      role: 'landlord',
      accountStatus: 'active',
      createdAt: '2026-10-20T00:00:00Z',
    };
    auth.login(user.email, 'password').subscribe();
    http.expectOne('/api/v1/auth/login').flush({ user });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('a[href="/my-properties"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/admin"]')).toBeNull();
    fixture.componentInstance.logout();
    http.expectOne('/api/v1/auth/logout').flush({}, { status: 403, statusText: 'Forbidden' });
    http.expectOne('/api/v1/auth/me').flush({ user });
    expect(auth.user()?.id).toBe('owner');
    expect(fixture.componentInstance.logoutError()).toContain('Could not sign out');
    auth.login(user.email, 'password').subscribe();
    http.expectOne('/api/v1/auth/login').flush({ user: { ...user, role: 'admin' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/my-properties"]')).toBeNull();
    http.verify();
  });
});
