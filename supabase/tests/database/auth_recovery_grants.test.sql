begin;

select plan(23);

select has_schema('private', 'prywatny schemat grantów recovery istnieje');
select has_table('private', 'auth_recovery_grants', 'granty recovery są przechowywane poza publicznym schematem');
select has_function(
  'public',
  'create_auth_recovery_grant',
  array['uuid', 'text', 'timestamp with time zone'],
  'RPC tworzenia grantu ma stabilny kontrakt'
);
select has_column('private', 'auth_recovery_grants', 'jti_hash', 'Grant przechowuje wyłącznie hash JTI');
select has_column('private', 'auth_recovery_grants', 'used_at', 'Grant ma znacznik zużycia');
select has_column('private', 'auth_recovery_grants', 'claimed_at', 'Grant ma znacznik zajęcia');
select has_function('public', 'create_auth_recovery_grant', '{}', 'RPC tworzenia grantu istnieje');
select has_function(
  'public',
  'consume_auth_recovery_grant',
  array['uuid', 'text'],
  'RPC zużycia grantu ma stabilny kontrakt'
);
select has_function(
  'public',
  'claim_auth_recovery_grant',
  array['text'],
  'RPC zajęcia grantu istnieje'
);
select has_function(
  'public',
  'release_auth_recovery_grant',
  array['text'],
  'RPC zwolnienia grantu istnieje'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.create_auth_recovery_grant(uuid,text,timestamptz)'::regprocedure),
  true,
  'RPC tworzenia działa jako security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.consume_auth_recovery_grant(uuid,text)'::regprocedure),
  true,
  'RPC zużycia działa jako security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.claim_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zajęcia działa jako security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.release_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zwolnienia działa jako security definer'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.create_auth_recovery_grant()'::regprocedure),
  true,
  'RPC tworzenia ma pusty search_path'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.consume_auth_recovery_grant(uuid,text)'::regprocedure),
  true,
  'RPC zużycia ma pusty search_path'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.claim_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zajęcia ma pusty search_path'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.release_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zwolnienia ma pusty search_path'
);

select is(has_table_privilege('anon', 'private.auth_recovery_grants', 'SELECT'), false, 'anon nie czyta grantów');
select is(has_table_privilege('authenticated', 'private.auth_recovery_grants', 'SELECT'), false, 'authenticated nie czyta grantów');
select is(has_function_privilege('anon', 'public.create_auth_recovery_grant()', 'EXECUTE'), false, 'anon nie tworzy grantów');
select is(has_function_privilege('anon', 'public.claim_auth_recovery_grant(text)', 'EXECUTE'), false, 'anon nie zajmuje grantów');
select is(has_function_privilege('anon', 'public.release_auth_recovery_grant(text)', 'EXECUTE'), false, 'anon nie zwalnia grantów');
select is(has_function_privilege('authenticated', 'public.claim_auth_recovery_grant(text)', 'EXECUTE'), true, 'authenticated zajmuje granty');
select is(has_function_privilege('authenticated', 'public.release_auth_recovery_grant(text)', 'EXECUTE'), true, 'authenticated zwalnia granty');

select * from finish();
rollback;
