-- Product decision: voting is no longer private within one's own
-- organization. Any active, authenticated profile can now see, for a given
-- survey day, who voted for which meal — grouped by meal, meals with zero
-- votes still listed. This is a deliberate relaxation of the earlier
-- meal_coordinator design (get_meal_vote_counts), which intentionally
-- exposed only aggregate counts.
--
-- Organization boundaries are still enforced: the caller only ever sees
-- their own organization's survey (a platform administrator, who has none
-- of their own, must pass organization_id_filter explicitly).

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
