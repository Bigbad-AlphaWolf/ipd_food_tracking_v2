import { Routes } from '@angular/router';
import { authGuard, employeeRegistrationGuard, roleRedirectGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
	{
		path: 'login',
		loadComponent: () => import('./auth/login.component').then((m) => m.LoginComponent)
	},
	{
		path: 'register-employee',
		canActivate: [employeeRegistrationGuard],
		loadComponent: () => import('./auth/employee-registration.component').then((m) => m.EmployeeRegistrationComponent)
	},
	{
		path: '',
		canActivate: [authGuard],
		loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
		children: [
			{
				path: '',
				pathMatch: 'full',
				canActivate: [roleRedirectGuard],
				loadComponent: () => import('./shared/components/route-placeholder.component').then((m) => m.RoutePlaceholderComponent)
			},
			{
				path: 'employee',
				canActivate: [roleGuard('employee', 'admin')],
				loadChildren: () => import('./employee/employee.routes').then((m) => m.EMPLOYEE_ROUTES)
			},
			{
				path: 'admin',
				canActivate: [roleGuard('admin')],
				loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES)
			},
			{
				path: 'platform',
				canActivate: [roleGuard('platform_administrator')],
				loadChildren: () => import('./platform/platform.routes').then((m) => m.PLATFORM_ROUTES)
			}
		]
	},
	{
		path: '**',
		redirectTo: ''
	}
];
