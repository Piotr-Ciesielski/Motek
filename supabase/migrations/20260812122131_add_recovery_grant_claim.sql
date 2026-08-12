alter table private.auth_recovery_grants
  add column if not exists claimed_at timestamptz;

create or replace function public.claim_auth_recovery_grant(grant_jti text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  claimed_count integer;
begin
  update private.auth_recovery_grants
  set claimed_at = pg_catalog.now()
  where user_id = (select auth.uid())
    and jti_hash = encode(extensions.digest(grant_jti, 'sha256'), 'hex')
    and used_at is null
    and claimed_at is null
    and expires_at > pg_catalog.now();

  get diagnostics claimed_count = row_count;
  return claimed_count = 1;
end;
$$;

create or replace function public.release_auth_recovery_grant(grant_jti text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  released_count integer;
begin
  update private.auth_recovery_grants
  set claimed_at = null
  where user_id = (select auth.uid())
    and jti_hash = encode(extensions.digest(grant_jti, 'sha256'), 'hex')
    and used_at is null
    and claimed_at is not null;

  get diagnostics released_count = row_count;
  return released_count = 1;
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
    and claimed_at is not null
    and expires_at > pg_catalog.now();

  get diagnostics consumed_count = row_count;
  return consumed_count = 1;
end;
$$;

revoke all on function public.claim_auth_recovery_grant(text) from public, anon, authenticated;
revoke all on function public.release_auth_recovery_grant(text) from public, anon, authenticated;
grant execute on function public.claim_auth_recovery_grant(text) to authenticated;
grant execute on function public.release_auth_recovery_grant(text) to authenticated;
revoke all on function public.consume_auth_recovery_grant(text) from public, anon, authenticated;
grant execute on function public.consume_auth_recovery_grant(text) to authenticated;
