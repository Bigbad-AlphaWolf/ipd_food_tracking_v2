-- Bug fix: "organizations member read own" only allowed reading the
-- currently ACTIVE organization (id = current_organization_id()), not every
-- organization the user is a member of. That silently dropped every
-- non-active membership out of the organization_members(organization:...)
-- embed used to populate the "switch organization" list — a user with 2
-- memberships would only ever see 1 organization client-side, so the
-- switcher (which only renders when length > 1) never appeared.
--
-- Fixed to grant read access to any organization the user has a row for in
-- organization_members, which also covers the active org (it's always one
-- of the user's memberships).

drop policy if exists "organizations member read own" on public.organizations;
create policy "organizations member read own"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.profile_id = (select auth.uid())
  )
);
