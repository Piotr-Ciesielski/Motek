begin;

select plan(16);

select has_function(
  'public',
  'validate_pattern_matching_requirements',
  array[]::text[],
  'pełna historia migracji odtwarza funkcję walidatora'
);

select has_trigger(
  'public',
  'patterns',
  'patterns_matching_requirements_validation',
  'pełna historia migracji odtwarza trigger walidatora'
);

select has_column('public', 'patterns', 'publication_status', 'replay odtwarza status publikacji');
select has_column('public', 'patterns', 'content_audit_version', 'replay odtwarza wersję audytu');
select has_column('public', 'patterns', 'content_audited_at', 'replay odtwarza czas audytu');
select has_column('public', 'patterns', 'official_source_url', 'replay odtwarza oficjalne źródło');
select is(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.patterns'::regclass
      and conname = 'patterns_publication_status_check'
  ),
  true,
  'replay odtwarza constraint statusu publikacji'
);
select is(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.patterns'::regclass
      and conname = 'patterns_published_audit_check'
  ),
  true,
  'replay odtwarza constraint audytu publikacji'
);
select has_table('private', 'legal_document_versions', 'replay odtwarza wersje dokumentów prawnych');
select has_table('private', 'registration_invitations', 'replay odtwarza zaproszenia do rejestracji');
select has_table('private', 'registration_attempts', 'replay odtwarza próby rejestracji');
select has_table('private', 'terms_acceptances', 'replay odtwarza akceptacje regulaminu');
select has_table('private', 'privacy_notice_deliveries', 'replay odtwarza przekazania prywatności');
select col_has_default('public', 'profiles', 'status', '''pending_registration''');
select is(
  (select prosrc like '%pending_registration%' from pg_proc where oid = 'public.handle_new_user()'::regprocedure),
  true,
  'replay odtwarza oczekujący stan nowego profilu'
);
select is(has_table_privilege('authenticated', 'private.terms_acceptances', 'SELECT'), false, 'replay utrzymuje prywatne akceptacje poza zasięgiem klienta');

select * from finish();
rollback;
