-- Motek: profile użytkownika powiązany z Supabase Auth.
-- Hasła, sesje i tokeny pozostają wyłącznie pod kontrolą auth.users.

-- 1. Dane aplikacyjne użytkownika.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login text not null
    check (login ~ '^[a-z0-9_]{3,30}$'),
  email text not null
    check (email = lower(trim(email))),
  full_name text
    check (full_name is null or char_length(full_name) <= 200),
  avatar_url text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'banned')),
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Zwykłe UNIQUE jest wrażliwe na wielkość liter. Indeksy lower() zapewniają
-- jedną nazwę i jeden adres e-mail niezależnie od zapisu wielkimi literami.
create unique index profiles_login_lower_key
  on public.profiles (lower(login));

create unique index profiles_email_lower_key
  on public.profiles (lower(email));

comment on table public.profiles is
  'Dane aplikacyjne użytkowników Motka; uwierzytelnianie pozostaje w auth.users.';

comment on column public.profiles.email is
  'Znormalizowana kopia adresu z auth.users dla wygodnych zapytań aplikacji.';

-- 2. Automatyczne utworzenie profilu po rejestracji w Supabase Auth.
-- Funkcja musi działać jako SECURITY DEFINER, ponieważ klient nie dostaje
-- prawa INSERT do profiles. search_path jest pusty, aby ograniczyć ryzyko
-- podsunięcia obiektu o tej samej nazwie.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  normalized_login text := lower(trim(new.raw_user_meta_data ->> 'login'));
  normalized_email text := lower(trim(new.email));
begin
  if new.email is null or normalized_email = '' then
    raise exception 'Użytkownik Auth musi mieć adres e-mail';
  end if;

  if normalized_login is null or normalized_login !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'Login musi mieć 3-30 znaków i zawierać tylko litery, cyfry lub podkreślenie';
  end if;

  insert into public.profiles (id, login, email, full_name, avatar_url)
  values (
    new.id,
    normalized_login,
    normalized_email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Synchronizacja kopii e-maila, jeśli zmieni się on w Supabase Auth.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.email is null or trim(new.email) = '' then
    raise exception 'Użytkownik Auth musi mieć adres e-mail';
  end if;

  update public.profiles
  set email = lower(trim(new.email)), updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- 4. Automatyczna data ostatniej zmiany profilu.
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();

-- 5. RLS: użytkownik widzi i aktualizuje wyłącznie własny profil.
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;
grant update (login, full_name, avatar_url) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

comment on policy profiles_select_own on public.profiles is
  'Użytkownik może odczytać wyłącznie własny profil.';

comment on policy profiles_update_own on public.profiles is
  'Użytkownik może zmienić login, nazwę i avatar wyłącznie we własnym profilu.';
