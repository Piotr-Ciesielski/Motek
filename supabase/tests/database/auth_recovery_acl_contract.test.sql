begin;

select plan(15);

select is(
  has_function_privilege('public', 'public.create_auth_recovery_grant()', 'EXECUTE'),
  false,
  'PUBLIC nie wykonuje RPC tworzenia grantu'
);
select is(
  has_function_privilege('public', 'public.claim_auth_recovery_grant(text)', 'EXECUTE'),
  false,
  'PUBLIC nie wykonuje RPC zajęcia grantu'
);
select is(
  has_function_privilege('public', 'public.release_auth_recovery_grant(text)', 'EXECUTE'),
  false,
  'PUBLIC nie wykonuje RPC zwolnienia grantu'
);
select is(
  has_function_privilege('public', 'public.consume_auth_recovery_grant(text)', 'EXECUTE'),
  false,
  'PUBLIC nie wykonuje RPC zużycia grantu'
);

select is(
  has_function_privilege('anon', 'public.create_auth_recovery_grant()', 'EXECUTE'),
  false,
  'anon nie wykonuje RPC tworzenia grantu'
);
select is(
  has_function_privilege('anon', 'public.claim_auth_recovery_grant(text)', 'EXECUTE'),
  false,
  'anon nie wykonuje RPC zajęcia grantu'
);
select is(
  has_function_privilege('anon', 'public.release_auth_recovery_grant(text)', 'EXECUTE'),
  false,
  'anon nie wykonuje RPC zwolnienia grantu'
);
select is(
  has_function_privilege('anon', 'public.consume_auth_recovery_grant(text)', 'EXECUTE'),
  false,
  'anon nie wykonuje RPC zużycia grantu'
);

select is(
  has_function_privilege('authenticated', 'public.create_auth_recovery_grant()', 'EXECUTE'),
  true,
  'authenticated wykonuje RPC tworzenia grantu'
);
select is(
  has_function_privilege('authenticated', 'public.claim_auth_recovery_grant(text)', 'EXECUTE'),
  true,
  'authenticated wykonuje RPC zajęcia grantu'
);
select is(
  has_function_privilege('authenticated', 'public.release_auth_recovery_grant(text)', 'EXECUTE'),
  true,
  'authenticated wykonuje RPC zwolnienia grantu'
);
select is(
  has_function_privilege('authenticated', 'public.consume_auth_recovery_grant(text)', 'EXECUTE'),
  true,
  'authenticated wykonuje RPC zużycia grantu'
);

set local role authenticated;
select is(
  public.claim_auth_recovery_grant('00000000-0000-0000-0000-000000000001'),
  false,
  'claim bez sesji nie zajmuje grantu'
);
select is(
  public.release_auth_recovery_grant('00000000-0000-0000-0000-000000000001'),
  false,
  'release bez sesji nie zwalnia grantu'
);
select is(
  public.consume_auth_recovery_grant('00000000-0000-0000-0000-000000000001'),
  false,
  'consume bez sesji nie zużywa grantu'
);
reset role;

select * from finish();
rollback;
