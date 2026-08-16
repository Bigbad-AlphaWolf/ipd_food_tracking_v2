-- Bug fix: the employee's "My History" page joins votes -> daily_surveys
-- via an inner embed (`daily_surveys!inner(survey_date, status)` in
-- EmployeeService.getHistory()). The only SELECT policy an employee had on
-- daily_surveys was "surveys employee read open" (status = 'open' and
-- within the voting window) — so as soon as a survey the employee voted in
-- was closed (or its window lapsed), RLS silently dropped the embedded row,
-- and PostgREST's inner-join semantics then dropped the whole vote row from
-- the result. Past votes for closed surveys were invisible in history.
--
-- Fix: add a second, independent SELECT policy — an employee can always
-- read a survey they have personally voted in, regardless of its current
-- status or voting window. This is additive (RLS policies for the same
-- command are OR'd together) and does not widen access to surveys they
-- never voted in.

drop policy if exists "surveys employee read own history" on public.daily_surveys;
create policy "surveys employee read own history"
on public.daily_surveys
for select
to authenticated
using (
  exists (
    select 1
    from public.votes v
    where v.survey_id = daily_surveys.id
      and v.user_id = (select auth.uid())
  )
);
