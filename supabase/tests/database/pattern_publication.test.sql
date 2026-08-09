begin;
select plan(10);

select col_is_null('public', 'patterns', 'description', 'description accepts null');
select col_has_default('public', 'patterns', 'publication_status', '''pending_review''');
select col_type_is('public', 'patterns', 'publication_status', 'text');
select col_type_is('public', 'patterns', 'content_audit_version', 'text');
select col_type_is('public', 'patterns', 'content_audited_at', 'timestamp with time zone');
select col_type_is('public', 'patterns', 'official_source_url', 'text');
select throws_ok(
  $$ insert into public.patterns (source_filename, name, description, publication_status)
     values ('test-published-missing-audit.pdf', 'Test', null, 'published') $$,
  '23514',
  'new published record requires audit metadata'
);
select lives_ok(
  $$ insert into public.patterns (source_filename, name, description, publication_status)
     values ('test-hidden-without-audit.pdf', 'Test', null, 'hidden') $$,
  'hidden record may omit audit metadata'
);
select lives_ok(
  $$ insert into public.patterns (source_filename, name, description, publication_status, content_audit_version, content_audited_at)
     values ('test-published-with-audit.pdf', 'Test', null, 'published', 'v1', now()) $$,
  'published record accepts complete audit metadata'
);
select throws_ok(
  $$ insert into public.patterns (source_filename, name, description, publication_status)
     values ('test-invalid-status.pdf', 'Test', null, 'needs_review') $$,
  '23514',
  'needs_review is not a publication status'
);

select * from finish();
rollback;
