import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

const PUBLIC_PATH_PREFIXES = ['/api/auth/login', '/api/auth/register', '/api/health', '/api/test/'];

// Paths owned by Spring Boot (not proxied to Express). A 401 from these means
// the user's session is genuinely invalid. 401 from other (legacy/proxied)
// paths is treated as a per-request failure and surfaced to the caller.
const AUTH_OWNED_PREFIXES = ['/api/auth/', '/api/users/me'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const isPublic = PUBLIC_PATH_PREFIXES.some(p => req.url.startsWith(p));
  const token = localStorage.getItem('timixa_token');

  const authedReq =
    token && !isPublic
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authedReq).pipe(
    catchError(err => {
      const isAuthOwned = AUTH_OWNED_PREFIXES.some(p => req.url.startsWith(p));
      if (err.status === 401 && !isPublic && isAuthOwned) {
        localStorage.removeItem('timixa_token');
        router.navigate(['/auth/login']);
      }
      return throwError(() => err);
    }),
  );
};
