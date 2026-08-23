-- PRODUCTION-ONLY: execute only after the production preflight and explicit approval.
-- This package is intentionally outside supabase/migrations because the remote
-- migration ledgers are divergent and staging currently contains NULL descriptions.

begin;

do $$
begin
  if to_regclass('public.patterns') is null then
    raise exception 'precondition failed: public.patterns does not exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'patterns'
      and column_name = 'description'
  ) then
    raise exception 'precondition failed: public.patterns.description does not exist';
  end if;

  if exists (select 1 from public.patterns where description is null) then
    raise exception 'precondition failed: public.patterns.description contains NULL values';
  end if;
end;
$$;

alter table public.patterns
  add column if not exists publication_status text,
  add column if not exists content_audit_version text,
  add column if not exists content_audited_at timestamptz,
  add column if not exists official_source_url text;

alter table public.patterns
  alter column publication_status set default 'pending_review';

update public.patterns
set publication_status = 'pending_review'
where publication_status is null;

alter table public.patterns
  alter column publication_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.patterns'::regclass
      and conname = 'patterns_publication_status_check'
  ) then
    alter table public.patterns
      add constraint patterns_publication_status_check
      check (publication_status in ('pending_review', 'published', 'hidden'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.patterns'::regclass
      and conname = 'patterns_published_audit_check'
  ) then
    alter table public.patterns
      add constraint patterns_published_audit_check
      check (
        publication_status <> 'published'
        or (content_audit_version is not null and content_audited_at is not null)
      );
  end if;
end;
$$;

alter table public.patterns
  alter column description set not null;

commit;
