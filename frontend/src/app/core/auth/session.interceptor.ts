import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE } from '../api';
import { AuthService } from './auth.service';

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(API_BASE);
  if (!request.url.startsWith(`${base}/`)) return next(request);
  const auth = inject(AuthService);
  const router = inject(Router);
  const path = request.url.slice(base.length);
  const publicRead = request.method === 'GET' && /^\/(properties(?:\/[^/]+)?|property-images\/[^/]+)$/.test(path);
  const protectedCall = !path.startsWith('/auth/') && !publicRead;
  return next(request.clone({ withCredentials: true })).pipe(catchError(error => {
    if (protectedCall && error.status === 401) {
      auth.clear();
      void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
    }
    if (protectedCall && error.status === 403) {
      return auth.refresh().pipe(switchMap(user => {
        if (!user) void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        return throwError(() => error);
      }));
    }
    return throwError(() => error);
  }));
};
