do $$
declare
  existing_constraint_definition text;
begin
  select pg_catalog.pg_get_constraintdef(oid)
    into existing_constraint_definition
  from pg_catalog.pg_constraint
  where conrelid = 'private.auth_recovery_grants'::pg_catalog.regclass
    and conname = 'auth_recovery_grants_jti_hash_check';

  if existing_constraint_definition is null
     or existing_constraint_definition !~ 'char_length\(jti_hash\)\s*=\s*64' then
    alter table private.auth_recovery_grants
      drop constraint if exists auth_recovery_grants_jti_hash_check;

    update private.auth_recovery_grants
    set jti_hash = pg_catalog.encode(
      pg_catalog.decode(
        pg_catalog.translate(jti_hash, '-_', '+/')
          || pg_catalog.repeat('=', (4 - (pg_catalog.char_length(jti_hash) % 4)) % 4),
        'base64'
      ),
      'hex'
    )
    where pg_catalog.char_length(jti_hash) = 43;

    alter table private.auth_recovery_grants
      add constraint auth_recovery_grants_jti_hash_check
      check (char_length(jti_hash) = 64);
  end if;
end;
$$;

create or replace function public.release_auth_recovery_grant(grant_jti text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  released_count integer;
begin
  update private.auth_recovery_grants
  set claimed_at = null
  where user_id = (select auth.uid())
    and jti_hash = encode(extensions.digest(grant_jti, 'sha256'), 'hex')
    and used_at is null
    and claimed_at is not null
    and expires_at > pg_catalog.now();

  get diagnostics released_count = row_count;
  return released_count = 1;
end;
$$;

revoke all on function public.release_auth_recovery_grant(text) from public, anon, authenticated;
grant execute on function public.release_auth_recovery_grant(text) to authenticated;
