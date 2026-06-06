import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const onboardingGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.currentUser();

  if (!user) return true;

  const onOnboardingPage = state.url.startsWith('/onboarding');

  if (!user.onboardingComplete && !onOnboardingPage) {
    return router.createUrlTree(['/onboarding']);
  }
  if (user.onboardingComplete && onOnboardingPage) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
