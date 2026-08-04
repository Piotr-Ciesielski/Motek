-- The matching engine does not implement grouped strand allocation.
-- Keep the database contract aligned with the application validator.
create or replace function public.reject_unsupported_matching_groups()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_path_exists(
    new.matching_requirements,
    '$.variants[*].requirements[*].held_together_group ? (@ != null && @ != "")'
  ) then
    raise exception using errcode = 'P0001', message = 'held_together_group nie jest obsługiwane';
  end if;
  return new;
end;
$$;

revoke execute on function public.reject_unsupported_matching_groups() from public, anon, authenticated;
grant execute on function public.reject_unsupported_matching_groups() to service_role;

drop trigger if exists patterns_reject_unsupported_matching_groups on public.patterns;
create trigger patterns_reject_unsupported_matching_groups
  before insert or update of matching_requirements on public.patterns
  for each row execute function public.reject_unsupported_matching_groups();

-- The backend now uses the versioned RPCs; remove legacy overloads so they
-- cannot be called accidentally by older clients.
drop function if exists public.insert_yarn_with_limit(text, text, text, text, integer, integer);
drop function if exists public.insert_yarn_with_limit(text, text, text[], text, integer, integer);
