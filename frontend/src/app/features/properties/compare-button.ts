import { Component, inject, input } from '@angular/core';
import { ComparisonService } from './comparison.service';
@Component({
  selector: 'app-compare-button',
  template: `<button type="button" class="secondary" [attr.aria-pressed]="selected()"
    [attr.aria-label]="(selected() ? 'Remove from comparison: ' : 'Compare: ') + title()"
    [disabled]="!selected() && compare.ids().length >= 3" (click)="compare.toggle(propertyId())">
    {{ selected() ? '✓ Added to compare' : compare.ids().length >= 3 ? 'Comparison full (3)' : 'Compare home' }}
  </button>`,
})
export class CompareButton {
  readonly propertyId = input.required<string>();
  readonly title = input.required<string>();
  readonly compare = inject(ComparisonService);
  selected() { return this.compare.ids().includes(this.propertyId()); }
}
