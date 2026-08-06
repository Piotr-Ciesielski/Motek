begin;

select plan(76);

select has_schema('private', 'Prywatny schemat liczników istnieje');
select has_table('private', 'yarn_store_versions', 'Licznik wersji magazynu istnieje');
select hasnt_table('public', 'yarn_store_versions', 'Publiczny duplikat licznika wersji nie istnieje');
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

select is(has_table_privilege('authenticated', 'public.yarns', 'SELECT'), true, 'authenticated może odczytać magazyn przez RLS');
select is(has_table_privilege('authenticated', 'public.yarns', 'INSERT'), false, 'authenticated nie może bezpośrednio dodać włóczki');
select is(has_table_privilege('authenticated', 'public.yarns', 'UPDATE'), false, 'authenticated nie może bezpośrednio zmienić włóczki');
select is(has_table_privilege('authenticated', 'public.yarns', 'DELETE'), false, 'authenticated nie może bezpośrednio usunąć włóczki');
select is(has_table_privilege('anon', 'public.yarns', 'SELECT'), false, 'anon nie może odczytać magazynu');
select is(has_sequence_privilege('authenticated', 'public.yarns_id_seq', 'USAGE'), false, 'authenticated nie może użyć sekwencji identyfikatorów');
select is(has_sequence_privilege('authenticated', 'public.yarns_id_seq', 'SELECT'), false, 'authenticated nie może odczytać sekwencji identyfikatorów');
select is(has_sequence_privilege('anon', 'public.yarns_id_seq', 'USAGE'), false, 'anon nie może użyć sekwencji identyfikatorów');
select is(has_sequence_privilege('anon', 'public.yarns_id_seq', 'SELECT'), false, 'anon nie może odczytać sekwencji identyfikatorów');

select is((select position('P0003' in prosrc) > 0 from pg_proc where oid = 'public.insert_yarn_versioned(bigint,text,text,text[],text,integer,integer)'::regprocedure), true, 'RPC insert zwraca SQLSTATE P0003 dla konfliktu wersji');
select is((select position('P0003' in prosrc) > 0 from pg_proc where oid = 'public.update_yarn_versioned(bigint,bigint,text,text,text[],text,integer,integer)'::regprocedure), true, 'RPC update zwraca SQLSTATE P0003 dla konfliktu wersji');
select is((select position('P0003' in prosrc) > 0 from pg_proc where oid = 'public.delete_yarn_versioned(bigint,bigint)'::regprocedure), true, 'RPC delete zwraca SQLSTATE P0003 dla konfliktu wersji');

-- Dane testowe powstają jako właściciel bazy, a sprawdzane operacje wykonują
-- rzeczywiste role API. Zmiana grantów, RLS lub atomowości RPC je złamie.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'yarn-owner@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"login":"yarn_owner"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'yarn-other@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"login":"yarn_other"}');

insert into public.yarns (user_id, name, color, material, materials, weight_class, length_meters, weight_grams)
values ('22222222-2222-2222-2222-222222222222', 'Cudza włóczka', 'granat', 'wełna', array['wełna'], 'dk', 100, 50);
select set_config('test.other_yarn_id', (select id::text from public.yarns where user_id = '22222222-2222-2222-2222-222222222222'), true);

set local role anon;
select throws_ok('select * from public.yarns', '42501', 'anon nie może wykonać SELECT na magazynie');
select throws_ok($$ insert into public.yarns (user_id, name, color, material, materials, weight_class, length_meters, weight_grams) values ('11111111-1111-1111-1111-111111111111', 'Anon', 'biały', 'wełna', array['wełna'], 'dk', 100, 50) $$, '42501', 'anon nie może wykonać INSERT na magazynie');
select throws_ok($$ update public.yarns set name = 'Anon' where user_id = '22222222-2222-2222-2222-222222222222' $$, '42501', 'anon nie może wykonać UPDATE na magazynie');
select throws_ok($$ delete from public.yarns where user_id = '22222222-2222-2222-2222-222222222222' $$, '42501', 'anon nie może wykonać DELETE na magazynie');
select throws_ok($$ select nextval('public.yarns_id_seq') $$, '42501', 'anon nie może użyć sekwencji identyfikatorów');
select throws_ok($$ select last_value from public.yarns_id_seq $$, '42501', 'anon nie może odczytać sekwencji identyfikatorów');
select throws_ok('select public.get_yarn_store_version()', '42501', 'anon nie może wykonać RPC get');
select throws_ok($$ select public.insert_yarn_versioned(0, 'Anon', 'biały', array['wełna'], 'dk', 100, 50) $$, '42501', 'anon nie może wykonać RPC insert');
select throws_ok($$ select public.update_yarn_versioned(0, 0, 'Anon', 'biały', array['wełna'], 'dk', 100, 50) $$, '42501', 'anon nie może wykonać RPC update');
select throws_ok('select public.delete_yarn_versioned(0, 0)', '42501', 'anon nie może wykonać RPC delete');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select throws_ok($$ insert into public.yarns (user_id, name, color, material, materials, weight_class, length_meters, weight_grams) values ('11111111-1111-1111-1111-111111111111', 'Bez RPC', 'biały', 'wełna', array['wełna'], 'dk', 100, 50) $$, '42501', 'authenticated nie może wykonać bezpośredniego INSERT');
select throws_ok($$ update public.yarns set name = 'Bez RPC' where user_id = '22222222-2222-2222-2222-222222222222' $$, '42501', 'authenticated nie może wykonać bezpośredniego UPDATE');
select throws_ok($$ delete from public.yarns where user_id = '22222222-2222-2222-2222-222222222222' $$, '42501', 'authenticated nie może wykonać bezpośredniego DELETE');
select throws_ok($$ select nextval('public.yarns_id_seq') $$, '42501', 'authenticated nie może użyć sekwencji identyfikatorów');
select throws_ok($$ select last_value from public.yarns_id_seq $$, '42501', 'authenticated nie może odczytać sekwencji identyfikatorów');
select is((select count(*) from public.yarns), 0::bigint, 'RLS ukrywa cudze dane przed authenticated');
select is((select count(*) from public.yarns where user_id = '22222222-2222-2222-2222-222222222222'), 0::bigint, 'RLS nie ujawnia danych drugiego użytkownika');
select is(public.get_yarn_store_version(), 0::bigint, 'RPC get tworzy i zwraca wersję 0 właściciela');
select is((public.insert_yarn_versioned(0, 'Własna włóczka', 'zielony', array['wełna'], 'dk', 120, 50) ->> 'version')::bigint, 1::bigint, 'RPC insert dodaje włóczkę i zwiększa wersję');
select is((select count(*) from public.yarns), 1::bigint, 'po RPC insert właściciel widzi własną włóczkę');
select is((public.update_yarn_versioned(1, (select id from public.yarns where name = 'Własna włóczka'), 'Zmieniona włóczka', 'zielony', array['wełna'], 'dk', 130, 55) ->> 'version')::bigint, 2::bigint, 'RPC update zmienia rekord i wersję');
select is((select name from public.yarns), 'Zmieniona włóczka', 'RPC update zapisuje nową wartość');
select throws_ok($$ select public.update_yarn_versioned(1, (select id from public.yarns where name = 'Zmieniona włóczka'), 'Konflikt', 'zielony', array['wełna'], 'dk', 130, 55) $$, 'P0003', 'stara wersja jest odrzucana konfliktem');
select is((select name from public.yarns), 'Zmieniona włóczka', 'konflikt wycofuje zmianę rekordu');
select is(public.get_yarn_store_version(), 2::bigint, 'konflikt wycofuje zmianę licznika wersji');
select throws_ok($$ select public.update_yarn_versioned(2, current_setting('test.other_yarn_id')::bigint, 'Cudza zmiana', 'granat', array['wełna'], 'dk', 100, 50) $$, 'P0002', 'RPC nie pozwala zmienić cudzego rekordu');
select is(public.get_yarn_store_version(), 2::bigint, 'odrzucona cudza zmiana wycofuje licznik wersji');
select is((public.delete_yarn_versioned(2, (select id from public.yarns where name = 'Zmieniona włóczka')) ->> 'version')::bigint, 3::bigint, 'RPC delete usuwa rekord i zwiększa wersję');
select is((select count(*) from public.yarns), 0::bigint, 'po RPC delete właściciel nie widzi usuniętej włóczki');
reset role;

insert into public.yarns (user_id, name, color, material, materials, weight_class, length_meters, weight_grams)
select '11111111-1111-1111-1111-111111111111', 'Limit ' || number, 'szary', 'wełna', array['wełna'], 'dk', 100, 50
from generate_series(1, 500) as number;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select throws_ok($$ select public.insert_yarn_versioned(3, 'Ponad limit', 'szary', array['wełna'], 'dk', 100, 50) $$, 'P0001', 'RPC insert odrzuca 501. włóczkę');
select is((select count(*) from public.yarns), 500::bigint, 'odrzucony limit wycofuje insert');
select is(public.get_yarn_store_version(), 3::bigint, 'odrzucony limit wycofuje zmianę wersji');
reset role;

select * from finish();
rollback;
