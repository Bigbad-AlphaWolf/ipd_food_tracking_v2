-- Adds an explicit voting window to each survey (menu): voting_starts_at
-- (defaults to now, i.e. "the actual date" at creation time) and
-- voting_ends_at (required). Product ask: "the survey will be visible to
-- user with role employee only between these dates and time" — so only the
-- employee-facing read/insert policies gain the window check. Admins,
-- platform administrators, and meal coordinators are unaffected: they
-- already have their own full-access policies / RPC checks and need to
-- manage/prepare regardless of whether the window is currently open.

alter table public.daily_surveys
add column if not exists voting_starts_at timestamptz not null default now(),
add column if not exists voting_ends_at timestamptz;

-- Backfill: give existing rows a wide-open window so nothing already live
-- silently disappears from employees the moment this migration runs.
update public.daily_surveys
set voting_ends_at = voting_starts_at + interval '10 years'
where voting_ends_at is null;

alter table public.daily_surveys
alter column voting_ends_at set not null;

alter table public.daily_surveys drop constraint if exists daily_surveys_voting_window_valid;
alter table public.daily_surveys
add constraint daily_surveys_voting_window_valid check (voting_ends_at > voting_starts_at);

-- ============================================================================
-- RLS — only the three employee-facing policies gain the window check.
-- ============================================================================

drop policy if exists "surveys employee read open" on public.daily_surveys;
create policy "surveys employee read open"
on public.daily_surveys
for select
to authenticated
using (
  status = 'open'
  and organization_id = (select public.current_organization_id())
  and now() between voting_starts_at and voting_ends_at
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
      and now() between ds.voting_starts_at and ds.voting_ends_at
  )
);

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
      and now() between ds.voting_starts_at and ds.voting_ends_at
  )
  and exists (
    select 1
    from public.survey_meals sm
    where sm.survey_id = survey_id
      and sm.meal_id = meal_id
  )
);

-- ============================================================================
-- get_survey_voters_by_meal(): a plain employee only sees who-voted-for-what
-- within the same window; admin/platform admin/meal coordinator (already
-- privileged) are unaffected.
-- ============================================================================

create or replace function public.get_survey_voters_by_meal(
  report_date date default current_date,
  organization_id_filter uuid default null
)
returns table (
  survey_id uuid,
  survey_status text,
  meal_id uuid,
  meal_name text,
  voter_id uuid,
  voter_full_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_platform_admin boolean := public.is_platform_admin();
  caller_is_privileged boolean := public.is_admin() or caller_is_platform_admin or public.is_meal_coordinator();
  scope_org_id uuid;
  target_survey_id uuid;
  target_starts_at timestamptz;
  target_ends_at timestamptz;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_active = true
  ) then
    raise exception 'insufficient_privilege';
  end if;

  if caller_is_platform_admin then
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

  select ds.id, ds.voting_starts_at, ds.voting_ends_at
  into target_survey_id, target_starts_at, target_ends_at
  from public.daily_surveys ds
  where ds.survey_date = report_date
    and ds.organization_id = scope_org_id
  order by ds.created_at desc
  limit 1;

  if target_survey_id is null then
    return;
  end if;

  if not caller_is_privileged and not (now() between target_starts_at and target_ends_at) then
    return;
  end if;

  return query
  select
    ds.id as survey_id,
    ds.status as survey_status,
    m.id as meal_id,
    m.name as meal_name,
    p.id as voter_id,
    p.full_name as voter_full_name
  from public.survey_meals sm
  join public.meals m on m.id = sm.meal_id
  join public.daily_surveys ds on ds.id = sm.survey_id
  left join public.votes v on v.survey_id = sm.survey_id and v.meal_id = sm.meal_id
  left join public.profiles p on p.id = v.user_id
  where sm.survey_id = target_survey_id
  order by m.name asc, p.full_name asc nulls last;
end;
$$;

grant execute on function public.get_survey_voters_by_meal(date, uuid) to authenticated;
