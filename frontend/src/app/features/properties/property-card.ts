import { Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Property } from './property';

@Component({
  selector: 'app-property-card',
  imports: [CurrencyPipe, RouterLink],
  template: ` <article class="card property-card">
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
      <p class="card-location">{{ property().neighbourhood }} · Thimphu</p>
      <h2>
        <a [routerLink]="['/properties', property().id]" [queryParams]="query()">{{
          property().title
        }}</a>
      </h2>
      <p class="card-price">
        <strong>{{ property().monthlyRent | currency: 'BTN' : 'Nu. ' : '1.0-0' }}</strong>
        <span>/ month</span>
      </p>
      <p class="card-facilities">
        {{ property().bedrooms }} bedrooms ·
        {{ property().waterAvailable ? 'Water' : 'No water' }} ·
        {{ property().parkingAvailable ? 'Parking' : 'No parking' }}
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
