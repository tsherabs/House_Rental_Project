import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { sessionInterceptor } from './core/auth/session.interceptor';
import { routes } from './app.routes';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withXhr(), withInterceptors([sessionInterceptor])),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideAppInitializer(() => firstValueFrom(inject(AuthService).refresh())),
  ],
};
