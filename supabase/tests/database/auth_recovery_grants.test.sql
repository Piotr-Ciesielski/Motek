begin;

select plan(12);

select has_table(
  'private',
  'auth_recovery_grants',
  'Granty recovery są przechowywane w prywatnym schemacie'
);
select has_column('private', 'auth_recovery_grants', 'jti_hash', 'Grant przechowuje wyłącznie hash JTI');
select has_column('private', 'auth_recovery_grants', 'used_at', 'Grant ma znacznik zużycia');
select has_function('public', 'create_auth_recovery_grant', '{}', 'RPC tworzenia grantu istnieje');
select has_function(
  'public',
  'consume_auth_recovery_grant',
  array['text'],
  'RPC zużycia grantu istnieje'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.create_auth_recovery_grant()'::regprocedure),
  true,
  'RPC tworzenia działa jako security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.consume_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zużycia działa jako security definer'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.create_auth_recovery_grant()'::regprocedure),
  true,
  'RPC tworzenia ma pusty search_path'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.consume_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zużycia ma pusty search_path'
);

select is(has_table_privilege('anon', 'private.auth_recovery_grants', 'SELECT'), false, 'anon nie czyta grantów');
select is(has_table_privilege('authenticated', 'private.auth_recovery_grants', 'SELECT'), false, 'authenticated nie czyta grantów');
select is(has_function_privilege('anon', 'public.create_auth_recovery_grant()', 'EXECUTE'), false, 'anon nie tworzy grantów');

select * from finish();
rollback;
