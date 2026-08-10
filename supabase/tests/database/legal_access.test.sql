begin;

select plan(19);

select has_function(
  'public',
  'has_current_terms_acceptance',
  '{}',
  'Bramka aktualnej akceptacji regulaminu istnieje'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.has_current_terms_acceptance()'::regprocedure),
  true,
  'Bramka działa jako security definer'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.has_current_terms_acceptance()'::regprocedure),
  true,
  'Bramka ma pusty search_path'
);
select is(has_function_privilege('public', 'public.has_current_terms_acceptance()', 'EXECUTE'), false, 'PUBLIC nie wykonuje bramki');
select is(has_function_privilege('anon', 'public.has_current_terms_acceptance()', 'EXECUTE'), false, 'anon nie wykonuje bramki');
select is(has_function_privilege('authenticated', 'public.has_current_terms_acceptance()', 'EXECUTE'), true, 'authenticated wykonuje bramkę');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000601', 'authenticated', 'authenticated', 'current-terms@example.com', 'not-a-real-password', now(), '{}'::jsonb, '{"login":"currentterms"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000602', 'authenticated', 'authenticated', 'stale-terms@example.com', 'not-a-real-password', now(), '{}'::jsonb, '{"login":"staleterms"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000603', 'authenticated', 'authenticated', 'missing-terms@example.com', 'not-a-real-password', now(), '{}'::jsonb, '{"login":"missingterms"}'::jsonb, now(), now());

insert into private.terms_acceptances (user_id, terms_version)
values
  ('00000000-0000-0000-0000-000000000601', '1.0'),
  ('00000000-0000-0000-0000-000000000602', '0.9');

insert into public.yarns (user_id, name, color, materials, weight_class, length_meters, weight_grams)
values ('00000000-0000-0000-0000-000000000601', 'Włóczka testowa', 'niebieski', array['wełna'], 'dk', 100, 50);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select is(public.has_current_terms_acceptance(), true, 'Bieżąca akceptacja otwiera bramkę');
select is((select count(*) from public.profiles), 1::bigint, 'Bieżąca akceptacja odczytuje własny profil');
select is((select count(*) from public.yarns), 1::bigint, 'Bieżąca akceptacja odczytuje własne włóczki');
select lives_ok(
  $$ select public.insert_yarn_versioned(0, 'Nowa włóczka', 'zielony', array['wełna'], 'dk', 120, 60) $$,
  'Bieżąca akceptacja zapisuje włóczkę przez RPC'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select is(public.has_current_terms_acceptance(), false, 'Stara akceptacja zamyka bramkę');
select is((select count(*) from public.profiles), 0::bigint, 'Stara akceptacja nie odczytuje profilu');
select is((select count(*) from public.yarns), 0::bigint, 'Stara akceptacja nie odczytuje włóczek');
select throws_ok(
  $$ select public.insert_yarn_versioned(0, 'Zablokowana włóczka', 'czerwony', array['wełna'], 'dk', 100, 50) $$,
  '42501',
  'current terms acceptance required',
  'Stara akceptacja nie zapisuje przez RPC'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000603', true);
select is(public.has_current_terms_acceptance(), false, 'Brak akceptacji zamyka bramkę');
select is((select count(*) from public.profiles), 0::bigint, 'Brak akceptacji nie odczytuje profilu');
select is((select count(*) from public.yarns), 0::bigint, 'Brak akceptacji nie odczytuje włóczek');
select throws_ok(
  $$ select public.get_yarn_store_version() $$,
  '42501',
  'current terms acceptance required',
  'Brak akceptacji nie odczytuje wersji przez RPC'
);
select throws_ok(
  $$ insert into private.terms_acceptances (user_id, terms_version) values ('00000000-0000-0000-0000-000000000603', '1.0') $$,
  '42501',
  'permission denied for schema private',
  'Nie można bezpośrednio zapisać historii akceptacji'
);

select * from finish();
rollback;
