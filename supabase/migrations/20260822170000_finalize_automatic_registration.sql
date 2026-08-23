-- Automatyczna rejestracja kończy stan profilu utworzonego przez trigger Auth.
-- Funkcja jest dostępna wyłącznie dla backendu Motka przez service_role.

create or replace function public.finalize_automatic_registration(
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

  select status into profile_status
  from public.profiles
  where id = p_user_id
  for update;

  if profile_status is null or profile_status not in ('pending_registration', 'active') then
    raise exception 'Profil nie może zostać aktywowany' using errcode = '42501';
  end if;

  insert into private.terms_acceptances (user_id, terms_version, accepted_at)
  values (p_user_id, p_terms_version, finalized_at_value)
  on conflict (user_id, terms_version) do nothing;

  insert into private.privacy_notice_deliveries (user_id, privacy_version, presented_at)
  values (p_user_id, p_privacy_version, finalized_at_value)
  on conflict (user_id, privacy_version) do nothing;

  update public.profiles
  set status = 'active', updated_at = finalized_at_value
  where id = p_user_id;

  return finalized_at_value;
end;
$$;

revoke execute on function public.finalize_automatic_registration(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_automatic_registration(uuid, text, text) to service_role;
