import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  imports: [RouterLink],
  template: `
    <header>
      <p class="eyebrow">ADMINISTRATION</p>
      <h1>Administrator dashboard</h1>
      <p>Manage account access and review platform activity.</p>
    </header>
    <section class="card card-body">
      <h2>User accounts</h2>
      <p>Filter users, suspend or reactivate accounts, and record the reason for each change.</p>
      <a routerLink="/admin/users">Manage user accounts</a>
    </section>
  `,
})
export class AdminDashboard {}
