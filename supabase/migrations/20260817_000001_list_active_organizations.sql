-- ============================================================================
-- List active organizations for the (unauthenticated) employee self-registration
-- page, so it can offer a dropdown instead of requiring a manually-typed code.
-- Mirrors resolve_organization_code's anon-readable, security-definer shape,
-- but returns the full active list rather than resolving a single code.
-- ============================================================================

create or replace function public.list_active_organizations()
returns table (id uuid, name text, code text)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, code
  from public.organizations
  where is_active = true
  order by name;
$$;

grant execute on function public.list_active_organizations() to anon, authenticated;
