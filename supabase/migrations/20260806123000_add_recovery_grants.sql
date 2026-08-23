-- Jednorazowe granty odzyskiwania hasła nie mogą trafiać do publicznego API.
create schema if not exists private;

create table private.auth_recovery_grants (
  jti_hash text primary key check (char_length(jti_hash) = 43),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index auth_recovery_grants_user_id_idx
  on private.auth_recovery_grants (user_id);

alter table private.auth_recovery_grants enable row level security;
revoke all on schema private from public, anon, authenticated;
revoke all on table private.auth_recovery_grants from public, anon, authenticated;

create function public.create_auth_recovery_grant(
  p_user_id uuid,
  p_jti_hash text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_jti_hash is null or char_length(p_jti_hash) <> 43 then
    raise exception using errcode = '22023', message = 'invalid recovery grant identifier';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '15 minutes' then
    raise exception using errcode = '22023', message = 'invalid recovery grant expiry';
  end if;

  insert into private.auth_recovery_grants (jti_hash, user_id, expires_at)
  values (p_jti_hash, p_user_id, p_expires_at);

  return true;
end;
$$;

create function public.consume_auth_recovery_grant(
  p_user_id uuid,
  p_jti_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.auth_recovery_grants
  set used_at = now()
  where jti_hash = p_jti_hash
    and user_id = p_user_id
    and claimed_at is not null
    and used_at is null
    and expires_at > now();

  return found;
end;
$$;

create function public.claim_auth_recovery_grant(
  p_user_id uuid,
  p_jti_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.auth_recovery_grants
  set claimed_at = now()
  where jti_hash = p_jti_hash
    and user_id = p_user_id
    and claimed_at is null
    and used_at is null
    and expires_at > now();

  return found;
end;
$$;

create function public.release_auth_recovery_grant(
  p_user_id uuid,
  p_jti_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.auth_recovery_grants
  set claimed_at = null
  where jti_hash = p_jti_hash
    and user_id = p_user_id
    and claimed_at is not null
    and used_at is null;

  return found;
end;
$$;

revoke all on function public.create_auth_recovery_grant(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.consume_auth_recovery_grant(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_auth_recovery_grant(uuid, text) from public, anon, authenticated;
revoke all on function public.release_auth_recovery_grant(uuid, text) from public, anon, authenticated;
grant execute on function public.create_auth_recovery_grant(uuid, text, timestamptz) to service_role;
grant execute on function public.consume_auth_recovery_grant(uuid, text) to service_role;
grant execute on function public.claim_auth_recovery_grant(uuid, text) to service_role;
grant execute on function public.release_auth_recovery_grant(uuid, text) to service_role;

comment on table private.auth_recovery_grants is
  'Jednorazowe, krótkotrwałe granty odzyskiwania hasła przechowywane jako skrót jti.';
