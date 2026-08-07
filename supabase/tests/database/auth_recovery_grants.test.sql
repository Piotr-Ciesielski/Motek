begin;

select plan(32);

select has_schema('private', 'prywatny schemat grantów recovery istnieje');
select has_table('private', 'auth_recovery_grants', 'granty recovery są przechowywane poza publicznym schematem');
select has_function(
  'public',
  'create_auth_recovery_grant',
  array['uuid', 'text', 'timestamp with time zone'],
  'RPC tworzenia grantu ma stabilny kontrakt'
);
select has_function(
  'public',
  'consume_auth_recovery_grant',
  array['uuid', 'text'],
  'RPC zużycia grantu ma stabilny kontrakt'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.create_auth_recovery_grant(uuid,text,timestamptz)'::regprocedure),
  true,
  'RPC tworzenia działa jako security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.consume_auth_recovery_grant(uuid,text)'::regprocedure),
  true,
  'RPC zużycia działa jako security definer'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.create_auth_recovery_grant(uuid,text,timestamptz)'::regprocedure),
  true,
  'RPC tworzenia ma pusty search_path'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.consume_auth_recovery_grant(uuid,text)'::regprocedure),
  true,
  'RPC zużycia ma pusty search_path'
);
select is(
  (select position('used_at is null' in prosrc) > 0 from pg_proc where oid = 'public.consume_auth_recovery_grant(uuid,text)'::regprocedure),
  true,
  'guard atomowości wymaga nieużytego grantu'
);
select is(
  (select position('expires_at > now()' in prosrc) > 0 from pg_proc where oid = 'public.consume_auth_recovery_grant(uuid,text)'::regprocedure),
  true,
  'guard atomowości wymaga niewygasłego grantu'
);
select is(
  (select position('return found' in prosrc) > 0 from pg_proc where oid = 'public.consume_auth_recovery_grant(uuid,text)'::regprocedure),
  true,
  'consume zwraca wynik atomowego UPDATE przez FOUND'
);
select is(
  (select position('claimed_at is null' in prosrc) > 0 from pg_proc where oid = 'public.claim_auth_recovery_grant(uuid,text)'::regprocedure),
  true,
  'claim rezerwuje wyłącznie nieprzetwarzany grant'
);
select is(
  (select position('set claimed_at = null' in prosrc) > 0 from pg_proc where oid = 'public.release_auth_recovery_grant(uuid,text)'::regprocedure),
  true,
  'release zwalnia rezerwację grantu'
);
select is(has_function_privilege('authenticated', 'public.claim_auth_recovery_grant(uuid, text)', 'EXECUTE'), false, 'authenticated nie może rezerwować grantów');
select is(has_function_privilege('service_role', 'public.claim_auth_recovery_grant(uuid, text)', 'EXECUTE'), true, 'service_role może rezerwować granty');

select is(has_function_privilege('public', 'public.create_auth_recovery_grant(uuid,text,timestamptz)', 'EXECUTE'), false, 'PUBLIC nie może tworzyć grantów');
select is(has_function_privilege('anon', 'public.create_auth_recovery_grant(uuid,text,timestamptz)', 'EXECUTE'), false, 'anon nie może tworzyć grantów');
select is(has_function_privilege('authenticated', 'public.create_auth_recovery_grant(uuid,text,timestamptz)', 'EXECUTE'), false, 'authenticated nie może tworzyć grantów');
select is(has_function_privilege('service_role', 'public.create_auth_recovery_grant(uuid,text,timestamptz)', 'EXECUTE'), true, 'tylko service_role może tworzyć granty');
select is(has_function_privilege('public', 'public.consume_auth_recovery_grant(uuid,text)', 'EXECUTE'), false, 'PUBLIC nie może zużywać grantów');
select is(has_function_privilege('anon', 'public.consume_auth_recovery_grant(uuid,text)', 'EXECUTE'), false, 'anon nie może zużywać grantów');
select is(has_function_privilege('authenticated', 'public.consume_auth_recovery_grant(uuid,text)', 'EXECUTE'), false, 'authenticated nie może zużywać grantów');
select is(has_function_privilege('service_role', 'public.consume_auth_recovery_grant(uuid,text)', 'EXECUTE'), true, 'tylko service_role może zużywać granty');
select is(has_table_privilege('anon', 'private.auth_recovery_grants', 'SELECT'), false, 'anon nie ma bezpośredniego dostępu do tabeli grantów');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'recovery-a@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"login":"recovery_a"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'recovery-b@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"login":"recovery_b"}');

set local role service_role;
select is(
  public.create_auth_recovery_grant(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    repeat('A', 43),
    now() + interval '5 minutes'
  ),
  true,
  'service_role tworzy ważny grant'
);
select is(
  public.consume_auth_recovery_grant('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', repeat('A', 43)),
  false,
  'grant nie może zostać zużyty przez innego użytkownika'
);
select is(
  public.claim_auth_recovery_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('A', 43)),
  true,
  'właściciel rezerwuje ważny grant przed zużyciem'
);
select is(
  public.consume_auth_recovery_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('A', 43)),
  true,
  'właściciel może zużyć ważny grant'
);
select is(
  public.consume_auth_recovery_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('A', 43)),
  false,
  'zużyty grant nie może zostać użyty ponownie'
);

reset role;
insert into private.auth_recovery_grants (jti_hash, user_id, expires_at, created_at)
values ('E' || repeat('B', 42), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now() - interval '1 minute', now() - interval '3 minutes');

set local role service_role;
select is(
  public.consume_auth_recovery_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'E' || repeat('B', 42)),
  false,
  'wygasły grant jest odrzucany'
);
reset role;

select is(
  (select used_at is not null from private.auth_recovery_grants where jti_hash = repeat('A', 43)),
  true,
  'atomowe zużycie zapisuje used_at'
);
select is(
  (select used_at is null from private.auth_recovery_grants where jti_hash = 'E' || repeat('B', 42)),
  true,
  'odrzucony wygasły grant pozostaje niezużyty'
);

select * from finish();
rollback;
