begin;

select plan(36);

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

select * from finish();
rollback;
