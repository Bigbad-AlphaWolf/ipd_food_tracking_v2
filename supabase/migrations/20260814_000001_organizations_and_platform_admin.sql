-- Multi-tenant organizations + platform_administrator role.
--
-- Scope (confirmed with product owner):
--   * profiles, daily_surveys, votes, and the admin dashboard/report RPCs become
--     organization-scoped.
--   * meals stay a single shared catalog across all organizations.
--   * platform_administrator is a new role that is NOT tied to any organization
--     (organization_id is null) and bypasses org scoping everywhere.
--   * The existing 'admin' role/key is kept as-is (legacy `role` column + RLS +
--     check constraints untouched) and is only relabeled to "Organization
--     Administrator" in the UI/translations — no data migration needed for it.

-- ============================================================================
-- 1. organizations table
-- ============================================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_code on public.organizations (code);

drop trigger if exists set_organizations_timestamp on public.organizations;
create trigger set_organizations_timestamp
before update on public.organizations
for each row
execute function public.set_timestamp();

-- Seed a default organization so existing admin/employee profiles and surveys
-- have somewhere to land once organization_id becomes required for them.
insert into public.organizations (name, description, code)
values (
  'Default Organization',
  'Auto-created while migrating to multi-tenant organizations. Rename or replace as needed.',
  'DEFAULT'
)
on conflict (code) do nothing;

-- ============================================================================
-- 2. profiles.organization_id
-- ============================================================================

alter table public.profiles
add column if not exists organization_id uuid references public.organizations (id);

create index if not exists idx_profiles_organization on public.profiles (organization_id);

update public.profiles
set organization_id = (select id from public.organizations where code = 'DEFAULT')
where organization_id is null
  and not (roles @> array['platform_administrator']::text[]);

-- Allow the new role in both the array column and the legacy single-role
-- check (the legacy column only ever tracked admin/employee — see the
-- sync trigger below for how platform_administrator maps onto it).
alter table public.profiles drop constraint if exists profiles_roles_allowed;
alter table public.profiles
add constraint profiles_roles_allowed
check (
  cardinality(roles) > 0
  and roles <@ array['admin', 'employee', 'platform_administrator']::text[]
);

-- organization_id is required for admin/employee, and must be null for
-- platform_administrator (a platform admin isn't scoped to any one org).
alter table public.profiles drop constraint if exists profiles_organization_scope;
alter table public.profiles
add constraint profiles_organization_scope
check (
  (roles @> array['platform_administrator']::text[] and organization_id is null)
  or (not (roles @> array['platform_administrator']::text[]) and organization_id is not null)
);

-- ============================================================================
-- 3. daily_surveys.organization_id
-- ============================================================================

alter table public.daily_surveys
add column if not exists organization_id uuid references public.organizations (id);

update public.daily_surveys
set organization_id = (select id from public.organizations where code = 'DEFAULT')
where organization_id is null;

alter table public.daily_surveys
alter column organization_id set not null;

create index if not exists idx_daily_surveys_organization on public.daily_surveys (organization_id);

-- ============================================================================
-- 4. votes.organization_id (denormalized from the survey, for cheap RLS)
-- ============================================================================

alter table public.votes
add column if not exists organization_id uuid references public.organizations (id);

update public.votes v
set organization_id = ds.organization_id
from public.daily_surveys ds
where ds.id = v.survey_id
  and v.organization_id is null;

alter table public.votes
alter column organization_id set not null;

create index if not exists idx_votes_organization on public.votes (organization_id);

create or replace function public.set_vote_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select organization_id into new.organization_id
  from public.daily_surveys
  where id = new.survey_id;

  return new;
end;
$$;

drop trigger if exists set_vote_organization_trigger on public.votes;
create trigger set_vote_organization_trigger
before insert on public.votes
for each row
execute function public.set_vote_organization();

-- ============================================================================
-- 5. Role helper functions
-- ============================================================================

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and roles @> array['platform_administrator']::text[]
      and is_active = true
  );
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.resolve_organization_code(input_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.organizations
  where upper(trim(code)) = upper(trim(input_code))
    and is_active = true
  limit 1;
$$;

grant execute on function public.resolve_organization_code(text) to anon, authenticated;

-- ============================================================================
-- 6. Legacy role sync + new-user provisioning
-- ============================================================================

create or replace function public.sync_profile_role_legacy()
returns trigger
language plpgsql
as $$
begin
  if new.roles is null or cardinality(new.roles) = 0 then
    new.roles := array['employee'];
  end if;

  -- The legacy single-role column predates platform_administrator and only
  -- ever distinguishes "elevated" (admin) from "regular" (employee) access,
  -- so a platform administrator maps onto 'admin' here rather than silently
  -- downgrading to 'employee' for any code still reading the legacy column.
  if new.roles @> array['admin']::text[] or new.roles @> array['platform_administrator']::text[] then
    new.role := 'admin';
  else
    new.role := 'employee';
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_role text := lower(coalesce(new.raw_user_meta_data ->> 'role', 'employee'));
  metadata_roles text[];
  metadata_org_id uuid;
begin
  if metadata_role not in ('admin', 'employee', 'platform_administrator') then
    metadata_role := 'employee';
  end if;

  metadata_roles :=
    case
      when new.raw_user_meta_data ? 'roles' then
        array(
          select lower(value)
          from jsonb_array_elements_text(new.raw_user_meta_data -> 'roles') as value
          where lower(value) in ('admin', 'employee', 'platform_administrator')
        )
      else
        array[metadata_role]
    end;

  if metadata_roles is null or cardinality(metadata_roles) = 0 then
    metadata_roles := array[metadata_role];
  end if;

  metadata_org_id := nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid;

  insert into public.profiles (id, full_name, email, phone_number, department, role, roles, organization_id, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'department',
    case
      when metadata_roles @> array['admin']::text[] or metadata_roles @> array['platform_administrator']::text[] then 'admin'
      else 'employee'
    end,
    metadata_roles,
    case when metadata_roles @> array['platform_administrator']::text[] then null else metadata_org_id end,
    true
  )
  on conflict (id) do update
  set
    email = excluded.email,
    phone_number = excluded.phone_number,
    full_name = excluded.full_name,
    department = excluded.department,
    role = excluded.role,
    roles = excluded.roles,
    organization_id = coalesce(excluded.organization_id, public.profiles.organization_id),
    updated_at = now();

  return new;
end;
$$;

-- ============================================================================
-- 7. Dashboard + report RPCs — organization-scoped, with a cross-org view for
--    platform administrators (their organization_id is null, so "no scope" is
--    the correct behavior for them, not a bug to guard against).
-- ============================================================================

create or replace function public.get_admin_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date := date_trunc('month', current_date)::date;
  month_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  caller_org_id uuid := public.current_organization_id();
  scope_to_org boolean := caller_org_id is not null;
  employee_count integer := 0;
  today_votes integer := 0;
  month_total integer := 0;
  favorite_meal text := 'No data';
  trend jsonb := '[]'::jsonb;
begin
  if not (public.is_admin() or public.is_platform_admin()) then
    raise exception 'insufficient_privilege';
  end if;

  select count(*) into employee_count
  from public.profiles
  where roles @> array['employee']::text[]
    and is_active = true
    and (not scope_to_org or organization_id = caller_org_id);

  select count(*) into today_votes
  from public.votes v
  join public.daily_surveys ds on ds.id = v.survey_id
  where ds.survey_date = current_date
    and (not scope_to_org or ds.organization_id = caller_org_id);

  select count(*) into month_total
  from public.votes v
  join public.daily_surveys ds on ds.id = v.survey_id
  where ds.survey_date between month_start and month_end
    and (not scope_to_org or ds.organization_id = caller_org_id);

  select coalesce(sub.name, 'No data')
  into favorite_meal
  from (
    select m.name, count(*) as total_votes
    from public.votes v
    join public.daily_surveys ds on ds.id = v.survey_id
    join public.meals m on m.id = v.meal_id
    where ds.survey_date between month_start and month_end
      and (not scope_to_org or ds.organization_id = caller_org_id)
    group by m.name
    order by total_votes desc, m.name asc
    limit 1
  ) sub;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', to_char(x.survey_date, 'DD Mon'),
        'value', x.vote_count
      )
      order by x.survey_date
    ),
    '[]'::jsonb
  )
  into trend
  from (
    select ds.survey_date, count(v.id) as vote_count
    from public.daily_surveys ds
    left join public.votes v on v.survey_id = ds.id
    where ds.survey_date between month_start and month_end
      and (not scope_to_org or ds.organization_id = caller_org_id)
    group by ds.survey_date
  ) x;

  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'participationRate', case when employee_count = 0 then 0 else round((today_votes::numeric / employee_count::numeric) * 100, 2) end,
      'totalMealsThisMonth', month_total,
      'mostPopularMeal', favorite_meal,
      'votesToday', today_votes,
      'eligibleEmployees', employee_count
    ),
    'trend', trend
  );
end;
$$;

-- NOTE: the previous version of get_monthly_report had no privilege check at
-- all — despite being security definer (bypassing RLS), any authenticated
-- user could call it and read every employee's vote history. Fixed here
-- alongside the org-scoping change.
create or replace function public.get_monthly_report(
  report_month integer,
  report_year integer,
  employee_search text default null,
  organization_id_filter uuid default null
)
returns table (
  "employeeName" text,
  email text,
  department text,
  month text,
  "totalVotes" integer,
  "favoriteMeal" text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_platform_admin boolean := public.is_platform_admin();
  scope_org_id uuid;
begin
  if not (public.is_admin() or caller_is_platform_admin) then
    raise exception 'insufficient_privilege';
  end if;

  -- Non-platform admins are always scoped to their own organization,
  -- regardless of what the caller passes in organization_id_filter.
  scope_org_id := case
    when caller_is_platform_admin then organization_id_filter
    else public.current_organization_id()
  end;

  return query
  with period as (
    select make_date(report_year, report_month, 1) as start_date,
           (make_date(report_year, report_month, 1) + interval '1 month - 1 day')::date as end_date
  ),
  monthly_votes as (
    select
      p.id as profile_id,
      p.full_name,
      p.email,
      coalesce(p.department, 'Unassigned') as department,
      m.name as meal_name,
      count(v.id) as vote_count
    from public.votes v
    join public.daily_surveys ds on ds.id = v.survey_id
    join public.profiles p on p.id = v.user_id
    join public.meals m on m.id = v.meal_id
    cross join period
    where ds.survey_date between period.start_date and period.end_date
      and (scope_org_id is null or ds.organization_id = scope_org_id)
      and (
        employee_search is null
        or p.full_name ilike '%' || employee_search || '%'
        or p.email ilike '%' || employee_search || '%'
      )
    group by p.id, p.full_name, p.email, p.department, m.name
  ),
  ranked as (
    select *, row_number() over (partition by profile_id order by vote_count desc, meal_name asc) as rank_number
    from monthly_votes
  ),
  totals as (
    select profile_id, sum(vote_count)::integer as total_votes
    from monthly_votes
    group by profile_id
  )
  select
    r.full_name as "employeeName",
    r.email,
    r.department,
    to_char(make_date(report_year, report_month, 1), 'Mon YYYY') as month,
    t.total_votes as "totalVotes",
    r.meal_name as "favoriteMeal"
  from ranked r
  join totals t on t.profile_id = r.profile_id
  where r.rank_number = 1
  order by r.full_name;
end;
$$;

grant execute on function public.get_monthly_report(integer, integer, text, uuid) to authenticated;

-- ============================================================================
-- 8. RLS — organizations
-- ============================================================================

alter table public.organizations enable row level security;

drop policy if exists "organizations platform admin full access" on public.organizations;
create policy "organizations platform admin full access"
on public.organizations
for all
to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));

drop policy if exists "organizations member read own" on public.organizations;
create policy "organizations member read own"
on public.organizations
for select
to authenticated
using (id = (select public.current_organization_id()));

-- ============================================================================
-- 9. RLS — profiles (org admin scoped to own org, platform admin unrestricted)
-- ============================================================================

drop policy if exists "profiles admin full access" on public.profiles;

drop policy if exists "profiles platform admin full access" on public.profiles;
create policy "profiles platform admin full access"
on public.profiles
for all
to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));

drop policy if exists "profiles org admin manage own org" on public.profiles;
create policy "profiles org admin manage own org"
on public.profiles
for all
to authenticated
using ((select public.is_admin()) and organization_id = (select public.current_organization_id()))
with check ((select public.is_admin()) and organization_id = (select public.current_organization_id()));

-- "profiles read own" / "profiles update own" are unchanged: self-service
-- reads/updates were already restricted to admin/employee and stay that way,
-- so this migration does not open a path for a user to self-grant
-- platform_administrator.

-- ============================================================================
-- 10. RLS — daily_surveys
-- ============================================================================

drop policy if exists "surveys admin full access" on public.daily_surveys;

drop policy if exists "surveys platform admin full access" on public.daily_surveys;
create policy "surveys platform admin full access"
on public.daily_surveys
for all
to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));

drop policy if exists "surveys org admin manage own org" on public.daily_surveys;
create policy "surveys org admin manage own org"
on public.daily_surveys
for all
to authenticated
using ((select public.is_admin()) and organization_id = (select public.current_organization_id()))
with check ((select public.is_admin()) and organization_id = (select public.current_organization_id()));

drop policy if exists "surveys employee read open" on public.daily_surveys;
create policy "surveys employee read open"
on public.daily_surveys
for select
to authenticated
using (status = 'open' and organization_id = (select public.current_organization_id()));

-- ============================================================================
-- 11. RLS — survey_meals (scoped via the parent survey's organization)
-- ============================================================================

drop policy if exists "survey meals admin full access" on public.survey_meals;

drop policy if exists "survey meals platform admin full access" on public.survey_meals;
create policy "survey meals platform admin full access"
on public.survey_meals
for all
to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));

drop policy if exists "survey meals org admin manage own org" on public.survey_meals;
create policy "survey meals org admin manage own org"
on public.survey_meals
for all
to authenticated
using (
  (select public.is_admin())
  and exists (
    select 1 from public.daily_surveys ds
    where ds.id = survey_id and ds.organization_id = (select public.current_organization_id())
  )
)
with check (
  (select public.is_admin())
  and exists (
    select 1 from public.daily_surveys ds
    where ds.id = survey_id and ds.organization_id = (select public.current_organization_id())
  )
);

drop policy if exists "survey meals employee read open" on public.survey_meals;
create policy "survey meals employee read open"
on public.survey_meals
for select
to authenticated
using (
  exists (
    select 1
    from public.daily_surveys ds
    where ds.id = survey_id
      and ds.status = 'open'
      and ds.organization_id = (select public.current_organization_id())
  )
);

-- ============================================================================
-- 12. RLS — votes
-- ============================================================================

drop policy if exists "votes admin full access" on public.votes;

drop policy if exists "votes platform admin full access" on public.votes;
create policy "votes platform admin full access"
on public.votes
for all
to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));

drop policy if exists "votes org admin manage own org" on public.votes;
create policy "votes org admin manage own org"
on public.votes
for all
to authenticated
using ((select public.is_admin()) and organization_id = (select public.current_organization_id()))
with check ((select public.is_admin()) and organization_id = (select public.current_organization_id()));

-- "votes employee read own" is unchanged (auth.uid() = user_id already implies
-- the caller's own organization).

drop policy if exists "votes employee create own" on public.votes;
create policy "votes employee create own"
on public.votes
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.daily_surveys ds
    where ds.id = survey_id
      and ds.status = 'open'
      and ds.organization_id = (select public.current_organization_id())
  )
  and exists (
    select 1
    from public.survey_meals sm
    where sm.survey_id = survey_id
      and sm.meal_id = meal_id
  )
);

-- meals table intentionally untouched: it stays a single shared catalog
-- across every organization, per product decision.
