-- Ogranicz funkcję SECURITY DEFINER do wewnętrznego użycia przez PostgreSQL.
-- Nie jest publicznym endpointem RPC aplikacji.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated;
  end if;
end;
$$;
