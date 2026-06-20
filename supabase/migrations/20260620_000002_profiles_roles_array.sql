alter table public.profiles
add column if not exists roles text[];

update public.profiles
set roles = case
  when role in ('admin', 'employee') then array[role]
  else array['employee']
end
where roles is null or cardinality(roles) = 0;

alter table public.profiles
alter column roles set default array['employee']::text[];

alter table public.profiles
alter column roles set not null;

alter table public.profiles
drop constraint if exists profiles_roles_allowed;

alter table public.profiles
add constraint profiles_roles_allowed
check (
  cardinality(roles) > 0
  and roles <@ array['admin', 'employee']::text[]
);

create or replace function public.sync_profile_role_legacy()
returns trigger
language plpgsql
as $$
begin
  if new.roles is null or cardinality(new.roles) = 0 then
    new.roles := array['employee'];
  end if;

  if new.roles @> array['admin']::text[] then
    new.role := 'admin';
  else
    new.role := 'employee';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_profile_role_legacy on public.profiles;
create trigger sync_profile_role_legacy
before insert or update on public.profiles
for each row
execute function public.sync_profile_role_legacy();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_role text := lower(coalesce(new.raw_user_meta_data ->> 'role', 'employee'));
  metadata_roles text[];
begin
  if metadata_role not in ('admin', 'employee') then
    metadata_role := 'employee';
  end if;

  metadata_roles :=
    case
      when new.raw_user_meta_data ? 'roles' then
        array(
          select lower(value)
          from jsonb_array_elements_text(new.raw_user_meta_data -> 'roles') as value
          where lower(value) in ('admin', 'employee')
        )
      else
        array[metadata_role]
    end;

  if metadata_roles is null or cardinality(metadata_roles) = 0 then
    metadata_roles := array[metadata_role];
  end if;

  insert into public.profiles (id, full_name, email, phone_number, department, role, roles, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'department',
    case when metadata_roles @> array['admin']::text[] then 'admin' else 'employee' end,
    metadata_roles,
    true
  )
  on conflict (id) do update
  set
    email = excluded.email,
    phone_number = excluded.phone_number,
    full_name = excluded.full_name,
    department = excluded.department,
    role = excluded.role,
    roles = excluded.roles,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and roles @> array['admin']::text[]
      and is_active = true
  );
$$;

create or replace function public.get_admin_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date := date_trunc('month', current_date)::date;
  month_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  employee_count integer := 0;
  today_votes integer := 0;
  month_total integer := 0;
  favorite_meal text := 'No data';
  trend jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'insufficient_privilege';
  end if;

  select count(*) into employee_count
  from public.profiles
  where roles @> array['employee']::text[] and is_active = true;

  select count(*) into today_votes
  from public.votes v
  join public.daily_surveys ds on ds.id = v.survey_id
  where ds.survey_date = current_date;

  select count(*) into month_total
  from public.votes v
  join public.daily_surveys ds on ds.id = v.survey_id
  where ds.survey_date between month_start and month_end;

  select coalesce(sub.name, 'No data')
  into favorite_meal
  from (
    select m.name, count(*) as total_votes
    from public.votes v
    join public.daily_surveys ds on ds.id = v.survey_id
    join public.meals m on m.id = v.meal_id
    where ds.survey_date between month_start and month_end
    group by m.name
    order by total_votes desc, m.name asc
    limit 1
  ) sub;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', to_char(x.survey_date, 'DD Mon'),
        'value', x.vote_count
      )
      order by x.survey_date
    ),
    '[]'::jsonb
  )
  into trend
  from (
    select ds.survey_date, count(v.id) as vote_count
    from public.daily_surveys ds
    left join public.votes v on v.survey_id = ds.id
    where ds.survey_date between month_start and month_end
    group by ds.survey_date
  ) x;

  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'participationRate', case when employee_count = 0 then 0 else round((today_votes::numeric / employee_count::numeric) * 100, 2) end,
      'totalMealsThisMonth', month_total,
      'mostPopularMeal', favorite_meal,
      'votesToday', today_votes,
      'eligibleEmployees', employee_count
    ),
    'trend', trend
  );
end;
$$;

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and roles <@ array['admin', 'employee']::text[]
  and cardinality(roles) > 0
);
