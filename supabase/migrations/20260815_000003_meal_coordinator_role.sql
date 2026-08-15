-- New role: meal_coordinator.
--
-- A meal coordinator needs to know, for each meal offered in a given day's
-- survey, how many employees selected it (kitchen prep counts) — never
-- individual employee identities or vote records. Like admin/employee, a
-- meal coordinator can belong to (and switch between, via the existing
-- organization switcher) several organizations through organization_members;
-- unlike platform_administrator they are always scoped to their active
-- organization.
--
-- Deliberately no new RLS read access is granted on daily_surveys,
-- survey_meals, or votes for this role — get_meal_vote_counts() below is the
-- only access path, and it returns aggregate counts only.

-- ============================================================================
-- 1. Allow the new role in profiles.roles
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_roles_allowed;
alter table public.profiles
add constraint profiles_roles_allowed
check (
  cardinality(roles) > 0
  and roles <@ array['admin', 'employee', 'platform_administrator', 'meal_coordinator']::text[]
);

-- Self-service profile updates may keep any non-platform-admin role
-- (unchanged rationale: prevents a user from self-escalating to
-- platform_administrator via a direct table update).
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and roles <@ array['admin', 'employee', 'meal_coordinator']::text[]
  and cardinality(roles) > 0
);

-- ============================================================================
-- 2. Role helper
-- ============================================================================

create or replace function public.is_meal_coordinator()
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
      and roles @> array['meal_coordinator']::text[]
      and is_active = true
  );
$$;

-- ============================================================================
-- 3. handle_new_user() — accept meal_coordinator at signup/provisioning
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
  if metadata_role not in ('admin', 'employee', 'platform_administrator', 'meal_coordinator') then
    metadata_role := 'employee';
  end if;

  metadata_roles :=
    case
      when new.raw_user_meta_data ? 'roles' then
        array(
          select lower(value)
          from jsonb_array_elements_text(new.raw_user_meta_data -> 'roles') as value
          where lower(value) in ('admin', 'employee', 'platform_administrator', 'meal_coordinator')
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
-- 4. Aggregate, privacy-preserving RPC: per-meal vote counts for one survey
--    day (defaults to today). Org admins and platform administrators can
--    call it too — they already have unrestricted table access to the same
--    data, so this grants no new privilege for them.
-- ============================================================================

create or replace function public.get_meal_vote_counts(
  report_date date default current_date,
  organization_id_filter uuid default null
)
returns table (
  survey_id uuid,
  survey_status text,
  meal_id uuid,
  meal_name text,
  vote_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_platform_admin boolean := public.is_platform_admin();
  scope_org_id uuid;
  target_survey_id uuid;
begin
  if not (public.is_admin() or caller_is_platform_admin or public.is_meal_coordinator()) then
    raise exception 'insufficient_privilege';
  end if;

  if caller_is_platform_admin then
    -- A platform administrator has no active organization of their own, so
    -- they must say which one they mean.
    if organization_id_filter is null then
      raise exception 'organization_required';
    end if;

    scope_org_id := organization_id_filter;
  else
    scope_org_id := public.current_organization_id();

    if scope_org_id is null then
      raise exception 'no_active_organization';
    end if;
  end if;

  select ds.id into target_survey_id
  from public.daily_surveys ds
  where ds.survey_date = report_date
    and ds.organization_id = scope_org_id
  order by ds.created_at desc
  limit 1;

  if target_survey_id is null then
    return;
  end if;

  return query
  select
    ds.id as survey_id,
    ds.status as survey_status,
    m.id as meal_id,
    m.name as meal_name,
    count(v.id)::integer as vote_count
  from public.survey_meals sm
  join public.meals m on m.id = sm.meal_id
  join public.daily_surveys ds on ds.id = sm.survey_id
  left join public.votes v on v.survey_id = sm.survey_id and v.meal_id = sm.meal_id
  where sm.survey_id = target_survey_id
  group by ds.id, ds.status, m.id, m.name
  order by vote_count desc, m.name asc;
end;
$$;

grant execute on function public.get_meal_vote_counts(date, uuid) to authenticated;
