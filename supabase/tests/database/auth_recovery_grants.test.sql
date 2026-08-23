begin;

select plan(48);

select has_table(
  'private',
  'auth_recovery_grants',
  'Granty recovery są przechowywane w prywatnym schemacie'
);
select has_column('private', 'auth_recovery_grants', 'jti_hash', 'Grant przechowuje wyłącznie hash JTI');
select has_column('private', 'auth_recovery_grants', 'used_at', 'Grant ma znacznik zużycia');
select has_column('private', 'auth_recovery_grants', 'claimed_at', 'Grant ma znacznik zajęcia');
select has_function('public', 'create_auth_recovery_grant', '{}', 'RPC tworzenia grantu istnieje');
select has_function(
  'public',
  'consume_auth_recovery_grant',
  array['text'],
  'RPC zużycia grantu istnieje'
);
select has_function(
  'public',
  'claim_auth_recovery_grant',
  array['text'],
  'RPC zajęcia grantu istnieje'
);
select has_function(
  'public',
  'release_auth_recovery_grant',
  array['text'],
  'RPC zwolnienia grantu istnieje'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.create_auth_recovery_grant()'::regprocedure),
  true,
  'RPC tworzenia działa jako security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.consume_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zużycia działa jako security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.claim_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zajęcia działa jako security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.release_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zwolnienia działa jako security definer'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.create_auth_recovery_grant()'::regprocedure),
  true,
  'RPC tworzenia ma pusty search_path'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.consume_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zużycia ma pusty search_path'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.claim_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zajęcia ma pusty search_path'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.release_auth_recovery_grant(text)'::regprocedure),
  true,
  'RPC zwolnienia ma pusty search_path'
);

select is(has_table_privilege('anon', 'private.auth_recovery_grants', 'SELECT'), false, 'anon nie czyta grantów');
select is(has_table_privilege('authenticated', 'private.auth_recovery_grants', 'SELECT'), false, 'authenticated nie czyta grantów');
select is(has_function_privilege('anon', 'public.create_auth_recovery_grant()', 'EXECUTE'), false, 'anon nie tworzy grantów');
select is(has_function_privilege('anon', 'public.claim_auth_recovery_grant(text)', 'EXECUTE'), false, 'anon nie zajmuje grantów');
select is(has_function_privilege('anon', 'public.release_auth_recovery_grant(text)', 'EXECUTE'), false, 'anon nie zwalnia grantów');
select is(has_function_privilege('anon', 'public.consume_auth_recovery_grant(text)', 'EXECUTE'), false, 'anon nie zużywa grantów');
select is(has_function_privilege('authenticated', 'public.create_auth_recovery_grant()', 'EXECUTE'), true, 'authenticated tworzy granty');
select is(has_function_privilege('authenticated', 'public.consume_auth_recovery_grant(text)', 'EXECUTE'), true, 'authenticated zużywa granty');
select is(has_function_privilege('authenticated', 'public.claim_auth_recovery_grant(text)', 'EXECUTE'), true, 'authenticated zajmuje granty');
select is(has_function_privilege('authenticated', 'public.release_auth_recovery_grant(text)', 'EXECUTE'), true, 'authenticated zwalnia granty');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000601', 'authenticated', 'authenticated',
    'recovery-owner@example.com', 'not-a-real-password', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000602', 'authenticated', 'authenticated',
    'recovery-other@example.com', 'not-a-real-password', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into private.auth_recovery_grants (user_id, jti_hash, expires_at, created_at, claimed_at, used_at)
values
  (
    '00000000-0000-0000-0000-000000000601',
    encode(extensions.digest('grant-owner-a', 'sha256'), 'hex'),
    now() + interval '10 minutes', now(), null, null
  ),
  (
    '00000000-0000-0000-0000-000000000601',
    encode(extensions.digest('grant-consume-a', 'sha256'), 'hex'),
    now() + interval '10 minutes', now(), null, null
  ),
  (
    '00000000-0000-0000-0000-000000000601',
    encode(extensions.digest('grant-release-a', 'sha256'), 'hex'),
    now() + interval '10 minutes', now(), now(), null
  ),
  (
    '00000000-0000-0000-0000-000000000601',
    encode(extensions.digest('grant-release-used', 'sha256'), 'hex'),
    now() + interval '10 minutes', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000601',
    encode(extensions.digest('grant-release-expired', 'sha256'), 'hex'),
    now() - interval '1 minute', now() - interval '2 minutes', now(), null
  ),
  (
    '00000000-0000-0000-0000-000000000601',
    encode(extensions.digest('grant-expired', 'sha256'), 'hex'),
    now() - interval '1 minute', now() - interval '2 minutes', null, null
  );

select is(
  (
    select count(*)
    from private.auth_recovery_grants
    where jti_hash in (
      'grant-owner-a',
      'grant-consume-a',
      'grant-release-a',
      'grant-release-used',
      'grant-release-expired',
      'grant-expired'
    )
  ),
  0::bigint,
  'Tabela nie przechowuje surowego JTI'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select is(public.consume_auth_recovery_grant('grant-owner-a'), false, 'Consume bez wcześniejszego claimu zwraca false');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select is(public.claim_auth_recovery_grant('grant-consume-a'), false, 'Inny użytkownik nie może zająć świeżego grantu consume');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select is(public.claim_auth_recovery_grant('grant-consume-a'), true, 'Właściciel może zająć świeży grant consume');
select is(public.claim_auth_recovery_grant('grant-owner-a'), true, 'Właściciel zajmuje ważny grant');
set local role postgres;
select is(
  (select claimed_at is not null from private.auth_recovery_grants where jti_hash = encode(extensions.digest('grant-owner-a', 'sha256'), 'hex')),
  true,
  'Claim zapisuje claimed_at'
);
set local role authenticated;
select is(public.claim_auth_recovery_grant('grant-owner-a'), false, 'Zajęty grant nie może zostać zajęty ponownie');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select is(public.claim_auth_recovery_grant('grant-owner-a'), false, 'Inny użytkownik nie może zająć grantu');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select is(public.claim_auth_recovery_grant('grant-expired'), false, 'Wygasły grant nie może zostać zajęty');
select is(public.consume_auth_recovery_grant('grant-expired'), false, 'Właściciel nie może consume wygasłego grantu');

select is(public.release_auth_recovery_grant('grant-owner-a'), true, 'Właściciel zwalnia zajęty grant');
select is(public.release_auth_recovery_grant('grant-owner-a'), false, 'Ponowne release zwolnionego grantu zwraca false');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select is(public.consume_auth_recovery_grant('grant-consume-a'), false, 'Inny użytkownik nie może consume grantu');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select is(public.consume_auth_recovery_grant('grant-consume-a'), true, 'Właściciel atomowo zużywa zajęty grant');
set local role postgres;
select is(
  (select used_at is not null from private.auth_recovery_grants where jti_hash = encode(extensions.digest('grant-consume-a', 'sha256'), 'hex')),
  true,
  'Consume zapisuje used_at'
);
set local role authenticated;
select is(public.consume_auth_recovery_grant('grant-consume-a'), false, 'Zużyty grant nie może zostać zużyty ponownie');
select is(public.claim_auth_recovery_grant('grant-consume-a'), false, 'Zużyty grant nie może zostać zajęty ponownie');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select is(public.release_auth_recovery_grant('grant-release-a'), false, 'Inny użytkownik nie może zwolnić grantu');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select is(public.release_auth_recovery_grant('grant-release-a'), true, 'Właściciel zwalnia zajęty, niezużyty grant');
set local role postgres;
select is(
  (select claimed_at is null from private.auth_recovery_grants where jti_hash = encode(extensions.digest('grant-release-a', 'sha256'), 'hex')),
  true,
  'Release usuwa claimed_at'
);
set local role authenticated;
select is(public.release_auth_recovery_grant('grant-release-used'), false, 'Nie można zwolnić zużytego grantu');
select is(public.release_auth_recovery_grant('grant-release-expired'), false, 'Nie można zwolnić wygasłego grantu');

set local role postgres;
delete from private.auth_recovery_grants
where jti_hash in (
  encode(extensions.digest('grant-owner-a', 'sha256'), 'hex'),
  encode(extensions.digest('grant-consume-a', 'sha256'), 'hex'),
  encode(extensions.digest('grant-release-a', 'sha256'), 'hex'),
  encode(extensions.digest('grant-release-used', 'sha256'), 'hex'),
  encode(extensions.digest('grant-release-expired', 'sha256'), 'hex'),
  encode(extensions.digest('grant-expired', 'sha256'), 'hex')
);
delete from auth.users
where id in (
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000602'
);

select * from finish();
rollback;
