begin;
select plan(11);

select col_type_is('public', 'patterns', 'technique', 'text', 'technique is text');
select col_is_null('public', 'patterns', 'technique', 'technique accepts null');
select col_hasnt_default('public', 'patterns', 'technique', 'technique has no default');

select throws_ok(
  $$ insert into public.patterns (source_filename, name, technique, publication_status, matching_requirements)
     values ('test-unknown-technique.pdf', 'Test', 'sprzęt', 'hidden',
       '{"version":2,"variants":[]}'::jsonb) $$,
  '23514',
  'new row for relation "patterns" violates check constraint "patterns_technique_check"'
);

select throws_ok(
  $$ insert into public.patterns (source_filename, name, publication_status, matching_requirements, content_audit_version, content_audited_at)
     values ('test-published-without-technique.pdf', 'Test', 'published',
       '{"version":2,"variants":[]}'::jsonb, '1.0', now()) $$,
  '23514',
  'new row for relation "patterns" violates check constraint "patterns_published_technique_check"'
);

select lives_ok(
  $$ insert into public.patterns (source_filename, name, technique, publication_status, matching_requirements, content_audit_version, content_audited_at)
     values ('test-published-crochet.pdf', 'Test', 'crochet', 'published',
       '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["bawełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb,
       '1.0', now()) $$,
  'published crochet record with audit metadata is accepted'
);

select lives_ok(
  $$ insert into public.patterns (source_filename, name, publication_status, matching_requirements)
     values ('test-hidden-null-technique.pdf', 'Test', 'hidden',
       '{"version":2,"variants":[]}'::jsonb) $$,
  'hidden record may keep technique null'
);

select lives_ok(
  $$ insert into public.patterns (source_filename, name, publication_status, matching_requirements)
     values ('test-pending-null-technique.pdf', 'Test', 'pending_review',
       '{"version":2,"variants":[]}'::jsonb) $$,
  'pending_review record may keep technique null'
);

select lives_ok(
  $$ insert into public.patterns (source_filename, name, technique, publication_status, matching_requirements)
     values ('test-hidden-knitting.pdf', 'Test', 'knitting', 'hidden',
       '{"version":2,"variants":[]}'::jsonb) $$,
  'hidden record may already declare a valid technique'
);

-- Nieopublikowany rekord nie może przejść na published bez techniki
-- (metadane audytu są dostarczane, żeby naruszać wyłącznie brak techniki).
select throws_ok(
  $$ update public.patterns
     set publication_status = 'published',
         content_audit_version = '1.0',
         content_audited_at = now()
     where source_filename = 'test-hidden-null-technique.pdf' $$,
  '23514',
  'new row for relation "patterns" violates check constraint "patterns_published_technique_check"'
);

-- Publikacja z techniką pozostaje dozwolona.
select lives_ok(
  $$ update public.patterns set publication_status = 'published'
     where source_filename = 'test-published-crochet.pdf' $$,
  'published record keeps passing constraints on update'
);

select * from finish();
rollback;
