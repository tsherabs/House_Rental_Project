import { Component } from '@angular/core';
import { RouterLink, Routes } from '@angular/router';
import { roleGuard } from './core/auth/role.guard';
@Component({
  imports: [RouterLink],
  template: '<h1>Page not found</h1><a routerLink="/properties">Browse homes</a>',
})
class NotFound {}
@Component({ imports: [RouterLink], template: '<h1>Access restricted</h1><p>Your account cannot access this page.</p><a routerLink="/properties">Browse homes</a>' })
class Forbidden {}
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
  { path: 'login', loadComponent: () => import('./features/auth/auth-page').then(m => m.AuthPage) },
  { path: 'register', data: { register: true }, loadComponent: () => import('./features/auth/auth-page').then(m => m.AuthPage) },
  { path: 'forbidden', component: Forbidden },
  { path: '**', component: NotFound },
];
