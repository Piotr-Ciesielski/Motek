-- Przywraca creator recovery brakujący w części historycznie scalonych stagingów.
-- Migracja jest forward-only i nie zmienia tabel ani istniejących grantów.

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

revoke all on function public.create_auth_recovery_grant() from public, anon, authenticated;
grant execute on function public.create_auth_recovery_grant() to authenticated;
