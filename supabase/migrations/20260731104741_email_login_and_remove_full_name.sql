-- Motek: adres e-mail jest jednocześnie loginem, a profil nie przechowuje
-- imienia i nazwiska.

-- 1. Zdejmujemy dawną regułę loginu przed przepisaniem istniejących profili.
alter table public.profiles
  drop constraint if exists profiles_login_check;

-- 2. Ustawiamy oba identyfikatory profilu na adres e-mail z auth.users.
update public.profiles as p
set email = lower(trim(u.email)),
    login = lower(trim(u.email)),
    updated_at = now()
from auth.users as u
where p.id = u.id
  and u.email is not null
  and trim(u.email) <> '';

-- Nie pozwalamy wdrożyć schematu, jeśli istnieje profil bez poprawnego adresu
-- źródłowego w Auth — w takim przypadku migracja ma zatrzymać się bez
-- częściowego usunięcia danych.
do $$
begin
  if exists (
    select 1
    from public.profiles as p
    left join auth.users as u on u.id = p.id
    where u.email is null
       or lower(trim(u.email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) then
    raise exception 'Nie można ustawić loginów profili: znaleziono konto bez poprawnego adresu e-mail';
  end if;
end;
$$;

-- 3. Login musi być dokładnie znormalizowanym e-mailem profilu.
alter table public.profiles
  add constraint profiles_login_email_check
  check (
    login = email
    and login ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  );

comment on column public.profiles.login is
  'Znormalizowany adres e-mail używany jako login użytkownika.';

-- 4. Nowe profile i zmiany e-maila zachowują zgodność login = email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  normalized_email text := lower(trim(new.email));
begin
  if new.email is null or normalized_email = '' then
    raise exception 'Użytkownik Auth musi mieć adres e-mail';
  end if;

  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Użytkownik Auth musi mieć poprawny adres e-mail';
  end if;

  insert into public.profiles (id, login, email, avatar_url)
  values (
    new.id,
    normalized_email,
    normalized_email,
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  );

  return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  normalized_email text := lower(trim(new.email));
begin
  if new.email is null or normalized_email = '' then
    raise exception 'Użytkownik Auth musi mieć adres e-mail';
  end if;

  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Użytkownik Auth musi mieć poprawny adres e-mail';
  end if;

  update public.profiles
  set email = normalized_email,
      login = normalized_email,
      updated_at = now()
  where id = new.id;

  return new;
end;
$$;

-- 5. Login nie jest już edytowalny przez zwykłego użytkownika.
revoke update (login, full_name, avatar_url) on table public.profiles from authenticated;
grant update (avatar_url) on table public.profiles to authenticated;

comment on policy profiles_update_own on public.profiles is
  'Użytkownik może zmienić wyłącznie avatar we własnym profilu.';

-- 6. Usuwamy istniejące dane imienia i nazwiska z Auth oraz profili.
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'full_name'
where raw_user_meta_data ? 'full_name';

alter table public.profiles
  drop column if exists full_name;
