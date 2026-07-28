-- Egzekwuje globalny limit katalogu także dla importów i bezpośrednich zapisów
-- wykonywanych przez service_role.

create or replace function public.enforce_pattern_catalog_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pattern_count bigint;
begin
  -- Upsert istniejącego wzoru nie zwiększa katalogu i musi działać przy count=300.
  if exists (
    select 1
      from public.patterns
     where source_filename = new.source_filename
  ) then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(987654321::bigint);

  select count(*)
    into pattern_count
    from public.patterns;

  if pattern_count >= 300 then
    raise exception using
      errcode = 'P0001',
      message = 'Katalog wzorów osiągnął limit 300 rekordów.';
  end if;

  return new;
end;
$$;

drop trigger if exists patterns_catalog_limit on public.patterns;

create trigger patterns_catalog_limit
  before insert on public.patterns
  for each row execute function public.enforce_pattern_catalog_limit();

revoke execute on function public.enforce_pattern_catalog_limit() from public, anon, authenticated;
grant execute on function public.enforce_pattern_catalog_limit() to service_role;

comment on function public.enforce_pattern_catalog_limit() is
  'Blokuje dodanie nowego wzoru po osiągnięciu limitu 300 rekordów.';
