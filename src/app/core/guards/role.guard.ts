import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AppRole } from '../models/app.models';
import { AuthService } from '../services/auth.service';

export const roleGuard = (...roles: AppRole[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.hasAnyRole(roles)) {
      return true;
    }

    return router.createUrlTree([authService.homeRoute()]);
  };
};
