begin;

select plan(30);

select has_table(
  'private',
  'auth_recovery_grants',
  'Replay migracji pozostawia tabelę grantów recovery'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'private.auth_recovery_grants'::regclass
      and attribute.attname = 'grant_id'
      and attribute.attnum > 0
      and not attribute.attisdropped
  ),
  'Replay migracji usuwa legacyjne grant_id'
);
select is(
  (
    select array_agg(attribute.attname::text order by key_column.ordinality)
    from pg_catalog.pg_constraint as constraint_row
    cross join lateral unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality)
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = constraint_row.conrelid
     and attribute.attnum = key_column.attnum
    where constraint_row.conrelid = 'private.auth_recovery_grants'::regclass
      and constraint_row.contype = 'p'
  ),
  array['jti_hash']::text[],
  'Klucz główny składa się wyłącznie z jti_hash'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'private.auth_recovery_grants'::regclass
      and constraint_row.conname = 'auth_recovery_grants_jti_hash_length_check'
      and constraint_row.contype = 'c'
      and constraint_row.convalidated
      and regexp_replace(
        pg_catalog.pg_get_constraintdef(constraint_row.oid, true),
        '[[:space:]]+',
        '',
        'g'
      ) ~* $regex$^CHECK\(\(?char_length\(jti_hash\)=64\)?\)$regex$
  ),
  'jti_hash ma zwalidowany CHECK długości 64'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'private.auth_recovery_grants'::regclass
      and constraint_row.conname = 'auth_recovery_grants_expires_after_created_check'
      and constraint_row.contype = 'c'
      and constraint_row.convalidated
      and regexp_replace(
        pg_catalog.pg_get_constraintdef(constraint_row.oid, true),
        '[[:space:]]+',
        '',
        'g'
      ) ~* $regex$^CHECK\(\(?expires_at>created_at\)?\)$regex$
  ),
  'expires_at ma zwalidowany CHECK po created_at'
);

select has_column('private', 'auth_recovery_grants', 'user_id', 'RPC zachowują user_id');
select has_column('private', 'auth_recovery_grants', 'jti_hash', 'RPC zachowują jti_hash');
select has_column('private', 'auth_recovery_grants', 'expires_at', 'RPC zachowują expires_at');
select has_column('private', 'auth_recovery_grants', 'used_at', 'RPC zachowują used_at');
select has_column('private', 'auth_recovery_grants', 'created_at', 'RPC zachowują created_at');
select has_column('private', 'auth_recovery_grants', 'claimed_at', 'RPC zachowują claimed_at');

select is(has_table_privilege('public', 'private.auth_recovery_grants', 'SELECT'), false, 'PUBLIC nie czyta grantów');
select is(has_table_privilege('anon', 'private.auth_recovery_grants', 'SELECT'), false, 'anon nie czyta grantów');
select is(has_table_privilege('authenticated', 'private.auth_recovery_grants', 'SELECT'), false, 'authenticated nie czyta grantów');

select has_function('public', 'create_auth_recovery_grant', '{}', 'RPC tworzenia grantu istnieje');
select has_function('public', 'claim_auth_recovery_grant', array['text'], 'RPC zajęcia grantu istnieje');
select has_function('public', 'release_auth_recovery_grant', array['text'], 'RPC zwolnienia grantu istnieje');
select has_function('public', 'consume_auth_recovery_grant', array['text'], 'RPC zużycia grantu istnieje');

select is(has_function_privilege('public', 'public.create_auth_recovery_grant()', 'EXECUTE'), false, 'PUBLIC nie tworzy grantów');
select is(has_function_privilege('public', 'public.claim_auth_recovery_grant(text)', 'EXECUTE'), false, 'PUBLIC nie zajmuje grantów');
select is(has_function_privilege('public', 'public.release_auth_recovery_grant(text)', 'EXECUTE'), false, 'PUBLIC nie zwalnia grantów');
select is(has_function_privilege('public', 'public.consume_auth_recovery_grant(text)', 'EXECUTE'), false, 'PUBLIC nie zużywa grantów');

select is(has_function_privilege('anon', 'public.create_auth_recovery_grant()', 'EXECUTE'), false, 'anon nie tworzy grantów');
select is(has_function_privilege('anon', 'public.claim_auth_recovery_grant(text)', 'EXECUTE'), false, 'anon nie zajmuje grantów');
select is(has_function_privilege('anon', 'public.release_auth_recovery_grant(text)', 'EXECUTE'), false, 'anon nie zwalnia grantów');
select is(has_function_privilege('anon', 'public.consume_auth_recovery_grant(text)', 'EXECUTE'), false, 'anon nie zużywa grantów');

select is(has_function_privilege('authenticated', 'public.create_auth_recovery_grant()', 'EXECUTE'), true, 'authenticated tworzy granty');
select is(has_function_privilege('authenticated', 'public.claim_auth_recovery_grant(text)', 'EXECUTE'), true, 'authenticated zajmuje granty');
select is(has_function_privilege('authenticated', 'public.release_auth_recovery_grant(text)', 'EXECUTE'), true, 'authenticated zwalnia granty');
select is(has_function_privilege('authenticated', 'public.consume_auth_recovery_grant(text)', 'EXECUTE'), true, 'authenticated zużywa granty');

select * from finish();
rollback;
