import { Routes } from '@angular/router';

export const EMPLOYEE_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/employee-dashboard.component').then((m) => m.EmployeeDashboardComponent)
  },
  {
    path: 'today-survey',
    loadComponent: () => import('./pages/today-survey.component').then((m) => m.TodaySurveyComponent)
  },
  {
    path: 'history',
    loadComponent: () => import('./pages/history.component').then((m) => m.HistoryComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile.component').then((m) => m.ProfileComponent)
  }
];
