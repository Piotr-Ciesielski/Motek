begin;

select plan(11);

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

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'replay-public@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"login":"replay_public"}'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'replay-lower@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"login":"replay_lower"}'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'replay-higher@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"login":"replay_higher"}');

insert into private.yarn_store_versions (user_id, version)
values
  ('44444444-4444-4444-4444-444444444444', 10),
  ('55555555-5555-5555-5555-555555555555', 6);

create table public.yarn_store_versions (
  user_id uuid primary key,
  version bigint not null default 0
);

insert into public.yarn_store_versions (user_id, version)
values
  ('33333333-3333-3333-3333-333333333333', 7),
  ('44444444-4444-4444-4444-444444444444', 4),
  ('55555555-5555-5555-5555-555555555555', 9);

-- \ir uruchamia badaną migrację w psql używanym przez supabase test db.
\ir ../../migrations/20260806120000_restrict_yarn_mutations.sql

select is(
  (select version from private.yarn_store_versions where user_id = '33333333-3333-3333-3333-333333333333'),
  7::bigint,
  'wartość istniejąca wyłącznie w publicznym liczniku trafia do prywatnego'
);
select is(
  (select version from private.yarn_store_versions where user_id = '44444444-4444-4444-4444-444444444444'),
  10::bigint,
  'niższa wartość publiczna nie obniża prywatnego licznika'
);
select is(
  (select version from private.yarn_store_versions where user_id = '55555555-5555-5555-5555-555555555555'),
  9::bigint,
  'wyższa wartość publiczna podnosi prywatny licznik'
);
select hasnt_table(
  'public',
  'yarn_store_versions',
  'publiczny licznik jest usuwany po atomowym scaleniu'
);

-- Drugi replay jest no-opem: nie ma już tabeli publicznej ani zmian wersji.
\ir ../../migrations/20260806120000_restrict_yarn_mutations.sql

select is(
  (select version from private.yarn_store_versions where user_id = '33333333-3333-3333-3333-333333333333'),
  7::bigint,
  'replay zachowuje wartość przeniesioną wyłącznie z publicznego licznika'
);
select is(
  (select version from private.yarn_store_versions where user_id = '44444444-4444-4444-4444-444444444444'),
  10::bigint,
  'replay zachowuje wyższą wartość prywatną'
);
select is(
  (select version from private.yarn_store_versions where user_id = '55555555-5555-5555-5555-555555555555'),
  9::bigint,
  'replay zachowuje scaloną wyższą wartość publiczną'
);
select hasnt_table(
  'public',
  'yarn_store_versions',
  'replay pozostaje no-opem po usunięciu publicznego licznika'
);

select * from finish();
rollback;
