-- ============================================================================
-- Fix "infinite recursion detected in policy for relation votes" (42P17) when
-- voting.
--
-- Root cause: inserting into votes evaluates "votes employee create own"'s
-- with_check, which runs a raw `select ... from daily_surveys` — that in turn
-- triggers daily_surveys' own RLS, including
-- "surveys employee read own history" (added in
-- 20260816_000002_survey_history_visibility.sql), which runs a raw
-- `select ... from votes` — re-entering votes' RLS while it's still being
-- evaluated for the original insert. Postgres detects this as recursion.
--
-- Fix: move the votes lookup behind a SECURITY DEFINER function, the same
-- pattern already used by is_admin()/current_organization_id() elsewhere —
-- it runs with the function owner's privileges, which bypasses RLS on the
-- underlying table entirely, breaking the cycle.
-- ============================================================================

create or replace function public.has_voted_in_survey(target_survey_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.votes v
    where v.survey_id = target_survey_id
      and v.user_id = auth.uid()
  );
$$;

grant execute on function public.has_voted_in_survey(uuid) to authenticated;

drop policy if exists "surveys employee read own history" on public.daily_surveys;
create policy "surveys employee read own history"
on public.daily_surveys
for select
to authenticated
using (public.has_voted_in_survey(id));

-- ============================================================================
-- While in here: "votes employee create own"'s survey_meals EXISTS check was
-- unintentionally comparing survey_meals' own columns to themselves
-- (`sm.survey_id = survey_id` resolved the unqualified `survey_id` to the
-- closest scope, sm.survey_id, instead of the row being inserted into
-- votes) — a tautology satisfied by any existing survey_meals row,
-- regardless of which survey/meal it belongs to. Qualify against `votes.*`
-- explicitly so it actually checks the meal is offered on that survey.
-- ============================================================================

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
    where ds.id = votes.survey_id
      and ds.status = 'open'
      and ds.organization_id = (select public.current_organization_id())
      and now() between ds.voting_starts_at and ds.voting_ends_at
  )
  and exists (
    select 1
    from public.survey_meals sm
    where sm.survey_id = votes.survey_id
      and sm.meal_id = votes.meal_id
  )
);
