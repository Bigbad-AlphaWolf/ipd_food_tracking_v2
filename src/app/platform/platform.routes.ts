import { Routes } from '@angular/router';

export const PLATFORM_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'organizations'
  },
  {
    path: 'organizations',
    loadComponent: () => import('./pages/organizations-management.component').then((m) => m.OrganizationsManagementComponent)
  },
  {
    path: 'users',
    loadComponent: () => import('./pages/platform-users-management.component').then((m) => m.PlatformUsersManagementComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('../employee/pages/profile.component').then((m) => m.ProfileComponent)
  }
];
