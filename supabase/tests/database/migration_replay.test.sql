begin;

select plan(6);

select has_table(
  'private',
  'yarn_store_versions',
  'pełna historia migracji odtwarza prywatny licznik wersji magazynu'
);

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

-- Ponownie uruchamiamy badaną migrację na kontrolowanym pustym duplikacie.
-- \ir jest poleceniem psql używanym przez supabase test db.
create table public.yarn_store_versions (
  user_id uuid primary key,
  version bigint not null default 0
);
\ir ../../migrations/20260806120000_restrict_yarn_mutations.sql
select hasnt_table(
  'public',
  'yarn_store_versions',
  'pusty publiczny duplikat licznika jest bezpiecznie usuwany'
);

-- Dane w historycznym duplikacie nie mogą zostać skasowane po cichu.
create table public.yarn_store_versions (
  user_id uuid primary key,
  version bigint not null default 0
);
insert into public.yarn_store_versions (user_id, version)
values ('33333333-3333-3333-3333-333333333333', 7);

savepoint populated_legacy_duplicate;
\set ON_ERROR_STOP off
\ir ../../migrations/20260806120000_restrict_yarn_mutations.sql
\set replay_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback to savepoint populated_legacy_duplicate;

select is(
  :'replay_sqlstate',
  'P0001',
  'migracja zwraca P0001 przy niepustym publicznym duplikacie'
);
select is(
  (select version from public.yarn_store_versions where user_id = '33333333-3333-3333-3333-333333333333'),
  7::bigint,
  'przerwana migracja zachowuje dane z publicznego duplikatu'
);

select * from finish();
rollback;
