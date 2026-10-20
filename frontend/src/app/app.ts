import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
@Component({ selector: 'app-root', imports: [RouterLink, RouterOutlet], templateUrl: './app.html' })
export class App {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly signingOut = signal(false);
  readonly logoutError = signal('');
  logout() {
    if (this.signingOut()) return;
    this.signingOut.set(true); this.logoutError.set('');
    this.auth.logout().pipe(finalize(() => this.signingOut.set(false))).subscribe({
      next: () => void this.router.navigate(['/login']),
      error: error => {
        if ([401, 403].includes(error.status)) { this.auth.clear(); void this.router.navigate(['/login']); }
        else this.logoutError.set('Could not sign out. Please try again.');
      },
    });
  }
}
