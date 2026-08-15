-- Bug fix: unlike every other table (profiles, daily_surveys, survey_meals,
-- votes, organizations, organization_members), the meals table never got a
-- platform_administrator RLS policy — it only ever checked is_admin(). Since
-- meals are a single shared catalog (not org-scoped, per product decision),
-- a platform administrator managing the catalog needs the same full access
-- an org admin already has.

drop policy if exists "meals admin full access" on public.meals;
create policy "meals admin full access"
on public.meals
for all
to authenticated
using ((select public.is_admin()) or (select public.is_platform_admin()))
with check ((select public.is_admin()) or (select public.is_platform_admin()));

drop policy if exists "meals employee read active" on public.meals;
create policy "meals employee read active"
on public.meals
for select
to authenticated
using (is_active = true or (select public.is_admin()) or (select public.is_platform_admin()));
