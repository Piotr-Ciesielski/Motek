-- Ogranicz funkcję SECURITY DEFINER do wewnętrznego użycia przez PostgreSQL.
-- Nie jest publicznym endpointem RPC aplikacji.

revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
