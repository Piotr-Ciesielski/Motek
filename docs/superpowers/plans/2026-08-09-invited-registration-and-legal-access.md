# Invited Registration and Legal Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wymusić rejestrację jednorazowym zaproszeniem, zapisywać niezmienną akceptację aktualnego regulaminu i blokować prywatne dane dla kont bez aktualnej akceptacji.

**Architecture:** Prywatne tabele Supabase przechowują zaproszenia, próby rejestracji, wersje dokumentów i akceptacje. Zaufane RPC w eksponowanym schemacie `public` mają dostęp wyłącznie dla `service_role`, atomowo rezerwują zaproszenie i finalizują konto bez wystawiania tabel `private` przez Data API. Serwer Node koordynuje wieloetapową rejestrację bez wydania normalnego dostępu przed ukończeniem procesu. Backend, RLS i każde `SECURITY DEFINER` RPC niezależnie egzekwują aktualną wersję regulaminu.

**Tech Stack:** Node.js 24, vanilla JavaScript, `node:test`, Supabase Auth, PostgreSQL migrations, pgTAP, `@supabase/supabase-js`.

## Global Constraints

- Ten plan konsumuje `CURRENT_LEGAL_DOCUMENT` z `legal-document.js` utworzonego w planie gotowości prawnej.
- Zaproszenie jest przypisane do znormalizowanego adresu e-mail, jednorazowe, odwoływalne i wygasające.
- W bazie przechowywany jest SHA-256 tokenu, nigdy jawny sekret zaproszenia.
- Równoległe próby użycia jednego zaproszenia mają dokładnie jednego zwycięzcę.
- Konto nie otrzymuje normalnego dostępu przed finalizacją profilu, zaproszenia i akceptacji.
- Akceptacja regulaminu i przekazanie informacji prywatności są oddzielnymi zdarzeniami.
- Wylogowanie i usunięcie konta pozostają dostępne bez aktualnej akceptacji.
- RLS i wszystkie uprzywilejowane RPC danych użytkownika muszą sprawdzać aktualną akceptację.
- Nie nadpisujemy istniejącej, nieśledzonej migracji magazynu ani zmian użytkownika.
- Migracja zdalna, tworzenie rzeczywistych zaproszeń i wysyłka linków wymagają osobnej zgody użytkownika.

---

### Task 1: Schemat wersji, zaproszeń i akceptacji

**Files:**
- Create: migracja wygenerowana przez `npx supabase migration new add_invited_registration_and_legal_acceptance`
- Create: `supabase/tests/database/legal_registration.test.sql`
- Modify: `supabase/tests/database/migration_replay.test.sql`
- Modify: `test/migration.test.js`

**Interfaces:**
- Produces: `private.legal_document_versions`, `registration_invitations`, `registration_attempts`, `terms_acceptances`, `privacy_notice_deliveries`.
- Produces: profil ze stanem `pending_registration` przed finalizacją.

- [ ] **Step 1: Napisać failing pgTAP kontraktu tabel**

Test ma potwierdzić istnienie tabel, brak dostępu `anon/authenticated`, kaskadowe usunięcie po `auth.users`, unikalność `(user_id, terms_version)` i czas nadawany przez bazę.

```sql
select has_table('private', 'terms_acceptances');
select col_is_pk('private', 'terms_acceptances', array['user_id', 'terms_version']);
select throws_ok(
  $$ set local role authenticated; insert into private.terms_acceptances(user_id, terms_version) values (auth.uid(), '1.0') $$,
  '42501'
);
```

- [ ] **Step 2: Potwierdzić RED**

Run: `npm run test:db`

Expected: FAIL, ponieważ obiekty jeszcze nie istnieją.

- [ ] **Step 3: Wygenerować migrację przez CLI**

Run: `npx supabase migration new add_invited_registration_and_legal_acceptance`

Nie wpisywać ręcznie timestampu i nie modyfikować wcześniejszych migracji.

- [ ] **Step 4: Utworzyć tabele prywatne**

Migracja ma zawierać dokładnie poniższe pola i ograniczenia; dodatkowe indeksy wydajnościowe mogą zostać dodane bez zmiany kontraktu:

```sql
create table private.legal_document_versions (
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null,
  effective_at date not null,
  requires_acceptance boolean not null,
  is_current boolean not null default false,
  primary key (kind, version)
);

create unique index legal_document_one_current_per_kind
  on private.legal_document_versions(kind)
  where is_current;

create table private.terms_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version)
);

create table private.registration_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    email = lower(btrim(email)) and
    email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  reserved_at timestamptz,
  reservation_id uuid unique,
  reservation_expires_at timestamptz,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (reservation_id is null and reserved_at is null and reservation_expires_at is null) or
    (reservation_id is not null and reserved_at is not null and reservation_expires_at is not null)
  ),
  check (used_by is null or used_at is not null),
  check (used_at is null or reservation_id is null)
);

create table private.registration_attempts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique,
  invitation_id uuid not null references private.registration_invitations(id) on delete restrict,
  email text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  state text not null check (state in ('reserved', 'auth_created', 'finalized', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.privacy_notice_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  privacy_version text not null,
  presented_at timestamptz not null default now(),
  primary key (user_id, privacy_version)
);

insert into private.legal_document_versions
  (kind, version, effective_at, requires_acceptance, is_current)
values
  ('terms', '1.0', date '2026-08-09', true, true),
  ('privacy', '1.0', date '2026-08-09', false, true);
```

Test migracji ma również wymagać indeksów na `registration_invitations(email)`, `registration_invitations(expires_at)` oraz `registration_attempts(auth_user_id)`.

- [ ] **Step 5: Zmienić stan nowego profilu**

Rozszerzyć constraint statusu o `pending_registration`. Trigger `handle_new_user()` tworzy zawsze `pending_registration`; tylko zaufana finalizacja może ustawić `active`.

- [ ] **Step 6: Odebrać uprawnienia klientom i uruchomić testy**

```sql
revoke all on all tables in schema private from public, anon, authenticated;
```

Run: `npm run test:db`; `node --test test/migration.test.js`

Expected: PASS.

- [ ] **Step 7: Utworzyć checkpoint zadania**

```powershell
git add -- ':(glob)supabase/migrations/*_add_invited_registration_and_legal_acceptance.sql' supabase/tests/database/legal_registration.test.sql supabase/tests/database/migration_replay.test.sql test/migration.test.js
git commit -m "db: add invitations and legal acceptance history"
```

### Task 2: Atomowa rezerwacja i finalizacja zaproszenia

**Files:**
- Modify: migracja z Task 1 przed jej zastosowaniem
- Modify: `supabase/tests/database/legal_registration.test.sql`

**Interfaces:**
- Produces RPC service-only w `public`: `reserve_registration_invitation`, `attach_registration_user`, `finalize_invited_registration`, `release_registration_reservation`, `record_terms_acceptance`, `get_account_access_state`, `purge_registration_security_logs`.

- [ ] **Step 1: Napisać pgTAP stanów zaproszenia**

Dodać przypadki: błędny hash, inny e-mail, wygaśnięcie, odwołanie, zużycie, ponowienie tej samej próby oraz dwie próby z różnymi `reservation_id`. Druga równoległa rezerwacja ma zwrócić kontrolowany błąd.

- [ ] **Step 2: Dodać zaufane RPC**

Każda funkcja ma znajdować się w schemacie `public`, aby obecny `serviceClient.rpc(...)` mógł ją wywołać przez Data API, lecz ma używać:

```sql
security definer
set search_path = ''
```

Funkcje mają następujące dokładne kontrakty:

```sql
public.reserve_registration_invitation(
  p_token_hash text,
  p_email text,
  p_terms_version text,
  p_reservation_id uuid
) returns uuid

public.attach_registration_user(
  p_reservation_id uuid,
  p_user_id uuid
) returns boolean

public.finalize_invited_registration(
  p_reservation_id uuid,
  p_user_id uuid,
  p_terms_version text,
  p_privacy_version text
) returns timestamptz

public.release_registration_reservation(
  p_reservation_id uuid
) returns boolean

public.record_terms_acceptance(
  p_user_id uuid,
  p_terms_version text,
  p_privacy_version text
) returns timestamptz

public.get_account_access_state(
  p_user_id uuid
) returns jsonb

public.purge_registration_security_logs()
returns jsonb
```

Przejścia stanów są zamknięte i deterministyczne:

1. `reserve_registration_invitation` sprawdza aktualną wersję regulaminu i wykonuje jeden `update ... where used_at is null and revoked_at is null and expires_at > now() and (reserved_at is null or reservation_expires_at <= now()) returning id`. Następnie tworzy próbę w stanie `reserved`. Powtórzenie z tym samym `p_reservation_id`, hashem i e-mailem zwraca ten sam `invitation_id`; inny identyfikator przegrywa.
2. `attach_registration_user` blokuje próbę, wymaga stanu `reserved`, sprawdza w `auth.users`, że znormalizowany e-mail użytkownika odpowiada próbie, i ustawia `auth_user_id` oraz `auth_created`. Powtórzenie z tym samym użytkownikiem zwraca `true`; inny użytkownik powoduje wyjątek.
3. `finalize_invited_registration` blokuje próbę i zaproszenie, wymaga `auth_created`, tego samego użytkownika i aktualnych wersji. W jednej transakcji zapisuje akceptację oraz dostarczenie prywatności przez `on conflict do nothing`, ustawia profil `active`, zapisuje `used_at/used_by`, czyści pola rezerwacji i ustawia próbę `finalized`. Powtórzenie dla już sfinalizowanej próby i tego samego użytkownika zwraca istniejący `accepted_at`; każda różnica powoduje wyjątek.
4. `release_registration_reservation` działa tylko, gdy zaproszenie nie ma `used_at` oraz: próba jest nadal `reserved` bez użytkownika albo próba ma stan `auth_created`, jej `auth_user_id` został wyzerowany przez `on delete set null` i użytkownik nie istnieje już w `auth.users`. Funkcja czyści rezerwację, oznacza próbę `cancelled`, usuwa ją i zwraca `true`. Próba zwolnienia przy istniejącym koncie zwraca wyjątek. Brak rezerwacji po wcześniejszym skutecznym zwolnieniu zwraca `false`.
5. `record_terms_acceptance` wymaga aktywnego profilu i bieżącej wersji. Wstawia akceptację i dostarczenie prywatności idempotentnie, nigdy nie aktualizuje wcześniejszego czasu i zwraca zapisany `accepted_at`.
6. `get_account_access_state` zwraca dokładnie `{ "currentTermsVersion": string, "currentPrivacyVersion": string, "acceptedVersion": string|null, "acceptanceRequired": boolean }`. Brak wpisu akceptacji nie jest błędem i daje `acceptanceRequired: true`.
7. `purge_registration_security_logs` używa czasu bazy, usuwa próby z `updated_at < now() - interval '90 days'` oraz zaproszenia bez aktywnej rezerwacji, których `used_at`, `revoked_at` albo `expires_at` są starsze niż 90 dni. Zwraca `{ "attemptsDeleted": integer, "invitationsDeleted": integer }` i nie usuwa aktywnego ani świeżego zaproszenia.

- [ ] **Step 3: Zablokować bezpośrednie wykonanie RPC**

```sql
revoke execute on function public.reserve_registration_invitation(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_registration_invitation(text, text, text, uuid) to service_role;
revoke execute on function public.attach_registration_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.attach_registration_user(uuid, uuid) to service_role;
revoke execute on function public.finalize_invited_registration(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_invited_registration(uuid, uuid, text, text) to service_role;
revoke execute on function public.release_registration_reservation(uuid) from public, anon, authenticated;
grant execute on function public.release_registration_reservation(uuid) to service_role;
revoke execute on function public.record_terms_acceptance(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_terms_acceptance(uuid, text, text) to service_role;
revoke execute on function public.get_account_access_state(uuid) from public, anon, authenticated;
grant execute on function public.get_account_access_state(uuid) to service_role;
revoke execute on function public.purge_registration_security_logs() from public, anon, authenticated;
grant execute on function public.purge_registration_security_logs() to service_role;
```

Nie dodawać schematu `private` do `api.schemas` w `supabase/config.toml`.

- [ ] **Step 4: Przetestować atomowość i idempotencję**

Run: `npm run test:db`

Expected: dokładnie jedna rezerwacja wygrywa; powtórzenie tej samej próby zwraca ten sam identyfikator; zużyte zaproszenie nigdy nie wraca do puli.

- [ ] **Step 5: Uzupełnić checkpoint migracji**

```powershell
git add -- ':(glob)supabase/migrations/*_add_invited_registration_and_legal_acceptance.sql' supabase/tests/database/legal_registration.test.sql
git commit --amend --no-edit
```

### Task 3: Polityka wejścia rejestracji

**Files:**
- Create: `registration-policy.js`
- Create: `test/registration-policy.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: body rejestracji i `CURRENT_LEGAL_DOCUMENT`.
- Produces: `normalizeInvitationToken(value)` i `validateRegistrationLegalInput(body, currentDocument)`.

- [ ] **Step 1: Napisać failing testy walidacji**

```js
test("odrzuca rejestrację bez jawnej akceptacji", () => {
  assert.throws(() => validateRegistrationLegalInput({
    termsAccepted: false,
    termsVersion: "1.0",
    privacyNoticeVersion: "1.0",
    invitationToken: "a".repeat(64),
  }, CURRENT_LEGAL_DOCUMENT), /zaakceptuj regulamin/);
});

test("odrzuca starą wersję dokumentu", () => {
  assert.throws(() => validateRegistrationLegalInput({
    termsAccepted: true,
    termsVersion: "0.9",
    privacyNoticeVersion: "1.0",
    invitationToken: "a".repeat(64),
  }, CURRENT_LEGAL_DOCUMENT), /aktualną wersję/);
});
```

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/registration-policy.test.js`

Expected: FAIL z brakiem modułu.

- [ ] **Step 3: Zaimplementować minimalną politykę**

Akceptować tylko boolean `true`, identyczne wersje i token w ściśle określonym formacie URL-safe. Funkcja zwraca zamrożony `{ invitationToken, termsVersion, privacyVersion }`; nie hashuje jeszcze tokenu.

- [ ] **Step 4: Uruchomić GREEN i składnię**

Run: `node --check registration-policy.js`; `node --test test/registration-policy.test.js`

Expected: PASS.

- [ ] **Step 5: Utworzyć checkpoint zadania**

```powershell
git add registration-policy.js test/registration-policy.test.js package.json
git commit -m "feat: validate invited legal registration input"
```

### Task 4: Orkiestracja wieloetapowej rejestracji

**Files:**
- Create: `registration-service.js`
- Create: `test/registration-service.test.js`

**Interfaces:**
- Produces: `registerInvitedUser(input, dependencies)`.
- Dependencies: `authClient`, `adminClient`, `serviceClient`, `legalDocument`, `hashInvitationToken`.

- [ ] **Step 1: Napisać test kolejności sukcesu**

Atrapy mają zapisać kolejność:

```js
assert.deepEqual(events, [
  "reserve",
  "signUp",
  "attach-user",
  "finalize",
  "return-session",
]);
```

Dodać testy: brak `signUp` po odmowie rezerwacji, brak sesji przed finalizacją, cleanup przez `admin.deleteUser` po błędzie finalizacji, brak zwolnienia rezerwacji jeśli usunięcie użytkownika nie zostało potwierdzone, idempotentne wznowienie.

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/registration-service.test.js`

Expected: FAIL z brakiem modułu.

- [ ] **Step 3: Zaimplementować serwis**

Sygnatura:

```js
async function registerInvitedUser(
  { email, password, invitationToken, termsVersion, privacyVersion, captchaToken },
  { authClient, adminClient, serviceClient, legalDocument, hashInvitationToken },
) {}
```

SHA-256 tokenu powstaje przed RPC. Serwis generuje `reservationId`, rezerwuje, wykonuje `signUp`, wiąże utworzonego użytkownika przez `attach_registration_user`, finalizuje i dopiero zwraca sesję. Błędy publiczne nie ujawniają, czy dany e-mail był zaproszony.

- [ ] **Step 4: Uruchomić testy**

Run: `node --test test/registration-service.test.js test/registration-policy.test.js`

Expected: PASS.

- [ ] **Step 5: Utworzyć checkpoint zadania**

```powershell
git add registration-service.js test/registration-service.test.js
git commit -m "feat: orchestrate atomic invited registration"
```

### Task 5: Integracja rejestracji, sesji i ponownej akceptacji w serwerze

**Files:**
- Create: `legal-access-service.js`
- Create: `test/legal-access-service.test.js`
- Modify: `server.js`
- Modify: `server/yarn-routes.js`
- Modify: `server/pattern-routes.js`
- Modify: `test/server.test.js`
- Modify: `test/yarn-routes.test.js`
- Modify: `test/pattern-routes.test.js`

**Interfaces:**
- Produces: `requireCurrentTermsSession(req, res)`.
- Produces: `POST /api/legal/acceptance` body `{version}`.
- Extends: `GET /api/auth/session` o `legal: {currentVersion, acceptedVersion, acceptanceRequired}`.

- [ ] **Step 1: Napisać testy dozwolonych i blokowanych tras**

Dla ważnej sesji ze starą zgodą test ma oczekiwać:

```js
assert.equal(await statusOf("GET", "/api/auth/session"), 200);
assert.equal(await statusOf("POST", "/api/auth/logout"), 200);
assert.notEqual(await statusOf("DELETE", "/api/account"), 403);
assert.equal(await statusOf("GET", "/api/yarns"), 403);
assert.equal(await statusOf("GET", "/api/patterns"), 403);
```

- [ ] **Step 2: Napisać test endpointu akceptacji**

Stara/sfałszowana wersja zwraca 409. Bieżąca wersja zapisuje przez service client i zwraca `{acceptedVersion, acceptedAt}`. Powtórzenie jest idempotentne.

- [ ] **Step 3: Potwierdzić RED**

Run: `node --test test/legal-access-service.test.js test/server.test.js test/yarn-routes.test.js test/pattern-routes.test.js`

Expected: FAIL na braku stanu prawnego i middleware.

- [ ] **Step 4: Zaimplementować stan prawny sesji**

`getAuthenticatedSession()` pobiera profil i stan akceptacji zaufanym klientem. Nie może polegać na RLS profilu, bo użytkownik bez aktualnej zgody musi nadal móc zaakceptować regulamin albo usunąć konto.

- [ ] **Step 5: Dodać middleware i endpoint**

Routery przyjmują `requireCurrentTermsSession` przez dependency injection. Logout, session, acceptance i delete-account zachowują słabszą bramkę zwykłego uwierzytelnienia.

- [ ] **Step 6: Zastąpić bezpośrednią rejestrację serwisem**

Endpoint `/api/auth/register` wywołuje `validateRegistrationLegalInput` i `registerInvitedUser`. Cookie sesji jest ustawiane tylko po udanej finalizacji.

- [ ] **Step 7: Uruchomić testy**

Run: `node --test test/legal-access-service.test.js test/registration-service.test.js test/server.test.js test/yarn-routes.test.js test/pattern-routes.test.js`

Expected: PASS.

- [ ] **Step 8: Utworzyć checkpoint zadania**

```powershell
git add legal-access-service.js test/legal-access-service.test.js server.js server/yarn-routes.js server/pattern-routes.js test/server.test.js test/yarn-routes.test.js test/pattern-routes.test.js
git commit -m "feat: enforce current terms across API access"
```

### Task 6: Bramka RLS oraz RPC magazynu

**Files:**
- Create: kolejna migracja wygenerowana przez `npx supabase migration new enforce_current_terms_for_private_data`
- Create: `supabase/tests/database/legal_access.test.sql`
- Modify: `supabase/tests/database/yarn_store_versions.test.sql`
- Modify: `test/migration.test.js`

**Interfaces:**
- Produces: `public.has_current_terms_acceptance()`.
- Protects: `profiles`, `yarns` i każde dostępne RPC danych prywatnych.

- [ ] **Step 1: Napisać failing pgTAP z JWT użytkownika**

Przetestować aktualną, starą i brakującą zgodę. Przy starej zgodzie `select` zwraca 0 wierszy, zapis jest odrzucony, a bezpośrednia zmiana historii niemożliwa.

- [ ] **Step 2: Zabezpieczyć dokładny zestaw `SECURITY DEFINER` RPC**

Run: `rg -n "security definer|grant execute" supabase/migrations`

Migracja ma zrealizować ustalony kontrakt:

- `get_yarn_store_version`, `insert_yarn_versioned`, `update_yarn_versioned` i `delete_yarn_versioned` pozostają dostępne dla `authenticated`, ale każda funkcja odrzuca wywołanie, gdy `public.has_current_terms_acceptance()` zwraca false;
- dawne `insert_yarn_with_limit` pozostaje usunięte i test migracji potwierdza brak funkcji;
- `create_auth_recovery_grant` i `consume_auth_recovery_grant` pozostają bez bramki regulaminu, ponieważ służą odzyskaniu sesji, ale nie mogą czytać ani zmieniać profilu lub magazynu;
- funkcje walidujące katalog i triggery pozostają service-only albo trigger-only i nie otrzymują nowych grantów dla użytkownika.

- [ ] **Step 3: Wygenerować migrację i dodać funkcję akceptacji**

```sql
create or replace function public.has_current_terms_acceptance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.terms_acceptances a
    join private.legal_document_versions v
      on v.kind = 'terms' and v.version = a.terms_version
    where a.user_id = auth.uid() and v.is_current
  );
$$;
```

Nadać `EXECUTE` tylko `authenticated`.

- [ ] **Step 4: Zaostrzyć polityki i RPC**

Polityki właściciela otrzymują dodatkowe `and public.has_current_terms_acceptance()`. Każde pozostawione RPC `SECURITY DEFINER` zaczyna od kontrolowanego wyjątku, jeśli funkcja zwraca false.

- [ ] **Step 5: Uruchomić testy bazy**

Run: `npm run test:db`; `node --test test/migration.test.js`

Expected: PASS, również próby bezpośredniego klienta ze starą zgodą.

- [ ] **Step 6: Utworzyć checkpoint zadania**

```powershell
git add -- ':(glob)supabase/migrations/*_enforce_current_terms_for_private_data.sql' supabase/tests/database/legal_access.test.sql supabase/tests/database/yarn_store_versions.test.sql test/migration.test.js
git commit -m "security: require current terms for private data"
```

### Task 7: Narzędzie operatora do zaproszeń

**Files:**
- Create: `scripts/manage-invitations.js`
- Create: `test/manage-invitations.test.js`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces CLI: `create --email <email> --expires-at <ISO>`, `revoke --id <uuid>` i `purge`.
- Persists: tylko SHA-256 sekretu; sekret jest wypisywany jeden raz po utworzeniu.

- [ ] **Step 1: Napisać failing test CLI core**

Test z atrapą klienta sprawdza normalizację e-maila, przyszłą datę, 32 losowe bajty, zapis 64-znakowego hex SHA-256 i brak jawnego tokenu w payloadzie bazy. Osobny test `purge` oczekuje jednego wywołania `purge_registration_security_logs` bez daty dostarczanej przez użytkownika.

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/manage-invitations.test.js`

Expected: FAIL z brakiem skryptu.

- [ ] **Step 3: Zaimplementować funkcje testowalne i CLI**

Eksportować `createInvitation`, `revokeInvitation`, `purgeRegistrationLogs`, `parseArgs`. Kod uruchamiany bezpośrednio korzysta z service clienta. Komunikat sukcesu pokazuje pełny link jeden raz i ostrzega, że nie da się go później odzyskać. `purge` deleguje obliczenie granicy 90 dni do czasu bazy przez service-only RPC.

- [ ] **Step 4: Dodać skrypt npm i instrukcję**

`package.json`:

```json
"invite": "node --env-file-if-exists=.env scripts/manage-invitations.js"
```

README wyjaśnia tworzenie i odwoływanie bez automatycznej wysyłki e-maila.

- [ ] **Step 5: Uruchomić testy bez tworzenia prawdziwego zaproszenia**

Run: `node --test test/manage-invitations.test.js`; `node --check scripts/manage-invitations.js`

Expected: PASS. Nie uruchamiać komendy `create` przeciwko zdalnej bazie.

- [ ] **Step 6: Utworzyć checkpoint zadania**

```powershell
git add scripts/manage-invitations.js test/manage-invitations.test.js package.json README.md
git commit -m "feat: add secure invitation management"
```

### Task 8: Usunięcie konta i końcowa weryfikacja

**Files:**
- Modify: `test/account-deletion-service.test.js`
- Modify: `test/server.test.js`
- Modify: `supabase/tests/database/legal_registration.test.sql`
- Modify: `SPEC.md`
- Modify: `CHANGELOG.txt`

**Interfaces:**
- Verifies: delete-account działa bez bieżącej zgody i usuwa prywatną historię przez kaskadę.

- [ ] **Step 1: Dodać test usunięcia ze starą zgodą**

Endpoint ma przejść do istniejącej walidacji hasła i frazy `USUŃ KONTO`, zamiast zwracać 403 z middleware regulaminu.

- [ ] **Step 2: Dodać pgTAP kaskady**

Po usunięciu `auth.users` nie istnieją profil, włóczki, akceptacje ani dostarczenia informacji. Zdarzenia rejestracyjne mogą pozostać jako ograniczony log bezpieczeństwa z wyzerowanym `auth_user_id`, lecz są usuwane najpóźniej po 90 dniach. Zużyte zaproszenie pozostaje zużyte i nie może zostać wykorzystane ponownie.

- [ ] **Step 3: Uruchomić kontrolę pakietu**

Run: `node --test test/account-deletion-service.test.js test/server.test.js`; `npm run test:db`; `npm run check`; `npm run lint`; `git diff --check`

Expected: PASS.

- [ ] **Step 4: Zaktualizować SPEC i CHANGELOG**

Opisać dostęp na zaproszenie, stan niekompletny, osobną akceptację regulaminu, przekazanie prywatności i wyjątki logout/delete.

- [ ] **Step 5: Utworzyć checkpoint dokumentacji**

```powershell
git add test/account-deletion-service.test.js test/server.test.js supabase/tests/database/legal_registration.test.sql SPEC.md CHANGELOG.txt
git commit -m "docs: record invited legal access model"
```

## Completion Gate

Plan jest wykonany, gdy tylko poprawnie zaproszony e-mail może ukończyć rejestrację, równoległe użycie tokenu ma jednego zwycięzcę, bieżąca akceptacja jest niezmienna i wersjonowana, a backend, RLS oraz RPC blokują stare zgody bez blokowania wylogowania i usunięcia konta. Nie stosować migracji do zdalnego Supabase i nie tworzyć prawdziwych zaproszeń bez osobnej zgody użytkownika.
