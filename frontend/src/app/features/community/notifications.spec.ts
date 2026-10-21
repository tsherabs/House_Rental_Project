import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationsPage } from './notifications-page';
describe('Notification inbox', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }));
  it('renders safe text, marks read, then reloads counts and the current page', () => {
    const fixture = TestBed.createComponent(NotificationsPage), http = TestBed.inject(HttpTestingController);
    const notice = { id: 'notice', title: '<script>unsafe</script>', message: 'Viewing accepted', link: 'https://evil.test', createdAt: '2026-10-21T12:00:00Z', readAt: null, kind: 'viewing_accepted' };
    http.expectOne((r) => r.url === '/api/v1/notifications').flush({ data: [notice], unreadCount: 1, pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.querySelector('article a').getAttribute('href')).toBe('/properties');
    fixture.componentInstance.markRead(notice);
    const write = http.expectOne('/api/v1/notifications/notice/read'); expect(write.request.method).toBe('PATCH'); expect(write.request.body).toEqual({}); write.flush({});
    http.expectOne((r) => r.url === '/api/v1/notifications').flush({ data: [{ ...notice, readAt: notice.createdAt }], unreadCount: 0, pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('0 unread'); http.verify();
  });
  it('shows a retryable server error and filters unread items at the API', () => {
    const fixture = TestBed.createComponent(NotificationsPage), http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url === '/api/v1/notifications').flush({}, { status: 503, statusText: 'Unavailable' }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Something went wrong');
    fixture.componentInstance.unreadOnly.set(true); fixture.componentInstance.load();
    const read = http.expectOne((r) => r.url === '/api/v1/notifications'); expect(read.request.params.get('unreadOnly')).toBe('true');
    read.flush({ data: [], unreadCount: 0, pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('all caught up'); http.verify();
  });
});
