import { Component, input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Failure } from '../core/api';

@Component({
  selector: 'app-form-feedback',
  template: `
    @if (failure(); as error) {
      <div role="alert">
        <p>{{ error.message }}</p>
        @for (detail of error.details; track $index) {
          <p>{{ detail.field }}: {{ detail.message }}</p>
        }
      </div>
    }
    @if (errors().length) {
      <div role="alert">
        <p>Please correct these fields:</p>
        <ul>
          @for (error of errors(); track error) {
            <li>{{ error }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class FormFeedback {
  readonly form = input.required<FormGroup>();
  readonly failure = input<Failure | null>(null);
  readonly labels = input<Record<string, string>>({});
  errors() {
    return Object.entries(this.form().controls)
      .filter(([, control]) => control.touched && control.invalid)
      .map(([name, control]) => {
        const label = this.labels()[name] ?? name;
        if (control.hasError('required')) return `${label} is required.`;
        if (control.hasError('minlength'))
          return `${label} needs at least ${control.errors!['minlength'].requiredLength} characters.`;
        if (control.hasError('maxlength')) return `${label} is too long.`;
        if (control.hasError('email')) return 'Enter a valid email address.';
        if (control.hasError('passwordBytes')) return 'Password must be at most 72 UTF-8 bytes.';
        if (control.hasError('server')) return `${label}: ${control.errors!['server']}`;
        return `Check ${label}.`;
      });
  }
}
