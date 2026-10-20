import { Component } from '@angular/core';
import { RouterLink, Routes } from '@angular/router';
@Component({
  imports: [RouterLink],
  template: '<h1>Page not found</h1><a routerLink="/properties">Browse homes</a>',
})
class NotFound {}
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'properties' },
  {
    path: 'properties',
    loadComponent: () => import('./features/properties/property-list').then((m) => m.PropertyList),
  },
  {
    path: 'properties/:id',
    loadComponent: () =>
      import('./features/properties/property-detail').then((m) => m.PropertyDetail),
  },
  { path: '**', component: NotFound },
];
