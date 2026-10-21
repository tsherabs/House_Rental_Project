import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { ComparisonService } from './features/properties/comparison.service';
@Component({ selector: 'app-root', imports: [RouterLink, RouterOutlet], templateUrl: './app.html' })
export class App {
  readonly compare = inject(ComparisonService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly signingOut = signal(false);
  readonly logoutError = signal('');
  logout() {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.logoutError.set('');
    this.auth
      .logout()
      .pipe(finalize(() => this.signingOut.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/login']),
        error: (error) => {
          if (error.status === 401) {
            this.auth.clear();
            void this.router.navigate(['/login']);
          } else if (error.status === 403) {
            this.auth.refresh().subscribe((user) => {
              if (!user) void this.router.navigate(['/login']);
              else this.logoutError.set('Could not sign out. Please try again.');
            });
          } else this.logoutError.set('Could not sign out. Please try again.');
        },
      });
  }
}
