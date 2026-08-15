-- Lets an org/platform administrator provision a new user directly (email +
-- temporary password + role(s) + organization(s)) instead of only editing
-- existing accounts. The actual provisioning happens in the admin-create-user
-- edge function via auth.admin.createUser(), which flows through the same
-- handle_new_user() trigger as self-registration — this migration only adds
-- the "must change password on next login" flag that flow sets, and teaches
-- the trigger to read it.

alter table public.profiles
add column if not exists must_change_password boolean not null default false;

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
  metadata_must_change_password boolean := coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false);
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

  insert into public.profiles (
    id, full_name, email, phone_number, department, role, roles,
    active_organization_id, is_active, must_change_password
  )
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
    true,
    metadata_must_change_password
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
    must_change_password = excluded.must_change_password,
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
