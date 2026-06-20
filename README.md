# Food Tracker

Food Tracker is a responsive Angular 20 application for employee meal voting and admin meal operations. It uses standalone components, PrimeNG, PrimeFlex, Supabase Auth, and PostgreSQL with Row Level Security.

## Stack

- Angular 20 with standalone components and lazy-loaded route trees
- TypeScript everywhere
- PrimeNG 20, PrimeFlex 4, PrimeIcons 7
- Supabase Auth and PostgreSQL
- Angular Signals for UI state
- Reactive Forms for login and admin CRUD flows

## Delivered Features

- Email/password and phone/password login
- Role-based access for `admin` and `employee`
- Employee dashboard, today's survey, monthly history, and profile
- Admin dashboard, meals CRUD, surveys CRUD, user role management, and monthly reports
- CSV and Excel report export
- Centralized error handling, toast notifications, loading overlays, dark mode, and responsive navigation
- Supabase SQL migration with RLS policies and reporting RPCs
- Docker and Nginx deployment files

## Project Structure

```text
src/app/
	admin/
	auth/
	core/
	employee/
	layout/
	shared/
src/environments/
supabase/migrations/
```

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Create your local env file from [/.env.example](/Users/makdiop/Documents/IPD_PROJECTS/POC_IPD_FOOD_TRACKING_V2/.env.example).

```bash
cp .env.example .env
```

3. Update `.env` with your Supabase values. Scripts automatically sync [src/environments/environment.ts](/Users/makdiop/Documents/IPD_PROJECTS/POC_IPD_FOOD_TRACKING_V2/src/environments/environment.ts) and [src/environments/environment.prod.ts](/Users/makdiop/Documents/IPD_PROJECTS/POC_IPD_FOOD_TRACKING_V2/src/environments/environment.prod.ts).

4. Apply the database migration in Supabase SQL editor using [supabase/migrations/20260620_000001_food_tracker_schema.sql](/Users/makdiop/Documents/IPD_PROJECTS/POC_IPD_FOOD_TRACKING_V2/supabase/migrations/20260620_000001_food_tracker_schema.sql).

5. Create Auth users in Supabase. The migration includes a trigger that provisions matching profiles rows.

6. Start the application.

```bash
npm start
```

## Supabase Notes

- `profiles.role` controls route access.
- `resolve_auth_identifier` maps phone numbers to emails for login.
- `get_admin_dashboard_metrics` returns KPI and trend data for the admin dashboard.
- `get_monthly_report` returns export-ready report rows.

## Commands

```bash
npm start
npm run build
npm test
```

## Deployment

### Docker

Build the production image with Supabase values injected at build time:

```bash
docker build \
	--build-arg SUPABASE_URL=https://your-project-ref.supabase.co \
	--build-arg SUPABASE_ANON_KEY=your-anon-key \
	-t food-tracker .
```

Run it:

```bash
docker run -p 8080:80 food-tracker
```

### Nginx

[nginx.conf](/Users/makdiop/Documents/IPD_PROJECTS/POC_IPD_FOOD_TRACKING_V2/nginx.conf) enables SPA fallback, gzip, and static asset caching.

## Tests

Core service unit tests are included in:

- [src/app/core/services/loading.service.spec.ts](/Users/makdiop/Documents/IPD_PROJECTS/POC_IPD_FOOD_TRACKING_V2/src/app/core/services/loading.service.spec.ts)
- [src/app/core/services/theme.service.spec.ts](/Users/makdiop/Documents/IPD_PROJECTS/POC_IPD_FOOD_TRACKING_V2/src/app/core/services/theme.service.spec.ts)
- [src/app/core/services/auth.service.spec.ts](/Users/makdiop/Documents/IPD_PROJECTS/POC_IPD_FOOD_TRACKING_V2/src/app/core/services/auth.service.spec.ts)
