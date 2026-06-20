import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/admin-dashboard.component').then((m) => m.AdminDashboardComponent)
  },
  {
    path: 'meals',
    loadComponent: () => import('./pages/meals-management.component').then((m) => m.MealsManagementComponent)
  },
  {
    path: 'surveys',
    loadComponent: () => import('./pages/surveys-management.component').then((m) => m.SurveysManagementComponent)
  },
  {
    path: 'users',
    loadComponent: () => import('./pages/users-management.component').then((m) => m.UsersManagementComponent)
  },
  {
    path: 'reports',
    loadComponent: () => import('./pages/reports.component').then((m) => m.ReportsComponent)
  }
];
