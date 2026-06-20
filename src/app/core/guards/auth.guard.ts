import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ready();

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { redirectTo: state.url }
  });
};

export const roleRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const target = authService.hasRole('admin') ? '/admin/dashboard' : '/employee/dashboard';
  return router.createUrlTree([target]);
};

export const employeeRegistrationGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ready();

  if (!authService.isAuthenticated()) {
    return true;
  }

  if (authService.hasRole('employee')) {
    return true;
  }

  return router.createUrlTree(['/admin/dashboard']);
};
