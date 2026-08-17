-- ============================================================================
-- Lets the (unauthenticated) employee self-registration form proactively
-- check whether a phone number is already in use before calling
-- auth.signUp(). GoTrue only enforces uniqueness on auth.users.email, so a
-- duplicate phone_number would otherwise only surface as an opaque
-- "Database error saving new user" once handle_new_user's insert into
-- profiles hits the profiles_phone_number_key unique constraint.
-- ============================================================================

create or replace function public.is_phone_number_taken(input_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where phone_number = trim(input_phone)
  );
$$;

grant execute on function public.is_phone_number_taken(text) to anon, authenticated;
