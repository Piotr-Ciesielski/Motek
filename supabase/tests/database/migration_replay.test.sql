begin;

select plan(8);

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
select has_constraint('public', 'patterns', 'patterns_publication_status_check', 'replay odtwarza constraint statusu publikacji');
select has_constraint('public', 'patterns', 'patterns_published_audit_check', 'replay odtwarza constraint audytu publikacji');

select * from finish();
rollback;
