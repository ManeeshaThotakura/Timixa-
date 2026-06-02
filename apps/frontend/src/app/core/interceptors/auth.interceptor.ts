import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/push/public-key'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const isPublic = PUBLIC_PATHS.some(p => req.url.includes(p));
  const token = localStorage.getItem('timixa_token');

  const authedReq =
    token && !isPublic
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authedReq).pipe(
    catchError(err => {
      if (err.status === 401 && !isPublic) {
        localStorage.removeItem('timixa_token');
        localStorage.removeItem('timixa_user');
        router.navigate(['/auth/login']);
      }
      return throwError(() => err);
    }),
  );
};
