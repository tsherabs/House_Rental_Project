import { Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Property } from './property';

@Component({
  selector: 'app-property-card',
  imports: [CurrencyPipe, RouterLink],
  template: ` <article class="card">
    @if (property().images.length) {
      <img
        [src]="property().images[0].url"
        [alt]="property().title + ' — photo 1'"
        loading="lazy"
        (error)="hideBroken($event)"
      />
    } @else {
      <div class="no-photo">No photos available</div>
    }
    <div class="card-body">
      <p>{{ property().neighbourhood }} · {{ property().bedrooms }} bedrooms</p>
      <h2>
        <a [routerLink]="['/properties', property().id]" [queryParams]="query()">{{
          property().title
        }}</a>
      </h2>
      <strong>{{ property().monthlyRent | currency: 'BTN' : 'Nu. ' : '1.2-2' }} / month</strong>
      <p>
        Water: {{ property().waterAvailable ? 'Available' : 'Not available' }} · Parking:
        {{ property().parkingAvailable ? 'Available' : 'Not available' }}
      </p>
      <span class="badge">{{ property().availabilityStatus }}</span>
    </div>
  </article>`,
})
export class PropertyCard {
  readonly property = input.required<Property>();
  readonly query = input<Record<string, unknown>>({});
  hideBroken(event: Event) {
    (event.target as HTMLImageElement).hidden = true;
  }
}
