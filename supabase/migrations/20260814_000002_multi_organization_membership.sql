-- Multi-organization membership.
--
-- A user (admin or employee) can now belong to several organizations.
-- profiles.organization_id is renamed to active_organization_id: it stops
-- meaning "the org this user belongs to" and starts meaning "which of this
-- user's organizations is currently selected." Actual membership moves to a
-- new organization_members join table.
--
-- Every existing RLS policy on daily_surveys/survey_meals/votes/profiles
-- scopes through current_organization_id() rather than the raw column, so
-- repointing that one function at the renamed column re-scopes the whole
-- dashboard (surveys, votes, reports, user visibility) to whichever
-- organization is active — no other policy needs to change.

-- ============================================================================
-- 1. organization_members (many-to-many)
-- ============================================================================

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, organization_id)
);

-- (profile_id, organization_id) above covers "my organizations" lookups and
-- exact-pair checks; organization_id also needs its own index for "members
-- of this organization" lookups (platform admin's org filter).
create index if not exists idx_organization_members_organization on public.organization_members (organization_id);

-- Backfill one membership row per profile that currently has an organization.
insert into public.organization_members (organization_id, profile_id)
select organization_id, id
from public.profiles
where organization_id is not null
on conflict (profile_id, organization_id) do nothing;

-- ============================================================================
-- 2. profiles.organization_id -> profiles.active_organization_id
-- ============================================================================

alter table public.profiles rename column organization_id to active_organization_id;
alter index if exists idx_profiles_organization rename to idx_profiles_active_organization;

alter table public.profiles drop constraint if exists profiles_organization_scope;
alter table public.profiles
add constraint profiles_organization_scope
check (
  (roles @> array['platform_administrator']::text[] and active_organization_id is null)
  or (not (roles @> array['platform_administrator']::text[]) and active_organization_id is not null)
);

-- ============================================================================
-- 3. current_organization_id() now reads the renamed column — every RLS
--    policy that calls it is unaffected by this migration.
-- ============================================================================

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select active_organization_id
  from public.profiles
  where id = auth.uid();
$$;

-- ============================================================================
-- 4. Switch the active organization (validates membership first)
-- ============================================================================

create or replace function public.switch_active_organization(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and profile_id = auth.uid()
  ) then
    raise exception 'not_a_member_of_organization';
  end if;

  update public.profiles
  set active_organization_id = target_organization_id
  where id = auth.uid();
end;
$$;

grant execute on function public.switch_active_organization(uuid) to authenticated;

-- ============================================================================
-- 5. handle_new_user() — accept multiple organization codes/ids at signup
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_role text := lower(coalesce(new.raw_user_meta_data ->> 'role', 'employee'));
  metadata_roles text[];
  metadata_org_ids uuid[];
  first_org_id uuid;
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

  metadata_org_ids :=
    case
      when new.raw_user_meta_data ? 'organization_ids' then
        array(
          select (value)::uuid
          from jsonb_array_elements_text(new.raw_user_meta_data -> 'organization_ids') as value
        )
      else
        array[]::uuid[]
    end;

  first_org_id := metadata_org_ids[1];

  insert into public.profiles (id, full_name, email, phone_number, department, role, roles, active_organization_id, is_active)
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
    case when metadata_roles @> array['platform_administrator']::text[] then null else first_org_id end,
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
    active_organization_id = coalesce(excluded.active_organization_id, public.profiles.active_organization_id),
    updated_at = now();

  if not (metadata_roles @> array['platform_administrator']::text[]) and metadata_org_ids is not null then
    insert into public.organization_members (organization_id, profile_id)
    select org_id, new.id
    from unnest(metadata_org_ids) as org_id
    on conflict (profile_id, organization_id) do nothing;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 6. RLS — organization_members
-- ============================================================================

alter table public.organization_members enable row level security;

drop policy if exists "organization members platform admin full access" on public.organization_members;
create policy "organization members platform admin full access"
on public.organization_members
for all
to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));

drop policy if exists "organization members read own" on public.organization_members;
create policy "organization members read own"
on public.organization_members
for select
to authenticated
using (profile_id = (select auth.uid()));

-- Org admins can see the roster of their currently active organization (read
-- only — membership changes go through the platform admin screen or signup).
drop policy if exists "organization members org admin read own org" on public.organization_members;
create policy "organization members org admin read own org"
on public.organization_members
for select
to authenticated
using ((select public.is_admin()) and organization_id = (select public.current_organization_id()));
