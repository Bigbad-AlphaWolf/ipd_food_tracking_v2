-- Reverts the employee-only voting-window gate added to
-- get_survey_voters_by_meal() in 20260816_000001_survey_voting_window.sql.
--
-- Product decision: "survey voters for a selected date" should work exactly
-- the same for every user as it already does for meal_coordinator — pick
-- any date (past, current, or future), see who voted for what, no window
-- restriction. This is purely an informational/read view; voting itself
-- (the actual daily_surveys/survey_meals/votes RLS policies) remains
-- strictly window-gated and is untouched by this migration.

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
  scope_org_id uuid;
  target_survey_id uuid;
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
