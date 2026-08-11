begin;

select plan(21);

select has_function(
  'public',
  'create_registration_invitation',
  array['text', 'text', 'timestamp with time zone'],
  'RPC create zaproszenia istnieje'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.create_registration_invitation(text,text,timestamptz)'::regprocedure),
  true,
  'RPC create działa jako security definer'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.create_registration_invitation(text,text,timestamptz)'::regprocedure),
  true,
  'RPC create ma pusty search_path'
);
select is(has_function_privilege('public', 'public.create_registration_invitation(text,text,timestamptz)', 'EXECUTE'), false, 'PUBLIC nie wykonuje RPC create');
select is(has_function_privilege('anon', 'public.create_registration_invitation(text,text,timestamptz)', 'EXECUTE'), false, 'anon nie wykonuje RPC create');
select is(has_function_privilege('authenticated', 'public.create_registration_invitation(text,text,timestamptz)', 'EXECUTE'), false, 'authenticated nie wykonuje RPC create');
select is(has_function_privilege('service_role', 'public.create_registration_invitation(text,text,timestamptz)', 'EXECUTE'), true, 'service_role wykonuje RPC create');

select has_function(
  'public',
  'revoke_registration_invitation',
  array['uuid'],
  'RPC revoke zaproszenia istnieje'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.revoke_registration_invitation(uuid)'::regprocedure),
  true,
  'RPC revoke działa jako security definer'
);
select is(
  (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid = 'public.revoke_registration_invitation(uuid)'::regprocedure),
  true,
  'RPC revoke ma pusty search_path'
);
select is(has_function_privilege('public', 'public.revoke_registration_invitation(uuid)', 'EXECUTE'), false, 'PUBLIC nie wykonuje RPC revoke');
select is(has_function_privilege('anon', 'public.revoke_registration_invitation(uuid)', 'EXECUTE'), false, 'anon nie wykonuje RPC revoke');
select is(has_function_privilege('authenticated', 'public.revoke_registration_invitation(uuid)', 'EXECUTE'), false, 'authenticated nie wykonuje RPC revoke');
select is(has_function_privilege('service_role', 'public.revoke_registration_invitation(uuid)', 'EXECUTE'), true, 'service_role wykonuje RPC revoke');

insert into private.registration_invitations (
  id, email, token_hash, expires_at
)
values
  ('00000000-0000-4000-8000-000000000701', 'revoke@example.com', repeat('a', 64), now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000702', 'reserved@example.com', repeat('b', 64), now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000703', 'used@example.com', repeat('c', 64), now() + interval '1 day');

update private.registration_invitations
set reservation_id = '00000000-0000-4000-8000-000000000799',
    reserved_at = now(),
    reservation_expires_at = now() + interval '15 minutes'
where id = '00000000-0000-4000-8000-000000000702';

update private.registration_invitations
set used_at = now()
where id = '00000000-0000-4000-8000-000000000703';

set local role service_role;
select is(
  public.create_registration_invitation('created@example.com', repeat('d', 64), now() + interval '1 day') is not null,
  true,
  'RPC create zapisuje zaproszenie przez service_role'
);
reset role;
select is((select email from private.registration_invitations where email = 'created@example.com'), 'created@example.com', 'RPC create normalizuje e-mail');
select is((select token_hash from private.registration_invitations where email = 'created@example.com'), repeat('d', 64), 'RPC create zapisuje tylko hash tokenu');
set local role service_role;
select is(public.revoke_registration_invitation('00000000-0000-4000-8000-000000000701'), true, 'RPC revoke odwołuje nieużyte zaproszenie');
reset role;
select is((select revoked_at is not null from private.registration_invitations where id = '00000000-0000-4000-8000-000000000701'), true, 'Odwołanie zapisuje czas revokacji');
set local role service_role;
select is(public.revoke_registration_invitation('00000000-0000-4000-8000-000000000701'), false, 'RPC revoke jest idempotentny');
select is(public.revoke_registration_invitation('00000000-0000-4000-8000-000000000702'), false, 'RPC revoke nie przerywa aktywnej rezerwacji');

select * from finish();
rollback;
