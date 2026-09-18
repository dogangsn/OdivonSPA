import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';

async function waitUntilAuthReady(auth: AuthService): Promise<void> {
  if (auth.isReady()) return;
  await firstValueFrom(toObservable(auth.isReady).pipe(filter((ready) => ready)));
}

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitUntilAuthReady(auth);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }
  if (!auth.tenantId()) {
    // Signed in but no tenant/role claims yet (e.g. mid-onboarding).
    return router.createUrlTree(['/auth/onboarding']);
  }
  return true;
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitUntilAuthReady(auth);

  if (auth.isAuthenticated() && auth.tenantId()) {
    return router.createUrlTree(['/panel']);
  }
  return true;
};
