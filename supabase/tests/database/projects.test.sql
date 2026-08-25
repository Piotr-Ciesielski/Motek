begin;
select plan(94);

-- Kształt schematu projektów.
select has_table('public', 'projects', 'Tabela projektów istnieje');
select has_table('public', 'project_yarns', 'Tabela przypisań istnieje');
select col_is_pk('public', 'projects', 'id', 'Projekt jest kluczowany identyfikatorem');
select col_is_pk(
  'public',
  'project_yarns',
  array['project_id', 'yarn_id'],
  'Przypisania są kluczowane parą projekt–włóczka'
);
select col_has_default('public', 'projects', 'version', 'Wersja projektu ma wartość domyślną');
select has_column('public', 'projects', 'progress_unit', 'Kolumna jednostki postępu istnieje');
select has_column('public', 'projects', 'progress_count', 'Kolumna licznika postępu istnieje');
select has_column('public', 'projects', 'note', 'Kolumna notatki postępu istnieje');
select has_column('public', 'projects', 'tool_size_mm', 'Kolumna rozmiaru narzędzia istnieje');
select has_column('public', 'projects', 'gauge', 'Kolumna próbki istnieje');
select col_not_null('public', 'projects', 'progress_unit', 'Jednostka postępu jest wymagana');
select col_not_null('public', 'projects', 'progress_count', 'Licznik postępu jest wymagany');
select col_not_null('public', 'projects', 'variant_id', 'Wariant wzoru jest wymagany');
select col_has_default('public', 'projects', 'progress_unit', 'Jednostka postępu ma wartość domyślną');
select col_has_default('public', 'projects', 'progress_count', 'Licznik postępu ma wartość domyślną');
select col_type_is('public', 'project_yarns', 'initial_length_meters', 'integer', 'Początkowe metry są liczbą całkowitą');
select has_index('public', 'projects', 'projects_single_active_per_user_idx', 'Indeks jednego aktywnego projektu istnieje');
select is(
  (select indisunique from pg_index where indexrelid = 'projects_single_active_per_user_idx'::regclass),
  true,
  'Indeks jednego aktywnego projektu jest unikalny'
);

-- RPC tworzenia projektu działa jako security definer i jest dostępny
-- wyłącznie dla backendu (service_role), z jawną tożsamością użytkowniczki.
select has_function(
  'public',
  'create_active_project',
  array['uuid', 'bigint', 'text', 'bigint', 'jsonb'],
  'RPC tworzenia projektu przyjmuje właścicielkę, wzór, wariant, wersję magazynu i przypisania'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.create_active_project(uuid,bigint,text,bigint,jsonb)'::regprocedure),
  true,
  'RPC tworzenia projektu działa jako security definer'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.create_active_project(uuid,bigint,text,bigint,jsonb)'::regprocedure),
  true,
  'RPC tworzenia projektu ma pusty search_path'
);
select is(
  has_function_privilege('authenticated', 'public.create_active_project(uuid,bigint,text,bigint,jsonb)', 'EXECUTE'),
  false,
  'authenticated nie może wykonać RPC tworzenia projektu'
);
select is(
  has_function_privilege('anon', 'public.create_active_project(uuid,bigint,text,bigint,jsonb)', 'EXECUTE'),
  false,
  'anon nie może wykonać RPC tworzenia projektu'
);
select is(
  has_function_privilege('service_role', 'public.create_active_project(uuid,bigint,text,bigint,jsonb)', 'EXECUTE'),
  true,
  'service_role wykonuje tworzenie projektu z backendu'
);
select ok(
  to_regprocedure('public.create_active_project(bigint, text, bigint, jsonb)') is null,
  'Stara sygnatura tworzenia projektu z tożsamością z JWT nie istnieje'
);

-- Bramka prawna z jawnym identyfikatorem jest wyłącznie backendowa.
select is(
  has_function_privilege('authenticated', 'public.has_current_terms_acceptance(uuid)', 'EXECUTE'),
  false,
  'authenticated nie wykonuje bramki prawnej z cudzym identyfikatorem'
);
select is(
  has_function_privilege('anon', 'public.has_current_terms_acceptance(uuid)', 'EXECUTE'),
  false,
  'anon nie wykonuje bramki prawnej z jawnym identyfikatorem'
);
select is(
  has_function_privilege('service_role', 'public.has_current_terms_acceptance(uuid)', 'EXECUTE'),
  true,
  'service_role wykonuje bramkę prawną z jawnym identyfikatorem'
);

-- RPC postępu działa jako security definer z pustym search_path.
select has_function(
  'public',
  'update_active_project_progress',
  array['bigint', 'text', 'integer', 'text', 'numeric', 'text'],
  'RPC postępu przyjmuje wersję projektu, jednostkę, licznik, notatkę, narzędzie i próbkę'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.update_active_project_progress(bigint,text,integer,text,numeric,text)'::regprocedure),
  true,
  'RPC postępu działa jako security definer'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.update_active_project_progress(bigint,text,integer,text,numeric,text)'::regprocedure),
  true,
  'RPC postępu ma pusty search_path'
);
select is(
  has_function_privilege('authenticated', 'public.update_active_project_progress(bigint,text,integer,text,numeric,text)', 'EXECUTE'),
  true,
  'authenticated może wykonać RPC postępu'
);
select is(
  has_function_privilege('anon', 'public.update_active_project_progress(bigint,text,integer,text,numeric,text)', 'EXECUTE'),
  false,
  'anon nie może wykonać RPC postępu'
);

-- Tabele projektów są tylko do odczytu dla właściciela przez RLS.
select is(has_table_privilege('authenticated', 'public.projects', 'SELECT'), true, 'authenticated może odczytać projekty przez RLS');
select is(has_table_privilege('authenticated', 'public.projects', 'INSERT'), false, 'authenticated nie może bezpośrednio dodać projektu');
select is(has_table_privilege('authenticated', 'public.projects', 'UPDATE'), false, 'authenticated nie może bezpośrednio zmienić projektu');
select is(has_table_privilege('authenticated', 'public.projects', 'DELETE'), false, 'authenticated nie może bezpośrednio usunąć projektu');
select is(has_table_privilege('authenticated', 'public.project_yarns', 'SELECT'), true, 'authenticated może odczytać przypisania przez RLS');
select is(has_table_privilege('authenticated', 'public.project_yarns', 'INSERT'), false, 'authenticated nie może bezpośrednio dodać przypisania');
select is(has_table_privilege('anon', 'public.projects', 'SELECT'), false, 'anon nie może odczytać projektów');
select is(
  has_sequence_privilege('authenticated', 'public.projects_id_seq', 'USAGE'),
  false,
  'authenticated nie może użyć sekwencji identyfikatorów projektów'
);

-- Dane testowe powstają jako właściciel bazy, operacje wykonują role API.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'projekt-owner@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"login":"projekt_owner"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'projekt-other@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"login":"projekt_other"}');

insert into public.patterns (source_filename, name, description, publication_status, matching_requirements)
values ('test-projekt-wzor.pdf', 'Wzór testowy', 'Opis testowy wzoru.', 'hidden', '{"version":2,"variants":[]}'::jsonb);

insert into public.yarns (user_id, name, color, material, materials, weight_class, length_meters, weight_grams)
values
  ('11111111-1111-1111-1111-111111111111', 'Własna motek A', 'zielony', 'wełna', array['wełna'], 'dk', 300, 100),
  ('11111111-1111-1111-1111-111111111111', 'Własna motek B', 'granat', 'wełna', array['wełna'], 'dk', 250, 90),
  ('22222222-2222-2222-2222-222222222222', 'Cudza motek', 'czerwony', 'bawełna', array['bawełna'], 'dk', 400, 120);

-- Cudzy aktywny projekt istnieje od początku i musi pozostać niewidoczny.
insert into public.projects (user_id, variant_id, status)
values ('22222222-2222-2222-2222-222222222222', 'm', 'active');

-- Razem z cudzym przypisaniem, żeby widoczność RLS była faktycznie testowana.
insert into public.project_yarns (project_id, yarn_id, role, initial_length_meters, initial_weight_grams)
values (
  (select id from public.projects where user_id = '22222222-2222-2222-2222-222222222222'),
  (select id from public.yarns where name = 'Cudza motek'),
  'główna',
  400,
  120
);

set local role anon;
select throws_ok('select * from public.projects', '42501', NULL, 'anon nie może wykonać SELECT na projektach');
select throws_ok('select * from public.project_yarns', '42501', NULL, 'anon nie może wykonać SELECT na przypisaniach');
select throws_ok(
  $$ select public.create_active_project('11111111-1111-1111-1111-111111111111', 1, 'v', 0, '[]'::jsonb) $$,
  '42501', NULL, 'anon nie może wykonać RPC tworzenia projektu'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

-- Bez aktualnej akceptacji regulaminu projekty są ukryte i oba RPC odmawiają.
select is((select count(*) from public.projects), 0::bigint, 'bez akceptacji regulaminu RLS ukrywa projekty');
select throws_ok(
  $$ select public.update_active_project_progress(1, 'row', 1, NULL, NULL, NULL) $$,
  '42501', 'current terms acceptance required', 'zapis postępu bez akceptacji regulaminu jest odrzucany'
);
reset role;

set local role service_role;
select throws_ok(
  $$ select public.create_active_project(
       '11111111-1111-1111-1111-111111111111',
       (select id from public.patterns where source_filename = 'test-projekt-wzor.pdf'),
       'm',
       0,
       jsonb_build_array(jsonb_build_object('yarn_id', 1, 'role', 'główna', 'initial_length_meters', 300, 'initial_weight_grams', 100))
     ) $$,
  '42501', 'current terms acceptance required', 'tworzenie projektu bez akceptacji regulaminu jest odrzucane'
);
reset role;

-- Użytkowniczka nie może wywołać tworzenia projektu bezpośrednio, nawet z akceptacją.
insert into private.terms_acceptances (user_id, terms_version)
values ('11111111-1111-1111-1111-111111111111', '1.0');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$ select public.create_active_project(
       '11111111-1111-1111-1111-111111111111',
       1,
       'm',
       0,
       '[{"yarn_id":1,"role":"główna","initial_length_meters":10,"initial_weight_grams":10}]'::jsonb
     ) $$,
  '42501', NULL, 'authenticated nie może bezpośrednio wykonać RPC tworzenia projektu'
);
select throws_ok(
  $$ select public.create_active_project(1, 'm', 0, '[{"yarn_id":1,"role":"główna","initial_length_meters":10,"initial_weight_grams":10}]'::jsonb) $$,
  '42883', NULL, 'usunięta sygnatura tworzenia projektu z JWT nie jest wykonywalna przez authenticated'
);
select throws_ok(
  $$ select public.has_current_terms_acceptance('22222222-2222-2222-2222-222222222222') $$,
  '42501', NULL, 'cudzy status akceptacji regulaminu jest niedostępny dla authenticated'
);
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status) values ('11111111-1111-1111-1111-111111111111', 'm', 'active') $$,
  '42501', NULL, 'authenticated nie może bezpośrednio dodać projektu'
);
select throws_ok(
  $$ update public.projects set variant_id = 'x' where user_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', NULL, 'authenticated nie może bezpośrednio zmienić projektu'
);
select throws_ok(
  $$ delete from public.projects where user_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', NULL, 'authenticated nie może bezpośrednio usunąć projektu'
);
select is((select count(*) from public.projects), 0::bigint, 'właścicielka nie widzi cudzych projektów po akceptacji');
select is((select count(*) from public.project_yarns), 0::bigint, 'cudze przypisania pozostają ukryte');

-- Pełna ścieżka sukcesu: backend wyznacza przypisania i woła RPC jako service_role.
reset role;
set local role service_role;
select lives_ok(
  $$ select public.create_active_project(
       '11111111-1111-1111-1111-111111111111',
       (select id from public.patterns where source_filename = 'test-projekt-wzor.pdf'),
       'm',
       0,
       jsonb_build_array(
         jsonb_build_object(
           'yarn_id', (select id from public.yarns where name = 'Własna motek A'),
           'role', 'główna',
           'initial_length_meters', 300,
           'initial_weight_grams', 100
         ),
         jsonb_build_object(
           'yarn_id', (select id from public.yarns where name = 'Własna motek B'),
           'role', 'pomocnicza',
           'initial_length_meters', 250,
           'initial_weight_grams', 90
         )
       )
     ) $$,
  'RPC tworzy aktywny projekt z serwerowo wyznaczonych przypisań'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select is(
  (select status from public.projects where user_id = '11111111-1111-1111-1111-111111111111'),
  'active',
  'Rozpoczęty projekt jest aktywny'
);
select is((select count(*) from public.projects), 1::bigint, 'właściciel widzi wyłącznie własny projekt');
select is((select count(*) from public.project_yarns), 2::bigint, 'przypisania obu motków są widoczne dla właściciela');
reset role;

-- Obrona przed drugim aktywnym projektem, konfliktem wersji i cudzymi motkami.
set local role service_role;
select throws_ok(
  $$ select public.create_active_project(
       '11111111-1111-1111-1111-111111111111',
       (select id from public.patterns where source_filename = 'test-projekt-wzor.pdf'),
       'm',
       0,
       jsonb_build_array(
         jsonb_build_object(
           'yarn_id', (select id from public.yarns where name = 'Własna motek A'),
           'role', 'główna',
           'initial_length_meters', 300,
           'initial_weight_grams', 100
         )
       )
     ) $$,
  'P0001', NULL, 'drugi aktywny projekt jest odrzucany'
);
select throws_ok(
  $$ select public.create_active_project('11111111-1111-1111-1111-111111111111', 1, 'm', 5, '[{"yarn_id":1,"role":"główna","initial_length_meters":10,"initial_weight_grams":10}]'::jsonb) $$,
  'P0003', NULL, 'nieaktualna wersja magazynu jest odrzucana konfliktem'
);
select throws_ok(
  $$ select public.create_active_project(
       '11111111-1111-1111-1111-111111111111',
       1,
       'm',
       0,
       jsonb_build_array(
         jsonb_build_object(
           'yarn_id', (select id from public.yarns where name = 'Cudza motek'),
           'role', 'główna',
           'initial_length_meters', 400,
           'initial_weight_grams', 120
         )
       )
     ) $$,
  'P0002', NULL, 'cudza włóczka jest odrzucana'
);
select throws_ok(
  $$ select public.create_active_project('11111111-1111-1111-1111-111111111111', 1, 'm', 0, '[]'::jsonb) $$,
  'P0001', NULL, 'puste przypisania są odrzucane'
);
reset role;

-- Zapis postępu: sukces zwiększa wersję dokładnie o jeden i utrwala wartości.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select lives_ok(
  $$ select public.update_active_project_progress(1, 'row', 7, 'Świetnie idzie.', 3.5, '12 śl./10 cm') $$,
  'RPC postępu zapisuje wartości dla aktywnego projektu'
);
select is(
  (select version::text from public.projects where status = 'active'),
  '2',
  'zapis postępu zwiększa wersję projektu do dwóch'
);
select is(
  (select progress_count::text from public.projects where status = 'active'),
  '7',
  'licznik postępu zostaje utrwalony'
);
select is(
  (select progress_unit from public.projects where status = 'active'),
  'row',
  'jednostka postępu zostaje utrwalona'
);
select is(
  (select note from public.projects where status = 'active'),
  'Świetnie idzie.',
  'notatka zostaje utrwalona'
);
select is(
  (select tool_size_mm::text from public.projects where status = 'active'),
  '3.5',
  'rozmiar narzędzia zostaje utrwalony'
);
select is(
  (select gauge from public.projects where status = 'active'),
  '12 śl./10 cm',
  'próbka zostaje utrwalona'
);

-- Konflikt dwóch kart: drugi zapis ze starą wersją jest odrzucany bez zmian.
select throws_ok(
  $$ select public.update_active_project_progress(1, 'row', 9, NULL, NULL, NULL) $$,
  'P0003', NULL, 'drugi zapis ze starą wersją projektu jest konfliktem'
);
select is(
  (select progress_count::text from public.projects where status = 'active'),
  '7',
  'odrzucony zapis nie zmienia licznika postępu'
);

-- Obrona w głębi RPC przed wartościami spoza granic.
select throws_ok(
  $$ select public.update_active_project_progress(2, 'weave', 3, NULL, NULL, NULL) $$,
  'P0002', NULL, 'obca jednostka postępu jest odrzucana przez RPC'
);
select throws_ok(
  $$ select public.update_active_project_progress(2, 'row', -1, NULL, NULL, NULL) $$,
  'P0002', NULL, 'ujemny licznik postępu jest odrzucany przez RPC'
);
select throws_ok(
  $$ select public.update_active_project_progress(2, 'row', 3, repeat('a', 501), NULL, NULL) $$,
  'P0002', NULL, 'zbyt długa notatka jest odrzucana przez RPC'
);
select throws_ok(
  $$ select public.update_active_project_progress(2, 'row', 3, NULL, 3.55, NULL) $$,
  'P0002', NULL, 'rozmiar narzędzia z dwoma miejscami dziesiętnymi jest odrzucany przez RPC'
);
reset role;

-- Częściowy indeks unikalny pozostaje twardą regułą także poza RPC.
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status)
     values ('11111111-1111-1111-1111-111111111111', 'm', 'active') $$,
  '23505', NULL, 'indeks odrzuca drugi aktywny projekt tego samego użytkownika'
);

-- Spójność stanu terminalnego.
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status)
     values ('11111111-1111-1111-1111-111111111111', 'm', 'completed') $$,
  '23514', NULL, 'projekt zakończony wymaga ended_at'
);
select lives_ok(
  $$ insert into public.projects (user_id, variant_id, status, ended_at)
     values ('11111111-1111-1111-1111-111111111111', 'm', 'completed', now()) $$,
  'projekt zakończony z ended_at jest przyjmowany'
);

-- Granice kolumn postępu obowiązują także poza RPC.
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status, ended_at, progress_unit)
     values ('11111111-1111-1111-1111-111111111111', 'm', 'completed', now(), 'weave') $$,
  '23514', NULL, 'obca jednostka postępu jest odrzucana przez CHECK'
);
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status, ended_at, progress_count)
     values ('11111111-1111-1111-1111-111111111111', 'm', 'completed', now(), -1) $$,
  '23514', NULL, 'ujemny licznik postępu jest odrzucany przez CHECK'
);
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status, ended_at, note)
     values ('11111111-1111-1111-1111-111111111111', 'm', 'completed', now(), repeat('a', 501)) $$,
  '23514', NULL, 'zbyt długa notatka jest odrzucana przez CHECK'
);
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status, ended_at, tool_size_mm)
     values ('11111111-1111-1111-1111-111111111111', 'm', 'completed', now(), 0.4) $$,
  '23514', NULL, 'zbyt małe narzędzie jest odrzucane przez CHECK'
);
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status, ended_at, tool_size_mm)
     values ('11111111-1111-1111-1111-111111111111', 'm', 'completed', now(), 50.1) $$,
  '23514', NULL, 'zbyt duże narzędzie jest odrzucane przez CHECK'
);
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status, ended_at, gauge)
     values ('11111111-1111-1111-1111-111111111111', 'm', 'completed', now(), repeat('g', 121)) $$,
  '23514', NULL, 'zbyt długa próbka jest odrzucana przez CHECK'
);

-- Wariant wzoru jest wymagany i ograniczony jak w polityce projektu.
select throws_ok(
  $$ insert into public.projects (user_id, status)
     values ('11111111-1111-1111-1111-111111111111', 'active') $$,
  '23502', NULL, 'projekt bez wariantu jest odrzucany przez NOT NULL'
);
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status)
     values ('11111111-1111-1111-1111-111111111111', '   ', 'active') $$,
  '23514', NULL, 'pusty wariant jest odrzucany przez CHECK'
);
select throws_ok(
  $$ insert into public.projects (user_id, variant_id, status)
     values ('11111111-1111-1111-1111-111111111111', repeat('v', 101), 'active') $$,
  '23514', NULL, 'zbyt długi wariant jest odrzucany przez CHECK'
);

select lives_ok(
  $$ insert into public.projects (user_id, variant_id, status, ended_at, progress_unit, progress_count, tool_size_mm)
     values ('11111111-1111-1111-1111-111111111111', 'm', 'completed', now(), 'round', 9, 50.0) $$,
  'graniczne wartości postępu są przyjmowane'
);

-- Przypisany motek nie da się usunąć pojedynczo (23503 przy sprawdzeniu na
-- koniec instrukcji), ale usuwanie konta przechodzi dzięki odroczonemu
-- sprawdzeniu klucza po skasowaniu przypisań.
set constraints project_yarns_yarn_id_fkey immediate;
select throws_ok(
  $$ delete from public.yarns where name = 'Własna motek A' $$,
  '23503', NULL, 'usunięcie przypisanego motka jest blokowane'
);
set constraints project_yarns_yarn_id_fkey deferred;

-- Usunięcie wzoru z katalogu ustawia pattern_id na NULL, projekt zostaje.
select lives_ok($$ delete from public.patterns where source_filename = 'test-projekt-wzor.pdf' $$);
select is(
  (select pattern_id from public.projects where user_id = '11111111-1111-1111-1111-111111111111' and status = 'active'),
  NULL::bigint,
  'usunięty wzór pozostawia aktywny projekt z pustym pattern_id'
);

-- Usunięcie konta kaskadowo usuwa projekt i przypisania.
delete from public.projects where user_id = '22222222-2222-2222-2222-222222222222';
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*) from public.projects where user_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'usunięcie konta usuwa projekty użytkownika'
);
select is((select count(*) from public.project_yarns), 0::bigint, 'usunięcie konta usuwa przypisania motków');

select * from finish();
rollback;
