import { Component, inject, input, OnDestroy, output, signal } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { filter, finalize, switchMap, tap } from 'rxjs';
import { Failure, failureFrom } from '../../core/api';
import { PropertyImage } from '../properties/property';
import { LandlordService } from './landlord.service';

export function validatePhotos(files: File[], existing: number): string | null {
  if (!files.length) return 'Choose at least one image.';
  if (existing + files.length > 8) return 'A property can have at most 8 photos.';
  if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) return 'Choose JPEG, PNG or WebP images only.';
  if (files.some(file => file.size <= 0 || file.size > 5 * 1024 * 1024)) return 'Each image must contain data and be at most 5 MiB.';
  return null;
}
@Component({ selector: 'app-property-photos', styleUrl: './property-photos.css', template: `
  <section aria-label="Property photo management"><h2>Property photos</h2><p>JPEG, PNG or WebP, up to 5 MiB each. Maximum 8 photos including existing images.</p>
  <p>The server also checks image content and may enforce lower configured limits.</p>
  @if (failure(); as error) { <p role="alert">{{ error.message }}</p><button type="button" [disabled]="busy()" (click)="refresh()">Refresh photos</button> }
  @if (validation()) { <p role="alert">{{ validation() }}</p> }
  @if (notice()) { <p role="status">{{ notice() }}</p> }
  <ol class="photos">
  @for (image of images(); track image.id; let index = $index) {
    <li><img [src]="image.url" [alt]="'Property photo ' + (index + 1)"><div class="actions">
    <button type="button" [disabled]="busy() || disabled() || index === 0" (click)="move(index, -1)" [attr.aria-label]="'Move photo ' + (index + 1) + ' earlier'">←</button>
    <button type="button" [disabled]="busy() || disabled() || index === images().length - 1" (click)="move(index, 1)" [attr.aria-label]="'Move photo ' + (index + 1) + ' later'">→</button>
    <button type="button" class="secondary" [disabled]="busy() || disabled()" (click)="remove(image.id)">Remove photo {{ index + 1 }}</button></div></li>
  } @empty { <li>No photos uploaded.</li> }</ol>
  <label>Choose photos<input #picker type="file" accept="image/jpeg,image/png,image/webp" multiple [disabled]="busy() || disabled()" (change)="choose($event)"></label>
  <div class="photos">@for (preview of previews(); track preview.url) { <figure><img [src]="preview.url" [alt]="'Preview of ' + preview.name"><figcaption>{{ preview.name }}</figcaption></figure> }</div>
  <button type="button" [disabled]="busy() || disabled() || !previews().length" (click)="upload(picker)">Upload selected photos</button>
  @if (busy()) { <p role="status">{{ uploading() ? 'Uploading photos…' : 'Updating photos…' }}</p>@if (uploading()) { <progress max="100" [attr.value]="progress()" aria-label="Photo upload progress"></progress> } }
  </section>` })
export class PropertyPhotos implements OnDestroy {
  readonly propertyId = input.required<string>(); readonly images = input.required<PropertyImage[]>(); readonly disabled = input(false);
  readonly imagesChange = output<PropertyImage[]>();
  private readonly api = inject(LandlordService);
  private files: File[] = [];
  readonly previews = signal<{ name: string; url: string }[]>([]);
  readonly busy = signal(false); readonly uploading = signal(false); readonly progress = signal<number | null>(null);
  readonly validation = signal(''); readonly failure = signal<Failure | null>(null); readonly notice = signal('');
  private clear() { this.previews().forEach(preview => URL.revokeObjectURL(preview.url)); this.previews.set([]); this.files = []; }
  ngOnDestroy() { this.clear(); }
  choose(event: Event) {
    const picker = event.target as HTMLInputElement;
    this.clear(); this.notice.set(''); this.failure.set(null);
    const files = Array.from(picker.files ?? []);
    if (!files.length) { this.validation.set(''); return; }
    const error = validatePhotos(files, this.images().length); this.validation.set(error ?? '');
    if (error) { picker.value = ''; return; }
    this.files = files; this.previews.set(files.map(file => ({ name: file.name, url: URL.createObjectURL(file) })));
  }
  upload(picker: HTMLInputElement) {
    if (this.busy() || this.disabled()) return;
    const error = validatePhotos(this.files, this.images().length); this.validation.set(error ?? ''); if (error) return;
    this.busy.set(true); this.uploading.set(true); this.progress.set(null); this.failure.set(null); this.notice.set('');
    this.api.upload(this.propertyId(), this.files).pipe(
      tap(event => { if (event.type === HttpEventType.UploadProgress && event.total) this.progress.set(Math.round(event.loaded / event.total * 100)); }),
      filter(event => event.type === HttpEventType.Response),
      tap(() => { this.clear(); picker.value = ''; this.uploading.set(false); }),
      switchMap(() => this.api.get(this.propertyId())),
      finalize(() => { this.busy.set(false); this.uploading.set(false); }),
    ).subscribe({ next: response => { this.imagesChange.emit(response.property.images); this.notice.set('Photos uploaded.'); }, error: error => this.failure.set(failureFrom(error)) });
  }
  refresh() {
    if (this.busy()) return;
    this.busy.set(true); this.failure.set(null);
    this.api.get(this.propertyId()).pipe(finalize(() => this.busy.set(false))).subscribe({ next: response => this.imagesChange.emit(response.property.images), error: error => this.failure.set(failureFrom(error)) });
  }
  remove(imageId: string) {
    if (this.busy() || this.disabled() || !window.confirm('Remove this photo permanently?')) return;
    this.busy.set(true); this.failure.set(null); this.notice.set('');
    this.api.removeImage(this.propertyId(), imageId).pipe(switchMap(() => this.api.get(this.propertyId())), finalize(() => this.busy.set(false))).subscribe({ next: response => { this.imagesChange.emit(response.property.images); this.notice.set('Photo removed.'); }, error: error => this.failure.set(failureFrom(error)) });
  }
  move(index: number, direction: number) {
    if (this.busy() || this.disabled()) return;
    const ids = this.images().map(image => image.id); const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.busy.set(true); this.failure.set(null); this.notice.set('');
    this.api.orderImages(this.propertyId(), ids).pipe(switchMap(() => this.api.get(this.propertyId())), finalize(() => this.busy.set(false))).subscribe({ next: response => { this.imagesChange.emit(response.property.images); this.notice.set('Photo order saved.'); }, error: error => this.failure.set(failureFrom(error)) });
  }
}
