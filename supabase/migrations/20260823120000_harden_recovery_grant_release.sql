-- Nie pozwala zwolnić wygasłego grantu recovery.

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
