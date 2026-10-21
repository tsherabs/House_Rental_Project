import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ComparisonService } from './comparison.service';
import { ComparisonPage } from './comparison-page';
import { MoveInCost, moveInTotal } from './move-in-cost';
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004'];
describe('Home planning', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  it('limits comparison to three, removes selections, and stores only identifiers', () => {
    const service = new ComparisonService();
    ids.forEach((id) => service.toggle(id));
    expect(service.ids()).toEqual(ids.slice(0, 3));
    service.toggle(ids[0]);
    expect(new ComparisonService().ids()).toEqual(ids.slice(1, 3));
  });
  it('rejects corrupt storage and invalid entries', () => {
    localStorage.setItem('homefinder.compare.v1', '{');
    expect(new ComparisonService().ids()).toEqual([]);
    localStorage.setItem('homefinder.compare.v1', JSON.stringify([ids[0], ids[0], null, 'https://evil.test', ...ids]));
    expect(new ComparisonService().ids()).toEqual(ids.slice(0, 3));
  });
  it('calculates decimal money exactly and rejects malformed or negative estimates', () => {
    expect(moveInTotal('0.10', '0.20', 1, '0.01', '0.02')).toBe('0.33');
    expect(moveInTotal('18000.00', '18000.00', 2, '1500', '300.25')).toBe('55800.25');
    expect(moveInTotal('9999999999.99', '9999999999.99', 12, '9999999999.99', '9999999999.99')).toBe('149999999999.85');
    for (const invalid of ['-1', 'NaN', '1e3', '', '1.001', '10000000000']) expect(moveInTotal('100', '200', 1, invalid, '0')).toBeNull();
    for (const months of [0, 13, 1.5, NaN]) expect(moveInTotal('100', '200', months, '0', '0')).toBeNull();
  });
  it('updates the estimate when form values or the selected property change', () => {
    const fixture = TestBed.createComponent(MoveInCost);
    fixture.componentRef.setInput('rent', '100.00'); fixture.componentRef.setInput('deposit', '200.00'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('300.00');
    fixture.componentInstance.form.patchValue({ moving: '0.25', months: 2 }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('400.25');
    fixture.componentRef.setInput('rent', '150.00'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('500.25');
  });
  it('revalidates selections and does not display inaccessible listing details', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(ComparisonService), http = TestBed.inject(HttpTestingController);
    service.toggle(ids[0]); service.toggle(ids[1]);
    const fixture = TestBed.createComponent(ComparisonPage); fixture.detectChanges();
    http.expectOne(`/api/v1/properties/${ids[0]}`).flush({ property: { id: ids[0], title: 'Public home', monthlyRent: '100.00', deposit: '200.00', images: [], moveInDate: '2026-11-01' } });
    http.expectOne(`/api/v1/properties/${ids[1]}`).flush({}, { status: 404, statusText: 'Not Found' }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Public home');
    expect(fixture.nativeElement.textContent).toContain('no longer available');
    fixture.componentInstance.refresh(); fixture.detectChanges();
    ids.slice(0, 2).forEach((id) => http.expectOne(`/api/v1/properties/${id}`).flush({}, { status: 404, statusText: 'Not Found' })); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Public home'); http.verify();
  });
});
