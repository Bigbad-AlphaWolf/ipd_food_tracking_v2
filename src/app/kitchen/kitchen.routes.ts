import { Routes } from '@angular/router';

export const KITCHEN_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/kitchen-dashboard.component').then((m) => m.KitchenDashboardComponent)
  },
  {
    // Shared with employee/platform — a meal coordinator's profile is the same read-only view.
    path: 'profile',
    loadComponent: () => import('../employee/pages/profile.component').then((m) => m.ProfileComponent)
  }
];
