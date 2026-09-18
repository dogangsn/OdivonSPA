import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StaffRole } from '../models';
import { AuthService } from '../auth/auth.service';

/** Usage in routes: `canActivate: [roleGuard(['admin'])]`. Assumes authGuard already ran on the parent route. */
export function roleGuard(allowedRoles: StaffRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const role = auth.role();
    if (role && allowedRoles.includes(role)) {
      return true;
    }
    return router.createUrlTree(['/panel']);
  };
}
