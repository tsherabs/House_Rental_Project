import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService, Role } from './auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.refresh().pipe(
    map((user) => {
      if (!user) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
      const roles = route.data['roles'] as Role[];
      return roles.includes(user.role) || router.createUrlTree(['/forbidden']);
    }),
  );
};
