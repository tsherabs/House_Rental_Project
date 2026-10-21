import { Component } from '@angular/core';
import { RouterLink, Routes } from '@angular/router';
import { roleGuard } from './core/auth/role.guard';
@Component({
  imports: [RouterLink],
  template: '<h1>Page not found</h1><a routerLink="/properties">Browse homes</a>',
})
class NotFound {}
@Component({
  imports: [RouterLink],
  template:
    '<h1>Access restricted</h1><p>Your account cannot access this page.</p><a routerLink="/properties">Browse homes</a>',
})
class Forbidden {}
export const routes: Routes = [
  {
    path: 'viewings',
    canActivate: [roleGuard],
    data: { roles: ['seeker', 'landlord'] },
    loadComponent: () => import('./features/community/viewings-page').then((m) => m.ViewingsPage),
  },
  {
    path: 'favourites',
    canActivate: [roleGuard],
    data: { roles: ['seeker'] },
    loadComponent: () =>
      import('./features/community/favourites-page').then((m) => m.FavouritesPage),
  },
  {
    path: 'admin/reports',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () => import('./features/community/reports-page').then((m) => m.ReportsPage),
  },
  {
    path: 'my-properties/expiring',
    canActivate: [roleGuard],
    data: { roles: ['landlord'] },
    loadComponent: () => import('./features/community/renewals-page').then((m) => m.RenewalsPage),
  },
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
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'register',
    data: { register: true },
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  { path: 'forbidden', component: Forbidden },
  {
    path: 'admin',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () => import('./features/admin/admin-dashboard').then((m) => m.AdminDashboard),
  },
  {
    path: 'admin/users',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () => import('./features/admin/admin-users').then((m) => m.AdminUsers),
  },
  {
    path: 'my-properties',
    canActivate: [roleGuard],
    data: { roles: ['landlord'] },
    loadComponent: () =>
      import('./features/landlord/landlord-dashboard').then((m) => m.LandlordDashboard),
  },
  {
    path: 'my-properties/new',
    canActivate: [roleGuard],
    data: { roles: ['landlord'] },
    loadComponent: () =>
      import('./features/landlord/property-editor').then((m) => m.PropertyEditor),
  },
  {
    path: 'my-properties/:id/edit',
    canActivate: [roleGuard],
    data: { roles: ['landlord'] },
    loadComponent: () =>
      import('./features/landlord/property-editor').then((m) => m.PropertyEditor),
  },
  { path: '**', component: NotFound },
];
