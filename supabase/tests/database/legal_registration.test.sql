begin;

select plan(76);

select has_schema('private', 'Prywatny schemat danych rejestracji istnieje');
select has_table('private', 'legal_document_versions', 'Wersje dokumentów prawnych istnieją');
select has_table('private', 'registration_invitations', 'Zaproszenia do rejestracji istnieją');
select has_table('private', 'registration_attempts', 'Próby rejestracji istnieją');
select has_table('private', 'terms_acceptances', 'Akceptacje regulaminu istnieją');
select has_table('private', 'privacy_notice_deliveries', 'Przekazania informacji o prywatności istnieją');

select col_is_pk('private', 'legal_document_versions', array['kind', 'version'], 'Wersja dokumentu jest kluczowana rodzajem i wersją');
select col_is_pk('private', 'terms_acceptances', array['user_id', 'terms_version'], 'Akceptacja regulaminu jest unikalna dla użytkownika i wersji');
select col_is_pk('private', 'privacy_notice_deliveries', array['user_id', 'privacy_version'], 'Przekazanie prywatności jest unikalne dla użytkownika i wersji');
select col_has_default('private', 'terms_acceptances', 'accepted_at', 'now()');
select col_has_default('private', 'privacy_notice_deliveries', 'presented_at', 'now()');
select col_has_default('private', 'registration_invitations', 'created_at', 'now()');
select col_has_default('private', 'registration_attempts', 'created_at', 'now()');
select col_has_default('private', 'registration_attempts', 'updated_at', 'now()');

select is(
  (select confdeltype from pg_constraint where conrelid = 'private.terms_acceptances'::regclass and conname = 'terms_acceptances_user_id_fkey'),
  'c',
  'Usunięcie użytkownika kaskadowo usuwa akceptacje regulaminu'
);
select is(
  (select confdeltype from pg_constraint where conrelid = 'private.privacy_notice_deliveries'::regclass and conname = 'privacy_notice_deliveries_user_id_fkey'),
  'c',
  'Usunięcie użytkownika kaskadowo usuwa przekazania prywatności'
);
select is(
  (select confdeltype from pg_constraint where conrelid = 'private.registration_invitations'::regclass and conname = 'registration_invitations_used_by_fkey'),
  'n',
  'Usunięcie użytkownika zachowuje zużyte zaproszenie bez wskazania użytkownika'
);

select is(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private' and tablename = 'legal_document_versions'
      and indexdef like '%(kind)%' and indexdef like '%WHERE is_current%'
  ),
  true,
  'Każdy rodzaj dokumentu ma najwyżej jedną aktualną wersję'
);
select is(
  exists (select 1 from pg_indexes where schemaname = 'private' and tablename = 'registration_invitations' and indexdef like '%(email)%'),
  true,
  'Zaproszenia mają indeks adresu e-mail'
);
select is(
  exists (select 1 from pg_indexes where schemaname = 'private' and tablename = 'registration_invitations' and indexdef like '%(expires_at)%'),
  true,
  'Zaproszenia mają indeks terminu wygaśnięcia'
);
select is(
  exists (select 1 from pg_indexes where schemaname = 'private' and tablename = 'registration_attempts' and indexdef like '%(auth_user_id)%'),
  true,
  'Próby rejestracji mają indeks użytkownika Auth'
);

select is(has_table_privilege('anon', 'private.legal_document_versions', 'SELECT'), false, 'anon nie czyta wersji dokumentów');
select is(has_table_privilege('authenticated', 'private.legal_document_versions', 'SELECT'), false, 'authenticated nie czyta wersji dokumentów');
select is(has_table_privilege('anon', 'private.registration_invitations', 'SELECT'), false, 'anon nie czyta zaproszeń');
select is(has_table_privilege('authenticated', 'private.registration_invitations', 'SELECT'), false, 'authenticated nie czyta zaproszeń');
select is(has_table_privilege('anon', 'private.registration_attempts', 'SELECT'), false, 'anon nie czyta prób rejestracji');
select is(has_table_privilege('authenticated', 'private.registration_attempts', 'SELECT'), false, 'authenticated nie czyta prób rejestracji');
select is(has_table_privilege('anon', 'private.terms_acceptances', 'SELECT'), false, 'anon nie czyta akceptacji regulaminu');
select is(has_table_privilege('authenticated', 'private.terms_acceptances', 'SELECT'), false, 'authenticated nie czyta akceptacji regulaminu');
select is(has_table_privilege('anon', 'private.privacy_notice_deliveries', 'SELECT'), false, 'anon nie czyta przekazań prywatności');
select is(has_table_privilege('authenticated', 'private.privacy_notice_deliveries', 'SELECT'), false, 'authenticated nie czyta przekazań prywatności');
select throws_ok(
  $$ set local role authenticated; insert into private.terms_acceptances(user_id, terms_version) values (auth.uid(), '1.0') $$,
  '42501'
);

select is(
  (select count(*) from private.legal_document_versions where kind = 'terms' and version = '1.0' and effective_at = date '2026-08-09' and requires_acceptance and is_current),
  1::bigint,
  'Aktualna wersja regulaminu 1.0 jest opublikowana'
);
select is(
  (select count(*) from private.legal_document_versions where kind = 'privacy' and version = '1.0' and effective_at = date '2026-08-09' and not requires_acceptance and is_current),
  1::bigint,
  'Aktualna wersja prywatności 1.0 jest opublikowana'
);
select is(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and pg_get_constraintdef(oid) like '%pending_registration%'
  ),
  true,
  'Profil dopuszcza stan oczekującej rejestracji'
);
select is(
  (select prosrc like '%pending_registration%' from pg_proc where oid = 'public.handle_new_user()'::regprocedure),
  true,
  'Nowy profil zawsze zaczyna w stanie oczekującej rejestracji'
);

select has_function('public', 'reserve_registration_invitation', array['text', 'text', 'text', 'uuid'], 'RPC rezerwacji zaproszenia istnieje');
select has_function('public', 'attach_registration_user', array['uuid', 'uuid'], 'RPC powiązania użytkownika istnieje');
select has_function('public', 'finalize_invited_registration', array['uuid', 'uuid', 'text', 'text'], 'RPC finalizacji rejestracji istnieje');
select has_function('public', 'release_registration_reservation', array['uuid'], 'RPC zwolnienia rezerwacji istnieje');
select has_function('public', 'record_terms_acceptance', array['uuid', 'text', 'text'], 'RPC zapisu akceptacji istnieje');
select has_function('public', 'get_account_access_state', array['uuid'], 'RPC stanu dostępu istnieje');
select has_function('public', 'purge_registration_security_logs', array[]::text[], 'RPC czyszczenia logów istnieje');

select is(has_function_privilege('anon', 'public.reserve_registration_invitation(text,text,text,uuid)', 'EXECUTE'), false, 'anon nie wykonuje rezerwacji');
select is(has_function_privilege('authenticated', 'public.reserve_registration_invitation(text,text,text,uuid)', 'EXECUTE'), false, 'authenticated nie wykonuje rezerwacji');
select is(has_function_privilege('service_role', 'public.reserve_registration_invitation(text,text,text,uuid)', 'EXECUTE'), true, 'service_role wykonuje rezerwację');
select is(has_function_privilege('anon', 'public.attach_registration_user(uuid,uuid)', 'EXECUTE'), false, 'anon nie wykonuje powiązania');
select is(has_function_privilege('service_role', 'public.attach_registration_user(uuid,uuid)', 'EXECUTE'), true, 'service_role wykonuje powiązanie');
select is(has_function_privilege('anon', 'public.finalize_invited_registration(uuid,uuid,text,text)', 'EXECUTE'), false, 'anon nie wykonuje finalizacji');
select is(has_function_privilege('service_role', 'public.finalize_invited_registration(uuid,uuid,text,text)', 'EXECUTE'), true, 'service_role wykonuje finalizację');
select is(has_function_privilege('anon', 'public.release_registration_reservation(uuid)', 'EXECUTE'), false, 'anon nie zwalnia rezerwacji');
select is(has_function_privilege('service_role', 'public.release_registration_reservation(uuid)', 'EXECUTE'), true, 'service_role zwalnia rezerwację');
select is(has_function_privilege('anon', 'public.record_terms_acceptance(uuid,text,text)', 'EXECUTE'), false, 'anon nie zapisuje akceptacji');
select is(has_function_privilege('service_role', 'public.record_terms_acceptance(uuid,text,text)', 'EXECUTE'), true, 'service_role zapisuje akceptację');
select is(has_function_privilege('anon', 'public.get_account_access_state(uuid)', 'EXECUTE'), false, 'anon nie odczytuje stanu prawnego');
select is(has_function_privilege('service_role', 'public.get_account_access_state(uuid)', 'EXECUTE'), true, 'service_role odczytuje stan prawny');
select is(has_function_privilege('anon', 'public.purge_registration_security_logs()', 'EXECUTE'), false, 'anon nie czyści logów');
select is(has_function_privilege('service_role', 'public.purge_registration_security_logs()', 'EXECUTE'), true, 'service_role czyści logi');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'invitee@example.com', 'not-a-real-password', now(), '{}'::jsonb, '{}'::jsonb,
  now(), now()
);

insert into private.registration_invitations (id, email, token_hash, expires_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'invitee@example.com', repeat('a', 64), now() + interval '1 hour'
);

insert into private.registration_invitations (id, email, token_hash, expires_at)
values (
  '00000000-0000-0000-0000-000000000002',
  'releasee@example.com', repeat('b', 64), now() + interval '1 hour'
);

set local role service_role;

select throws_ok(
  $$ select public.reserve_registration_invitation(repeat('a', 64), 'invitee@example.com', '0.9', '00000000-0000-0000-0000-000000000101'::uuid) $$,
  'P0001',
  'Wymagana jest aktualna wersja regulaminu'
);
select is(
  public.reserve_registration_invitation(repeat('a', 64), 'INVITEE@EXAMPLE.COM', '1.0', '00000000-0000-0000-0000-000000000101'::uuid)::text,
  '00000000-0000-0000-0000-000000000001',
  'Rezerwacja normalizuje e-mail i zwraca zaproszenie'
);
set local role postgres;
select is(
  (select state from private.registration_attempts where reservation_id = '00000000-0000-0000-0000-000000000101'),
  'reserved',
  'Rezerwacja tworzy próbę w stanie reserved'
);
set local role service_role;
select is(
  public.reserve_registration_invitation(repeat('a', 64), 'invitee@example.com', '1.0', '00000000-0000-0000-0000-000000000101'::uuid)::text,
  '00000000-0000-0000-0000-000000000001',
  'Powtórzenie tej samej rezerwacji jest idempotentne'
);
select is(
  public.attach_registration_user('00000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000001'::uuid),
  true,
  'Rezerwacja wiąże użytkownika po zgodnym e-mailu'
);
select is(
  (public.finalize_invited_registration('00000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '1.0', '1.0') is not null),
  true,
  'Finalizacja zwraca czas akceptacji'
);
set local role postgres;
select is(
  (select status from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'active',
  'Finalizacja aktywuje profil'
);
select is(
  (select used_by from private.registration_invitations where id = '00000000-0000-0000-0000-000000000001')::text,
  '00000000-0000-0000-0000-000000000001',
  'Finalizacja zużywa zaproszenie dla właściwego użytkownika'
);
select is(
  (select count(*) from private.terms_acceptances where user_id = '00000000-0000-0000-0000-000000000001' and terms_version = '1.0'),
  1::bigint,
  'Finalizacja zapisuje jedną akceptację regulaminu'
);
set local role service_role;
select is(
  public.get_account_access_state('00000000-0000-0000-0000-000000000001')->>'acceptedVersion',
  '1.0',
  'Stan dostępu zwraca zaakceptowaną wersję'
);
select is(
  (public.get_account_access_state('00000000-0000-0000-0000-000000000001')->>'acceptanceRequired')::boolean,
  false,
  'Stan dostępu nie wymaga ponownej akceptacji'
);
select is(
  (public.record_terms_acceptance('00000000-0000-0000-0000-000000000001'::uuid, '1.0', '1.0') is not null),
  true,
  'Ponowny zapis akceptacji zachowuje pierwszy czas'
);

set local role postgres;
select is(
  (select count(*) from private.terms_acceptances where user_id = '00000000-0000-0000-0000-000000000001' and terms_version = '1.0'),
  1::bigint,
  'Ponowny zapis nie tworzy drugiej akceptacji'
);
set local role service_role;

select is(
  public.reserve_registration_invitation(repeat('b', 64), 'releasee@example.com', '1.0', '00000000-0000-0000-0000-000000000102'::uuid)::text,
  '00000000-0000-0000-0000-000000000002',
  'Drugie zaproszenie może zostać zarezerwowane'
);
select is(
  public.release_registration_reservation('00000000-0000-0000-0000-000000000102'::uuid),
  true,
  'Rezerwacja bez użytkownika może zostać zwolniona'
);
select is(
  public.release_registration_reservation('00000000-0000-0000-0000-000000000102'::uuid),
  false,
  'Powtórne zwolnienie zwraca false'
);

set local role postgres;
insert into private.registration_invitations (
  id, email, token_hash, expires_at, used_at
)
values (
  '00000000-0000-0000-0000-000000000003', 'old@example.com', repeat('c', 64),
  now() - interval '91 days', now() - interval '91 days'
);
insert into private.registration_attempts (
  reservation_id, invitation_id, email, state, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000003',
  'old@example.com', 'cancelled', now() - interval '91 days', now() - interval '91 days'
);
create temp table purge_result (payload jsonb);
insert into purge_result (payload)
values (public.purge_registration_security_logs());
select is(
  ((select payload from purge_result)->>'attemptsDeleted')::integer,
  1,
  'Purge usuwa stare próby rejestracji'
);
select is(
  ((select payload from purge_result)->>'invitationsDeleted')::integer,
  1,
  'Purge usuwa stare zaproszenia'
);
drop table purge_result;

select * from finish();
rollback;
