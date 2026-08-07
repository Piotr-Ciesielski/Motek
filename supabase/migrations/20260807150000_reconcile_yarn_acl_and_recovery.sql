-- Odtwarzalny kontrakt bezpieczeństwa magazynu włóczek.
-- Ta migracja jest celowo idempotentna: może zostać wykonana po starszych
-- wariantach licznika public.yarn_store_versions.

create schema if not exists private;

create table if not exists private.auth_recovery_grants (
  grant_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  jti_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists auth_recovery_grants_user_expiry_idx
  on private.auth_recovery_grants (user_id, expires_at)
  where used_at is null;

revoke all on table private.auth_recovery_grants from public, anon, authenticated;

create or replace function public.create_auth_recovery_grant()
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  grant_jti text := extensions.gen_random_uuid()::text;
begin
  if (select auth.uid()) is null then
    raise exception 'authenticated user required';
  end if;

  insert into private.auth_recovery_grants (user_id, jti_hash, expires_at)
  values (
    (select auth.uid()),
    encode(extensions.digest(grant_jti, 'sha256'), 'hex'),
    pg_catalog.now() + interval '10 minutes'
  );

  return grant_jti;
end;
$$;

create or replace function public.consume_auth_recovery_grant(grant_jti text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  consumed_count integer;
begin
  update private.auth_recovery_grants
  set used_at = pg_catalog.now()
  where user_id = (select auth.uid())
    and jti_hash = encode(extensions.digest(grant_jti, 'sha256'), 'hex')
    and used_at is null
    and expires_at > pg_catalog.now();

  get diagnostics consumed_count = row_count;
  return consumed_count = 1;
end;
$$;

revoke all on function public.create_auth_recovery_grant() from public, anon, authenticated;
revoke all on function public.consume_auth_recovery_grant(text) from public, anon, authenticated;
grant execute on function public.create_auth_recovery_grant() to authenticated;
grant execute on function public.consume_auth_recovery_grant(text) to authenticated;

create table if not exists private.yarn_store_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if to_regclass('public.yarn_store_versions') is not null then
    execute $sql$
      insert into private.yarn_store_versions (user_id, version)
      select user_id, version
      from public.yarn_store_versions
      on conflict (user_id) do update
      set version = greatest(private.yarn_store_versions.version, excluded.version)
    $sql$;
  end if;
end
$$;

revoke all on table private.yarn_store_versions from public, anon, authenticated;
do $$
begin
  if to_regclass('public.yarn_store_versions') is not null then
    execute 'revoke all on table public.yarn_store_versions from public, anon, authenticated';
  end if;
end
$$;
drop table if exists public.yarn_store_versions cascade;

revoke insert, update, delete on table public.yarns from authenticated;
do $$
begin
  if to_regclass('public.yarns_id_seq') is not null then
    execute 'revoke all on sequence public.yarns_id_seq from authenticated';
  end if;
end
$$;
revoke all on table private.yarn_store_versions from public, anon, authenticated;

grant select on table public.yarns to authenticated;
grant execute on function public.get_yarn_store_version() to authenticated;
grant execute on function public.insert_yarn_versioned(bigint, text, text, text[], text, integer, integer) to authenticated;
grant execute on function public.update_yarn_versioned(bigint, bigint, text, text, text[], text, integer, integer) to authenticated;
grant execute on function public.delete_yarn_versioned(bigint, bigint) to authenticated;

comment on table private.yarn_store_versions is
  'Prywatny licznik wersji dla atomowej kontroli współbieżnych zapisów magazynu.';
