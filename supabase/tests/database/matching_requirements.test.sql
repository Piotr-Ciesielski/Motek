begin;

select plan(17);

insert into public.patterns (
  name,
  description,
  source_filename,
  matching_requirements
) values (
  'Wzór testowy walidatora',
  'Rekord pomocniczy dla walidatora matching_requirements.',
  'matching-requirements-validation-test.pdf',
  '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb
);

select throws_ok($$ update public.patterns set matching_requirements = '{}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'matching_requirements musi być dokumentem wersji 2 z tablicą variants.', 'pusty dokument jest odrzucany');
select throws_ok($$ update public.patterns set matching_requirements = '{"version":2}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'matching_requirements musi być dokumentem wersji 2 z tablicą variants.', 'dokument bez variants jest odrzucany');
select throws_ok($$ update public.patterns set matching_requirements = '{"version":2,"variants":[{"label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'Wariant ma nieprawidłowe id.', 'wariant bez id jest odrzucany');
select throws_ok($$ update public.patterns set matching_requirements = '{"version":2,"variants":[{"id":"test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'Wariant ma nieprawidłową etykietę.', 'wariant bez label jest odrzucany');
select throws_ok($$ update public.patterns set matching_requirements = '{"version":2,"variants":[{"id":"test","label":"Test"}]}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'Wariant musi zawierać od 1 do 8 ról.', 'wariant bez requirements jest odrzucany');
select throws_ok($$ update public.patterns set matching_requirements = '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'Rola ma nieprawidłową nazwę.', 'rola bez role jest odrzucana');
select throws_ok($$ update public.patterns set matching_requirements = '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'Rola ma nieprawidłową podstawę pomiaru.', 'rola bez measurement_basis jest odrzucana');
select throws_ok($$ update public.patterns set matching_requirements = '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'Rola ma nieprawidłowy tryb materiału.', 'rola bez material_match jest odrzucana');
select throws_ok($$ update public.patterns set matching_requirements = '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'Materiały roli muszą być tablicą.', 'rola bez materials jest odrzucana');
select throws_ok($$ update public.patterns set matching_requirements = '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","weight_classes":["fingering"]}]}]}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'Rola ma nieprawidłowy tryb koloru.', 'rola bez color_mode jest odrzucana');
select throws_ok($$ update public.patterns set matching_requirements = '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same"}]}]}'::jsonb where id = (select id from public.patterns limit 1) $$, 'P0001', 'Rola musi mieć grubość włóczki.', 'rola bez weight_classes jest odrzucana');
select lives_ok($$ update public.patterns set matching_requirements = '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"],"held_together_group":"oslo-hat"}]}]}'::jsonb where id = (select id from public.patterns limit 1) $$, 'held_together_group pozostaje dozwolonym opisem nitek trzymanych razem');
select ok(not has_function_privilege('public', 'public.validate_pattern_matching_requirements()', 'EXECUTE'), 'PUBLIC nie ma EXECUTE walidatora');
select ok(not has_function_privilege('anon', 'public.validate_pattern_matching_requirements()', 'EXECUTE'), 'anon nie ma EXECUTE walidatora');
select ok(not has_function_privilege('authenticated', 'public.validate_pattern_matching_requirements()', 'EXECUTE'), 'authenticated nie ma EXECUTE walidatora');
select ok(has_function_privilege('service_role', 'public.validate_pattern_matching_requirements()', 'EXECUTE'), 'service_role ma EXECUTE walidatora');
select ok(exists (select 1 from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace cross join lateral unnest(coalesce(p.proconfig, array[]::text[])) as config(setting) where n.nspname = 'public' and p.proname = 'validate_pattern_matching_requirements' and config.setting in ('search_path=', 'search_path=""')), 'walidator ma pusty search_path');

select * from finish();
rollback;