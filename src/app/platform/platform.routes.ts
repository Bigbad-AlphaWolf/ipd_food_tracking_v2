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
    // Meals are a single shared catalog (not org-scoped), so the exact same
    // component org admins use works unchanged for platform admins too.
    path: 'meals',
    loadComponent: () => import('../admin/pages/meals-management.component').then((m) => m.MealsManagementComponent)
  },
  {
    path: 'surveys',
    loadComponent: () => import('./pages/platform-surveys-management.component').then((m) => m.PlatformSurveysManagementComponent)
  },
  {
    path: 'reports',
    loadComponent: () => import('./pages/platform-reports.component').then((m) => m.PlatformReportsComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('../employee/pages/profile.component').then((m) => m.ProfileComponent)
  }
];
