create extension if not exists pgcrypto;

create or replace function public.set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  phone_number text unique,
  department text,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_surveys (
  id uuid primary key default gen_random_uuid(),
  survey_date date not null unique,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.survey_meals (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.daily_surveys (id) on delete cascade,
  meal_id uuid not null references public.meals (id),
  unique (survey_id, meal_id)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.daily_surveys (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  meal_id uuid not null references public.meals (id),
  voted_at timestamptz not null default now(),
  unique (survey_id, user_id)
);

create index if not exists idx_profiles_role_active on public.profiles (role, is_active);
create index if not exists idx_profiles_phone on public.profiles (phone_number);
create index if not exists idx_meals_active on public.meals (is_active);
create index if not exists idx_daily_surveys_date_status on public.daily_surveys (survey_date, status);
create index if not exists idx_survey_meals_survey on public.survey_meals (survey_id);
create index if not exists idx_votes_user_voted_at on public.votes (user_id, voted_at desc);
create index if not exists idx_votes_survey on public.votes (survey_id);

drop trigger if exists set_profiles_timestamp on public.profiles;
create trigger set_profiles_timestamp
before update on public.profiles
for each row
execute function public.set_timestamp();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone_number, department, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'department',
    coalesce(new.raw_user_meta_data ->> 'role', 'employee'),
    true
  )
  on conflict (id) do update
  set
    email = excluded.email,
    phone_number = excluded.phone_number,
    full_name = excluded.full_name,
    department = excluded.department,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

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
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.resolve_auth_identifier(input_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where p.is_active = true
    and (
      lower(trim(p.email)) = lower(trim(input_identifier))
      or trim(coalesce(p.phone_number, '')) = trim(input_identifier)
    )
  limit 1;
$$;

grant execute on function public.resolve_auth_identifier(text) to anon, authenticated;

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
  where role = 'employee' and is_active = true;

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

grant execute on function public.get_admin_dashboard_metrics() to authenticated;

create or replace function public.get_monthly_report(report_month integer, report_year integer, employee_search text default null)
returns table (
  "employeeName" text,
  email text,
  department text,
  month text,
  "totalVotes" integer,
  "favoriteMeal" text
)
language sql
security definer
set search_path = public
as $$
  with period as (
    select make_date(report_year, report_month, 1) as start_date,
           (make_date(report_year, report_month, 1) + interval '1 month - 1 day')::date as end_date
  ),
  monthly_votes as (
    select
      p.id as profile_id,
      p.full_name,
      p.email,
      coalesce(p.department, 'Unassigned') as department,
      m.name as meal_name,
      count(v.id) as vote_count
    from public.votes v
    join public.daily_surveys ds on ds.id = v.survey_id
    join public.profiles p on p.id = v.user_id
    join public.meals m on m.id = v.meal_id
    cross join period
    where ds.survey_date between period.start_date and period.end_date
      and (
        employee_search is null
        or p.full_name ilike '%' || employee_search || '%'
        or p.email ilike '%' || employee_search || '%'
      )
    group by p.id, p.full_name, p.email, p.department, m.name
  ),
  ranked as (
    select *, row_number() over (partition by profile_id order by vote_count desc, meal_name asc) as rank_number
    from monthly_votes
  ),
  totals as (
    select profile_id, sum(vote_count)::integer as total_votes
    from monthly_votes
    group by profile_id
  )
  select
    r.full_name as "employeeName",
    r.email,
    r.department,
    to_char(make_date(report_year, report_month, 1), 'Mon YYYY') as month,
    t.total_votes as "totalVotes",
    r.meal_name as "favoriteMeal"
  from ranked r
  join totals t on t.profile_id = r.profile_id
  where r.rank_number = 1
  order by r.full_name;
$$;

grant execute on function public.get_monthly_report(integer, integer, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.daily_surveys enable row level security;
alter table public.survey_meals enable row level security;
alter table public.votes enable row level security;

drop policy if exists "profiles admin full access" on public.profiles;
create policy "profiles admin full access"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role in ('admin', 'employee'));

drop policy if exists "meals admin full access" on public.meals;
create policy "meals admin full access"
on public.meals
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "meals employee read active" on public.meals;
create policy "meals employee read active"
on public.meals
for select
to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "surveys admin full access" on public.daily_surveys;
create policy "surveys admin full access"
on public.daily_surveys
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "surveys employee read open" on public.daily_surveys;
create policy "surveys employee read open"
on public.daily_surveys
for select
to authenticated
using (status = 'open');

drop policy if exists "survey meals admin full access" on public.survey_meals;
create policy "survey meals admin full access"
on public.survey_meals
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "survey meals employee read open" on public.survey_meals;
create policy "survey meals employee read open"
on public.survey_meals
for select
to authenticated
using (
  exists (
    select 1
    from public.daily_surveys ds
    where ds.id = survey_id
      and ds.status = 'open'
  )
);

drop policy if exists "votes admin full access" on public.votes;
create policy "votes admin full access"
on public.votes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "votes employee read own" on public.votes;
create policy "votes employee read own"
on public.votes
for select
to authenticated
using (auth.uid() = user_id);

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
    where ds.id = survey_id
      and ds.status = 'open'
  )
  and exists (
    select 1
    from public.survey_meals sm
    where sm.survey_id = survey_id
      and sm.meal_id = meal_id
  )
);
