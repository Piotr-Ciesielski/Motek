-- Wersjonowane RPC są jedyną ścieżką zapisu magazynu włóczek.
revoke insert, update, delete on table public.yarns from authenticated;
grant select on table public.yarns to authenticated;

-- Bez dostępu do sekwencji bezpośredni insert nie może ominąć RPC.
revoke usage, select on sequence public.yarns_id_seq from authenticated;

-- Jawnie ograniczamy wykonywanie funkcji do zalogowanych użytkowników.
revoke execute on function public.get_yarn_store_version() from public, anon;
revoke execute on function public.insert_yarn_versioned(bigint, text, text, text[], text, integer, integer) from public, anon;
revoke execute on function public.update_yarn_versioned(bigint, bigint, text, text, text[], text, integer, integer) from public, anon;
revoke execute on function public.delete_yarn_versioned(bigint, bigint) from public, anon;
grant execute on function public.get_yarn_store_version() to authenticated;
grant execute on function public.insert_yarn_versioned(bigint, text, text, text[], text, integer, integer) to authenticated;
grant execute on function public.update_yarn_versioned(bigint, bigint, text, text, text[], text, integer, integer) to authenticated;
grant execute on function public.delete_yarn_versioned(bigint, bigint) to authenticated;

-- W starszych środowiskach mógł istnieć publiczny duplikat prywatnego licznika.
-- Usuwamy go tylko po potwierdzeniu, że nie zawiera danych do zachowania.
do $$
begin
  if to_regclass('public.yarn_store_versions') is null then
    return;
  end if;

  if exists (select 1 from public.yarn_store_versions) then
    raise exception using
      errcode = 'P0001',
      message = 'public.yarn_store_versions zawiera dane i wymaga ręcznej migracji przed usunięciem';
  end if;

  drop table public.yarn_store_versions;
end;
$$;
