import { Component, computed, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { CurrencyPipe } from '@angular/common';

export function minorUnits(value: string): number | null {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function moveInTotal(rent: string, deposit: string, months: number, moving: string, utilities: string): string | null {
  const amounts = [rent, deposit, moving, utilities].map(minorUnits);
  if (amounts.some((amount) => amount === null) || !Number.isInteger(months) || months < 1 || months > 12) return null;
  const [r, d, m, u] = amounts as number[];
  const total = r * months + d + m + u;
  return `${Math.floor(total / 100)}.${String(total % 100).padStart(2, '0')}`;
}
@Component({
  selector: 'app-move-in-cost', imports: [ReactiveFormsModule, CurrencyPipe],
  template: `<section class="cost-planner" aria-labelledby="cost-title">
    <h2 id="cost-title">Plan your move-in budget</h2>
    <p>Start with the listed rent and deposit, then add your own estimates. Confirm all charges with the landlord.</p>
    <form [formGroup]="form" class="stack" (submit)="$event.preventDefault()">
      <label>Months of rent to budget
        <select formControlName="months">@for (month of months; track month) { <option [ngValue]="month">{{ month }}</option> }</select>
      </label>
      <label>Moving estimate (Nu.)<input formControlName="moving" inputmode="decimal" maxlength="13" aria-describedby="cost-help" /></label>
      <label>Utility setup estimate (Nu.)<input formControlName="utilities" inputmode="decimal" maxlength="13" aria-describedby="cost-help" /></label>
      <small id="cost-help">Use non-negative amounts with up to two decimal places. Estimates stay on this page.</small>
    </form>
    @if (total(); as amount) {
      <p class="budget-total" role="status">Estimated upfront budget <strong>{{ amount | currency: 'BTN' : 'Nu. ' : '1.2-2' }}</strong></p>
      <small>Includes {{ values().months }} month(s) of rent, the listed deposit and your estimates. This is a planning tool; no payment is taken.</small>
    } @else { <p role="alert">Enter valid amounts using digits and an optional decimal point.</p> }
  </section>`,
})
export class MoveInCost {
  readonly rent = input.required<string>();
  readonly deposit = input.required<string>();
  readonly months = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly form = new FormGroup({ months: new FormControl(1, { nonNullable: true }), moving: new FormControl('0.00', { nonNullable: true }), utilities: new FormControl('0.00', { nonNullable: true }) });
  readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), { requireSync: true });
  readonly total = computed(() => {
    const values = this.values();
    return moveInTotal(this.rent(), this.deposit(), values.months ?? 1, values.moving ?? '', values.utilities ?? '');
  });
}
