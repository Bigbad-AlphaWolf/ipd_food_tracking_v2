-- ============================================================================
-- Let an employee change their own vote while the survey is still open and
-- within its voting window (same gating as the INSERT policy). Previously
-- there was no UPDATE policy for employees at all, so votes were
-- insert-once/immutable; EmployeeService.submitVote now upserts on
-- (survey_id, user_id), which needs both an INSERT and an UPDATE policy to
-- pass depending on whether a vote row already exists.
-- ============================================================================

drop policy if exists "votes employee update own" on public.votes;
create policy "votes employee update own"
on public.votes
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.daily_surveys ds
    where ds.id = votes.survey_id
      and ds.status = 'open'
      and ds.organization_id = (select public.current_organization_id())
      and now() between ds.voting_starts_at and ds.voting_ends_at
  )
)
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
