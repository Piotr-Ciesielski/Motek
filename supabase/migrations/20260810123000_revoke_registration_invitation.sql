-- Service-only operator actions for creating and revoking invitations safely.
create or replace function public.create_registration_invitation(
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(p_email));
  invitation_id uuid;
begin
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_token_hash is null
     or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at is null
     or p_expires_at <= clock_timestamp() then
    raise exception 'Nieprawidłowe dane zaproszenia' using errcode = '22023';
  end if;

  insert into private.registration_invitations (email, token_hash, expires_at)
  values (normalized_email, p_token_hash, p_expires_at)
  returning id into invitation_id;

  return invitation_id;
end;
$$;

revoke all on function public.create_registration_invitation(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_registration_invitation(text, text, timestamptz) to service_role;

create or replace function public.revoke_registration_invitation(
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.registration_invitations
  set revoked_at = clock_timestamp()
  where id = p_invitation_id
    and used_at is null
    and revoked_at is null
    and reservation_id is null;

  return found;
end;
$$;

revoke all on function public.revoke_registration_invitation(uuid) from public, anon, authenticated;
grant execute on function public.revoke_registration_invitation(uuid) to service_role;
