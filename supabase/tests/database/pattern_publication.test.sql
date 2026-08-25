begin;
select plan(12);

select col_is_null('public', 'patterns', 'description', 'description accepts null');
select col_type_is('public', 'patterns', 'technique', 'text', 'technique is text');
select col_hasnt_default('public', 'patterns', 'technique', 'technique has no default');
select col_has_default('public', 'patterns', 'publication_status', '''pending_review''');
select col_type_is('public', 'patterns', 'publication_status', 'text', 'publication_status is text');
select col_type_is('public', 'patterns', 'content_audit_version', 'text', 'content_audit_version is text');
select col_type_is('public', 'patterns', 'content_audited_at', 'timestamp with time zone', 'content_audited_at is timestamptz');
select col_type_is('public', 'patterns', 'official_source_url', 'text', 'official_source_url is text');
select throws_ok(
  $$ insert into public.patterns (source_filename, name, description, technique, publication_status, matching_requirements)
     values ('test-published-missing-audit.pdf', 'Test', null, 'knitting', 'published', '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb) $$,
  '23514',
  'new row for relation "patterns" violates check constraint "patterns_published_audit_check"'
);
select lives_ok(
  $$ insert into public.patterns (source_filename, name, description, publication_status, matching_requirements)
     values ('test-hidden-without-audit.pdf', 'Test', null, 'hidden', '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb) $$,
  'hidden record may omit audit metadata'
);
select lives_ok(
  $$ insert into public.patterns (source_filename, name, description, technique, publication_status, matching_requirements, content_audit_version, content_audited_at)
     values ('test-published-with-audit.pdf', 'Test', null, 'knitting', 'published', '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb, 'v1', now()) $$,
  'published record accepts complete audit metadata'
);
select throws_ok(
  $$ insert into public.patterns (source_filename, name, description, publication_status, matching_requirements)
     values ('test-invalid-status.pdf', 'Test', null, 'needs_review', '{"version":2,"variants":[{"id":"test","label":"Test","requirements":[{"role":"główna","measurement_basis":"meters","meters_min":100,"materials":["wełna"],"material_match":"all","color_mode":"same","weight_classes":["fingering"]}]}]}'::jsonb) $$,
  '23514',
  'new row for relation "patterns" violates check constraint "patterns_publication_status_check"'
);

select * from finish();
rollback;
