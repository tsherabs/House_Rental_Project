import { Injectable, signal } from '@angular/core';

const key = 'homefinder.compare.v1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
@Injectable({ providedIn: 'root' })
export class ComparisonService {
  private readonly selected = signal<string[]>(this.restore());
  readonly ids = this.selected.asReadonly();
  private restore(): string[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(value)
        ? [...new Set(value.filter((id): id is string => typeof id === 'string' && uuid.test(id)))].slice(0, 3)
        : [];
    } catch { return []; }
  }
  toggle(id: string) {
    if (!uuid.test(id)) return;
    const current = this.ids();
    if (!current.includes(id) && current.length >= 3) return;
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    this.selected.set(next);
    // Only public identifiers persist; details are always reloaded from the API.
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Memory-only in restricted browsers. */ }
  }
}
