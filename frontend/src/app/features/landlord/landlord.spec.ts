import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LandlordService, PropertyInput } from './landlord.service';
import { PropertyEditor, calendarDate, moneyValidator } from './property-editor';
import { FormControl } from '@angular/forms';
import { PropertyPhotos, validatePhotos } from './property-photos';
import { LandlordDashboard } from './landlord-dashboard';
import { Property } from '../properties/property';

const body: PropertyInput = {
  title: 'Sunny apartment',
  description: 'A sunny apartment in Thimphu.',
  monthlyRent: '18000.00',
  deposit: '18000.00',
  bedrooms: 2,
  neighbourhood: 'Changzamtog',
  landmarks: null,
  waterAvailable: true,
  parkingAvailable: false,
  moveInDate: '2020-01-01',
};
const home: Property = {
  ...body,
  id: 'home-1',
  availabilityStatus: 'available',
  visibilityStatus: 'published',
  confirmedAt: null,
  expiresAt: null,
  images: [],
  createdAt: '2026-10-20T00:00:00Z',
  updatedAt: '2026-10-20T00:00:00Z',
};

describe('Landlord property integration', () => {
  let http: HttpTestingController;
  let api: LandlordService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'my-properties', component: LandlordDashboard },
          { path: 'my-properties/new', component: PropertyEditor },
          { path: 'my-properties/:id/edit', component: PropertyEditor },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(LandlordService);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });
  it('uses management reads, pagination, cookie credentials and exact mutation bodies', () => {
    api.list(2).subscribe();
    const list = http.expectOne('/api/v1/my/properties?page=2&limit=12');
    expect(list.request.withCredentials).toBe(true);
    list.flush({ data: [] });
    api.update(home.id, { title: body.title }).subscribe();
    const update = http.expectOne('/api/v1/properties/home-1');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ title: body.title });
    update.flush({ property: home });
    api.availability(home.id, 'rented').subscribe();
    const status = http.expectOne('/api/v1/properties/home-1/availability');
    expect(status.request.body).toEqual({ availabilityStatus: 'rented' });
    status.flush({ property: home });
  });
  it('rejects invalid amounts and invalid calendar dates but accepts persisted past dates', () => {
    for (const value of ['-1', '01.00', '1.234', '10000000000', 'NaN'])
      expect(moneyValidator(new FormControl(value))).not.toBeNull();
    expect(moneyValidator(new FormControl('0.00'))).toBeNull();
    expect(calendarDate(new FormControl('2026-02-30'))).not.toBeNull();
    expect(calendarDate(new FormControl('2020-01-01'))).toBeNull();
  });
  it('loads private details and saves only mutable fields as decimal strings', async () => {
    const harness = await RouterTestingHarness.create();
    const editor = await harness.navigateByUrl('/my-properties/home-1/edit', PropertyEditor);
    http.expectOne('/api/v1/my/properties/home-1').flush({ property: home });
    harness.detectChanges();
    editor.form.controls.title.setValue('Updated sunny home');
    editor.save();
    const update = http.expectOne('/api/v1/properties/home-1');
    expect(update.request.body).toEqual({ ...body, title: 'Updated sunny home', landmarks: null });
    expect(update.request.body.ownerId).toBeUndefined();
    expect(update.request.body.images).toBeUndefined();
    update.flush({ property: { ...home, title: 'Updated sunny home' } });
    expect(editor.notice()).toContain('Property saved');
  });
  it('blocks invalid and archived property edits', async () => {
    const harness = await RouterTestingHarness.create();
    const editor = await harness.navigateByUrl('/my-properties/new', PropertyEditor);
    editor.save();
    http.expectNone('/api/v1/properties');
    const archivedEditor = await harness.navigateByUrl(
      '/my-properties/home-1/edit',
      PropertyEditor,
    );
    http
      .expectOne('/api/v1/my/properties/home-1')
      .flush({ property: { ...home, visibilityStatus: 'archived' } });
    archivedEditor.save();
    http.expectNone('/api/v1/properties/home-1');
    expect(archivedEditor.archived()).toBe(true);
  });
  it('requires confirmation before archive and refreshes the canonical list', async () => {
    const harness = await RouterTestingHarness.create();
    const dashboard = await harness.navigateByUrl('/my-properties', LandlordDashboard);
    const page = { data: [home], pagination: { page: 1, limit: 12, total: 1, totalPages: 1 } };
    http.expectOne('/api/v1/my/properties?page=1&limit=12').flush(page);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    dashboard.archive(home);
    http.expectNone('/api/v1/properties/home-1');
    confirm.mockReturnValue(true);
    dashboard.archive(home);
    const remove = http.expectOne('/api/v1/properties/home-1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne('/api/v1/my/properties?page=1&limit=12')
      .flush({ ...page, data: [{ ...home, visibilityStatus: 'archived' }] });
    expect(dashboard.notice()).toBe('Property archived.');
  });
  it('checks upload types, sizes and total photo count', () => {
    const png = new File(['image'], 'photo.png', { type: 'image/png' });
    expect(validatePhotos([png], 7)).toBeNull();
    expect(validatePhotos([png], 8)).toContain('8');
    expect(
      validatePhotos([new File(['<svg/>'], 'photo.svg', { type: 'image/svg+xml' })], 0),
    ).toContain('JPEG');
    expect(
      validatePhotos(
        [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })],
        0,
      ),
    ).toContain('5 MiB');
  });
  it('uploads multipart using images without overriding the content type', () => {
    const file = new File(['image'], 'photo.png', { type: 'image/png' });
    api.upload(home.id, [file]).subscribe();
    const request = http.expectOne('/api/v1/properties/home-1/images');
    expect(request.request.body.getAll('images')).toEqual([file]);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    expect(request.request.reportProgress).toBe(true);
    request.flush({ images: [] });
  });
  it('reorders the complete image set and refreshes server images', async () => {
    const fixture = TestBed.createComponent(PropertyPhotos);
    fixture.componentRef.setInput('propertyId', home.id);
    const images = [
      { id: 'one', url: '/one', displayOrder: 0 },
      { id: 'two', url: '/two', displayOrder: 1 },
    ];
    fixture.componentRef.setInput('images', images);
    fixture.detectChanges();
    const changed = vi.fn();
    fixture.componentInstance.imagesChange.subscribe(changed);
    fixture.componentInstance.move(1, -1);
    const request = http.expectOne('/api/v1/properties/home-1/images/order');
    expect(request.request.body).toEqual({ imageIds: ['two', 'one'] });
    request.flush({ images: [] });
    http
      .expectOne('/api/v1/my/properties/home-1')
      .flush({ property: { ...home, images: [...images].reverse() } });
    expect(changed).toHaveBeenCalledWith([...images].reverse());
  });
});
