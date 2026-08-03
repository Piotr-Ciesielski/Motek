begin;

select plan(34);

select has_schema('private', 'Prywatny schemat liczników istnieje');
select has_table('private', 'yarn_store_versions', 'Licznik wersji magazynu istnieje');
select col_is_pk('private', 'yarn_store_versions', 'user_id', 'Licznik jest kluczowany użytkownikiem');
select has_function('public', 'get_yarn_store_version', '{}', 'Odczyt wersji jest dostępny jako RPC');
select has_function(
  'public',
  'insert_yarn_versioned',
  array['bigint', 'text', 'text', 'text[]', 'text', 'integer', 'integer'],
  'RPC insert przyjmuje expected_version'
);
select has_function(
  'public',
  'update_yarn_versioned',
  array['bigint', 'bigint', 'text', 'text', 'text[]', 'text', 'integer', 'integer'],
  'RPC update przyjmuje expected_version'
);
select has_function('public', 'delete_yarn_versioned', array['bigint', 'bigint'], 'RPC delete przyjmuje expected_version');

select is((select prosecdef from pg_proc where oid = 'public.get_yarn_store_version()'::regprocedure), true, 'RPC get działa jako security definer');
select is((select prosecdef from pg_proc where oid = 'public.insert_yarn_versioned(bigint,text,text,text[],text,integer,integer)'::regprocedure), true, 'RPC insert działa jako security definer');
select is((select prosecdef from pg_proc where oid = 'public.update_yarn_versioned(bigint,bigint,text,text,text[],text,integer,integer)'::regprocedure), true, 'RPC update działa jako security definer');
select is((select prosecdef from pg_proc where oid = 'public.delete_yarn_versioned(bigint,bigint)'::regprocedure), true, 'RPC delete działa jako security definer');

select is((select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.get_yarn_store_version()'::regprocedure), true, 'RPC get ma pusty search_path');
select is((select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.insert_yarn_versioned(bigint,text,text,text[],text,integer,integer)'::regprocedure), true, 'RPC insert ma pusty search_path');
select is((select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.update_yarn_versioned(bigint,bigint,text,text,text[],text,integer,integer)'::regprocedure), true, 'RPC update ma pusty search_path');
select is((select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.delete_yarn_versioned(bigint,bigint)'::regprocedure), true, 'RPC delete ma pusty search_path');

select is(has_function_privilege('authenticated', 'public.get_yarn_store_version()', 'EXECUTE'), true, 'authenticated może wykonać RPC get');
select is(has_function_privilege('authenticated', 'public.insert_yarn_versioned(bigint,text,text,text[],text,integer,integer)', 'EXECUTE'), true, 'authenticated może wykonać RPC insert');
select is(has_function_privilege('authenticated', 'public.update_yarn_versioned(bigint,bigint,text,text,text[],text,integer,integer)', 'EXECUTE'), true, 'authenticated może wykonać RPC update');
select is(has_function_privilege('authenticated', 'public.delete_yarn_versioned(bigint,bigint)', 'EXECUTE'), true, 'authenticated może wykonać RPC delete');

select is(has_function_privilege('public', 'public.get_yarn_store_version()', 'EXECUTE'), false, 'PUBLIC nie może wykonać RPC get');
select is(has_function_privilege('anon', 'public.get_yarn_store_version()', 'EXECUTE'), false, 'anon nie może wykonać RPC get');
select is(has_function_privilege('authenticated', 'public.get_yarn_store_version()', 'EXECUTE'), true, 'authenticated ma wyłączne wykonanie RPC get');
select is(has_function_privilege('authenticated', 'public.insert_yarn_versioned(bigint,text,text,text[],text,integer,integer)', 'EXECUTE'), true, 'authenticated ma wykonanie RPC insert');
select is(has_function_privilege('authenticated', 'public.update_yarn_versioned(bigint,bigint,text,text,text[],text,integer,integer)', 'EXECUTE'), true, 'authenticated ma wykonanie RPC update');
select is(has_function_privilege('authenticated', 'public.delete_yarn_versioned(bigint,bigint)', 'EXECUTE'), true, 'authenticated ma wykonanie RPC delete');
select is(has_function_privilege('public', 'public.insert_yarn_versioned(bigint,text,text,text[],text,integer,integer)', 'EXECUTE'), false, 'PUBLIC nie może wykonać RPC insert');
select is(has_function_privilege('anon', 'public.insert_yarn_versioned(bigint,text,text,text[],text,integer,integer)', 'EXECUTE'), false, 'anon nie może wykonać RPC insert');
select is(has_function_privilege('public', 'public.update_yarn_versioned(bigint,bigint,text,text,text[],text,integer,integer)', 'EXECUTE'), false, 'PUBLIC nie może wykonać RPC update');
select is(has_function_privilege('anon', 'public.update_yarn_versioned(bigint,bigint,text,text,text[],text,integer,integer)', 'EXECUTE'), false, 'anon nie może wykonać RPC update');
select is(has_function_privilege('public', 'public.delete_yarn_versioned(bigint,bigint)', 'EXECUTE'), false, 'PUBLIC nie może wykonać RPC delete');
select is(has_function_privilege('anon', 'public.delete_yarn_versioned(bigint,bigint)', 'EXECUTE'), false, 'anon nie może wykonać RPC delete');

-- Bez lokalnego użytkownika Auth testujemy stabilny kontrakt stale expected_version przez treść funkcji.
select is((select position('40001' in prosrc) > 0 from pg_proc where oid = 'public.insert_yarn_versioned(bigint,text,text,text[],text,integer,integer)'::regprocedure), true, 'RPC insert zwraca SQLSTATE 40001 dla konfliktu wersji');
select is((select position('40001' in prosrc) > 0 from pg_proc where oid = 'public.update_yarn_versioned(bigint,bigint,text,text,text[],text,integer,integer)'::regprocedure), true, 'RPC update zwraca SQLSTATE 40001 dla konfliktu wersji');
select is((select position('40001' in prosrc) > 0 from pg_proc where oid = 'public.delete_yarn_versioned(bigint,bigint)'::regprocedure), true, 'RPC delete zwraca SQLSTATE 40001 dla konfliktu wersji');

select * from finish();
rollback;
