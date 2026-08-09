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
