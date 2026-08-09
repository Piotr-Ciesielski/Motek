alter table public.patterns alter column description drop not null;

alter table public.patterns
  add column publication_status text not null default 'pending_review',
  add column content_audit_version text,
  add column content_audited_at timestamptz,
  add column official_source_url text;

alter table public.patterns
  add constraint patterns_publication_status_check
  check (publication_status in ('pending_review', 'published', 'hidden'));

alter table public.patterns
  add constraint patterns_published_audit_check
  check (
    publication_status <> 'published'
    or (content_audit_version is not null and content_audited_at is not null)
  );
