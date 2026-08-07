-- Odtwarzalny kontrakt bezpieczeństwa magazynu włóczek.
-- Ta migracja jest celowo idempotentna: może zostać wykonana po starszych
-- wariantach licznika public.yarn_store_versions.

create schema if not exists private;

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
