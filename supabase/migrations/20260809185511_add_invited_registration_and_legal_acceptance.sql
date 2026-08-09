-- Wersjonowane dokumenty prawne i bezpieczny fundament rejestracji na zaproszenie.
-- Sekret zaproszenia nie jest przechowywany; baza otrzymuje wyłącznie SHA-256.

create schema if not exists private;

create table private.legal_document_versions (
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null,
  effective_at date not null,
  requires_acceptance boolean not null,
  is_current boolean not null default false,
  primary key (kind, version)
);

create unique index legal_document_one_current_per_kind
  on private.legal_document_versions(kind)
  where is_current;

create table private.terms_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version)
);

create table private.registration_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    email = lower(btrim(email)) and
    email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  reserved_at timestamptz,
  reservation_id uuid unique,
  reservation_expires_at timestamptz,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (reservation_id is null and reserved_at is null and reservation_expires_at is null) or
    (reservation_id is not null and reserved_at is not null and reservation_expires_at is not null)
  ),
  check (used_by is null or used_at is not null),
  check (used_at is null or reservation_id is null)
);

create index registration_invitations_email_idx
  on private.registration_invitations(email);

create index registration_invitations_expires_at_idx
  on private.registration_invitations(expires_at);

create table private.registration_attempts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique,
  invitation_id uuid not null references private.registration_invitations(id) on delete restrict,
  email text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  state text not null check (state in ('reserved', 'auth_created', 'finalized', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index registration_attempts_auth_user_id_idx
  on private.registration_attempts(auth_user_id);

create table private.privacy_notice_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  privacy_version text not null,
  presented_at timestamptz not null default now(),
  primary key (user_id, privacy_version)
);

insert into private.legal_document_versions
  (kind, version, effective_at, requires_acceptance, is_current)
values
  ('terms', '1.0', date '2026-08-09', true, true),
  ('privacy', '1.0', date '2026-08-09', false, true);

alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'suspended', 'banned', 'pending_registration'));

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

  insert into public.profiles (id, login, email, avatar_url, status)
  values (
    new.id,
    normalized_email,
    normalized_email,
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    'pending_registration'
  );

  return new;
end;
$$;

alter function public.handle_new_user() set search_path = '';

revoke all on all tables in schema private from public, anon, authenticated;

create or replace function public.reserve_registration_invitation(
  p_token_hash text,
  p_email text,
  p_terms_version text,
  p_reservation_id uuid
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(p_email));
  current_terms_version text;
  existing_invitation_id uuid;
  invitation_id uuid;
  reserved_at_value timestamptz := clock_timestamp();
begin
  if p_reservation_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Nieprawidłowa rezerwacja zaproszenia' using errcode = '22023';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Nieprawidłowy adres e-mail zaproszenia' using errcode = '22023';
  end if;

  select version into current_terms_version
  from private.legal_document_versions
  where kind = 'terms' and is_current;

  if current_terms_version is null or p_terms_version is distinct from current_terms_version then
    raise exception 'Wymagana jest aktualna wersja regulaminu' using errcode = 'P0001';
  end if;

  select i.id into existing_invitation_id
  from private.registration_attempts a
  join private.registration_invitations i on i.id = a.invitation_id
  where a.reservation_id = p_reservation_id
    and a.email = normalized_email
    and i.token_hash = p_token_hash;

  if existing_invitation_id is not null then
    return existing_invitation_id;
  end if;

  update private.registration_invitations
  set reserved_at = reserved_at_value,
      reservation_id = p_reservation_id,
      reservation_expires_at = reserved_at_value + interval '15 minutes'
  where token_hash = p_token_hash
    and email = normalized_email
    and used_at is null
    and revoked_at is null
    and expires_at > reserved_at_value
    and (reserved_at is null or reservation_expires_at <= reserved_at_value)
  returning id into invitation_id;

  if invitation_id is null then
    raise exception 'Zaproszenie jest niedostępne' using errcode = 'P0001';
  end if;

  insert into private.registration_attempts
    (reservation_id, invitation_id, email, state)
  values
    (p_reservation_id, invitation_id, normalized_email, 'reserved');

  return invitation_id;
exception
  when unique_violation then
    select invitation_id into existing_invitation_id
    from private.registration_attempts
    where reservation_id = p_reservation_id
      and email = normalized_email;
    if existing_invitation_id is not null then
      return existing_invitation_id;
    end if;
    raise exception 'Zaproszenie jest już rezerwowane' using errcode = 'P0001';
end;
$$;

create or replace function public.attach_registration_user(
  p_reservation_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  attempt_state text;
  attempt_email text;
  attempt_user_id uuid;
  user_email text;
begin
  if p_reservation_id is null or p_user_id is null then
    raise exception 'Nieprawidłowe powiązanie rejestracji' using errcode = '22023';
  end if;

  select state, email, auth_user_id
  into attempt_state, attempt_email, attempt_user_id
  from private.registration_attempts
  where reservation_id = p_reservation_id
  for update;

  if attempt_state is null then
    raise exception 'Nie znaleziono próby rejestracji' using errcode = 'P0002';
  end if;

  if attempt_state = 'auth_created' and attempt_user_id = p_user_id then
    return true;
  end if;

  if attempt_state <> 'reserved' or attempt_user_id is not null then
    raise exception 'Próba rejestracji nie może zostać powiązana' using errcode = 'P0001';
  end if;

  select lower(btrim(email)) into user_email
  from auth.users
  where id = p_user_id;

  if user_email is null or user_email is distinct from attempt_email then
    raise exception 'Adres e-mail użytkownika nie pasuje do zaproszenia' using errcode = 'P0001';
  end if;

  update private.registration_attempts
  set auth_user_id = p_user_id,
      state = 'auth_created',
      updated_at = clock_timestamp()
  where reservation_id = p_reservation_id;

  return true;
end;
$$;

create or replace function public.finalize_invited_registration(
  p_reservation_id uuid,
  p_user_id uuid,
  p_terms_version text,
  p_privacy_version text
)
returns timestamptz
language plpgsql
security definer set search_path = ''
as $$
declare
  attempt_state text;
  attempt_user_id uuid;
  invitation_id uuid;
  invitation_used_at timestamptz;
  current_terms_version text;
  current_privacy_version text;
  accepted_at_value timestamptz;
  profile_status text;
  finalized_at_value timestamptz := clock_timestamp();
begin
  select version into current_terms_version
  from private.legal_document_versions
  where kind = 'terms' and is_current;
  select version into current_privacy_version
  from private.legal_document_versions
  where kind = 'privacy' and is_current;

  if p_terms_version is distinct from current_terms_version
     or p_privacy_version is distinct from current_privacy_version then
    raise exception 'Wymagane są aktualne wersje dokumentów' using errcode = 'P0001';
  end if;

  select a.state, a.auth_user_id, a.invitation_id
  into attempt_state, attempt_user_id, invitation_id
  from private.registration_attempts a
  where a.reservation_id = p_reservation_id
  for update;

  if attempt_state is null then
    raise exception 'Nie znaleziono próby rejestracji' using errcode = 'P0002';
  end if;

  if attempt_state = 'finalized' and attempt_user_id = p_user_id then
    select accepted_at into accepted_at_value
    from private.terms_acceptances
    where user_id = p_user_id and terms_version = p_terms_version;
    return accepted_at_value;
  end if;

  if attempt_state <> 'auth_created' or attempt_user_id is distinct from p_user_id then
    raise exception 'Próba rejestracji nie jest gotowa do finalizacji' using errcode = 'P0001';
  end if;

  select used_at into invitation_used_at
  from private.registration_invitations
  where id = invitation_id
  for update;

  if invitation_used_at is not null then
    raise exception 'Zaproszenie zostało już użyte' using errcode = 'P0001';
  end if;

  select status into profile_status
  from public.profiles
  where id = p_user_id
  for update;

  if profile_status is null or profile_status <> 'pending_registration' then
    raise exception 'Profil nie jest oczekujący na finalizację' using errcode = 'P0001';
  end if;

  insert into private.terms_acceptances (user_id, terms_version, accepted_at)
  values (p_user_id, p_terms_version, finalized_at_value)
  on conflict (user_id, terms_version) do nothing;

  select accepted_at into accepted_at_value
  from private.terms_acceptances
  where user_id = p_user_id and terms_version = p_terms_version;

  insert into private.privacy_notice_deliveries (user_id, privacy_version, presented_at)
  values (p_user_id, p_privacy_version, finalized_at_value)
  on conflict (user_id, privacy_version) do nothing;

  update public.profiles
  set status = 'active', updated_at = finalized_at_value
  where id = p_user_id and status = 'pending_registration';

  update private.registration_invitations
  set used_at = finalized_at_value,
      used_by = p_user_id,
      reserved_at = null,
      reservation_id = null,
      reservation_expires_at = null
  where id = invitation_id and used_at is null;

  if not found then
    raise exception 'Nie można oznaczyć zaproszenia jako użyte' using errcode = 'P0001';
  end if;

  update private.registration_attempts
  set state = 'finalized', updated_at = finalized_at_value
  where reservation_id = p_reservation_id;

  return accepted_at_value;
end;
$$;

create or replace function public.release_registration_reservation(
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  attempt_state text;
  attempt_user_id uuid;
  invitation_id uuid;
  user_exists boolean;
begin
  select a.state, a.auth_user_id, a.invitation_id
  into attempt_state, attempt_user_id, invitation_id
  from private.registration_attempts a
  where a.reservation_id = p_reservation_id
  for update;

  if attempt_state is null then
    return false;
  end if;

  if exists (
    select 1 from private.registration_invitations
    where id = invitation_id and used_at is not null
  ) then
    raise exception 'Nie można zwolnić zużytego zaproszenia' using errcode = 'P0001';
  end if;

  if attempt_state = 'reserved' and attempt_user_id is null then
    null;
  elsif attempt_state = 'auth_created' then
    select exists (select 1 from auth.users where id = attempt_user_id) into user_exists;
    if user_exists then
      raise exception 'Nie można zwolnić rejestracji z istniejącym kontem' using errcode = 'P0001';
    end if;
  else
    raise exception 'Próba rejestracji nie może zostać zwolniona' using errcode = 'P0001';
  end if;

  update private.registration_invitations
  set reserved_at = null,
      reservation_id = null,
      reservation_expires_at = null
  where id = invitation_id;

  update private.registration_attempts
  set state = 'cancelled', updated_at = clock_timestamp()
  where reservation_id = p_reservation_id;

  delete from private.registration_attempts
  where reservation_id = p_reservation_id;

  return true;
end;
$$;

create or replace function public.record_terms_acceptance(
  p_user_id uuid,
  p_terms_version text,
  p_privacy_version text
)
returns timestamptz
language plpgsql
security definer set search_path = ''
as $$
declare
  current_terms_version text;
  current_privacy_version text;
  accepted_at_value timestamptz := clock_timestamp();
  profile_status text;
begin
  select version into current_terms_version
  from private.legal_document_versions
  where kind = 'terms' and is_current;
  select version into current_privacy_version
  from private.legal_document_versions
  where kind = 'privacy' and is_current;

  if p_terms_version is distinct from current_terms_version
     or p_privacy_version is distinct from current_privacy_version then
    raise exception 'Wymagane są aktualne wersje dokumentów' using errcode = 'P0001';
  end if;

  select status into profile_status
  from public.profiles
  where id = p_user_id;

  if profile_status is distinct from 'active' then
    raise exception 'Akceptację może zapisać tylko aktywny profil' using errcode = '42501';
  end if;

  insert into private.terms_acceptances (user_id, terms_version, accepted_at)
  values (p_user_id, p_terms_version, accepted_at_value)
  on conflict (user_id, terms_version) do nothing;

  select accepted_at into accepted_at_value
  from private.terms_acceptances
  where user_id = p_user_id and terms_version = p_terms_version;

  insert into private.privacy_notice_deliveries (user_id, privacy_version, presented_at)
  values (p_user_id, p_privacy_version, accepted_at_value)
  on conflict (user_id, privacy_version) do nothing;

  return accepted_at_value;
end;
$$;

create or replace function public.get_account_access_state(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  current_terms_version text;
  current_privacy_version text;
  accepted_version text;
begin
  select version into current_terms_version
  from private.legal_document_versions
  where kind = 'terms' and is_current;
  select version into current_privacy_version
  from private.legal_document_versions
  where kind = 'privacy' and is_current;

  select terms_version into accepted_version
  from private.terms_acceptances
  where user_id = p_user_id and terms_version = current_terms_version;

  return jsonb_build_object(
    'currentTermsVersion', current_terms_version,
    'currentPrivacyVersion', current_privacy_version,
    'acceptedVersion', accepted_version,
    'acceptanceRequired', accepted_version is null
  );
end;
$$;

create or replace function public.purge_registration_security_logs()
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  cutoff timestamptz := clock_timestamp() - interval '90 days';
  attempts_deleted integer;
  invitations_deleted integer;
begin
  delete from private.registration_attempts
  where updated_at < cutoff;
  get diagnostics attempts_deleted = row_count;

  delete from private.registration_invitations i
  where (i.reservation_id is null or i.reservation_expires_at < clock_timestamp())
    and not exists (
      select 1 from private.registration_attempts a where a.invitation_id = i.id
    )
    and (
      (i.used_at is not null and i.used_at < cutoff)
      or (i.revoked_at is not null and i.revoked_at < cutoff)
      or i.expires_at < cutoff
    );
  get diagnostics invitations_deleted = row_count;

  return jsonb_build_object(
    'attemptsDeleted', attempts_deleted,
    'invitationsDeleted', invitations_deleted
  );
end;
$$;

revoke execute on function public.reserve_registration_invitation(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_registration_invitation(text, text, text, uuid) to service_role;
revoke execute on function public.attach_registration_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.attach_registration_user(uuid, uuid) to service_role;
revoke execute on function public.finalize_invited_registration(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_invited_registration(uuid, uuid, text, text) to service_role;
revoke execute on function public.release_registration_reservation(uuid) from public, anon, authenticated;
grant execute on function public.release_registration_reservation(uuid) to service_role;
revoke execute on function public.record_terms_acceptance(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_terms_acceptance(uuid, text, text) to service_role;
revoke execute on function public.get_account_access_state(uuid) from public, anon, authenticated;
grant execute on function public.get_account_access_state(uuid) to service_role;
revoke execute on function public.purge_registration_security_logs() from public, anon, authenticated;
grant execute on function public.purge_registration_security_logs() to service_role;
