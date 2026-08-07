# Security Hardening (Supabase Free) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Zamknąć potwierdzone ryzyka z restrykcyjnego audytu bez upgrade'u Supabase, zachowując działanie aplikacji i odtwarzalność produkcyjnego ACL z repozytorium.

**Architecture:** Backend pozostaje źródłem prawdy dla sesji, limitów i autoryzacji. Migracje Supabase zostaną zapisane w repozytorium jako jawne, idempotentne migracje ACL/RLS; ostrzeżenie ochrony wyciekłych haseł pozostanie udokumentowanym ograniczeniem planu Free. Każda zmiana behawioralna powstaje test-first.

**Tech Stack:** Node.js 24, natywne `node:test`, Supabase SQL migrations/pgTAP, GitHub Actions, Docker Compose staging.

## Global Constraints

- Nie wykonywać upgrade'u Supabase ani żadnych płatnych zmian.
- Nie wykonywać deployu produkcyjnego ani zdalnych migracji bez osobnej zgody.
- Nie osłabiać izolacji RLS ani nie usuwać kontrolowanych RPC bez zastępczej ścieżki.
- Zachować kompatybilność istniejących cookies, recovery i ETag/If-Match.
- Każdy błąd bezpieczeństwa otrzymuje test regresyjny przed kodem produkcyjnym.

---

### Task 1: Reconcile production ACL in repository

**Files:**
- Create: `supabase/migrations/20260807150000_reconcile_yarn_acl_and_recovery.sql`
- Modify: `supabase/tests/database/yarn_store_versions.test.sql`
- Modify: `supabase/tests/database/migration_replay.test.sql`
- Test: `test/migration.test.js`

- [x] Dodać idempotentne `REVOKE` bezpośrednich mutacji `yarns` i sekwencji oraz ochronę prywatnego licznika.
- [ ] Dodać test tekstowy migracji i testy pgTAP dla `anon`/`authenticated`.
- [x] Uruchomić testy Node; replay pgTAP oznaczyć jako niewykonany, jeśli brak Docker/Podman.

### Task 2: Enforce idle-session cookie

**Files:**
- Modify: `server.js:getAuthenticatedSession`
- Modify: `test/server.test.js`
- Modify: `test/idle-session-controller.test.js`

- [x] Napisać test RED: ważne tokeny bez `motek_idle_activity` kończą sesję i czyszczą cookies.
- [ ] Napisać test RED dla poprawnego cookie i odświeżenia aktywności.
- [x] Wymusić obecność oraz poprawny podpis cookie dla istniejącej sesji.
- [ ] Uruchomić testy sesji i pełny check.

### Task 3: Protect password recovery and preserve grants on transient failure

**Files:**
- Modify: `server.js`
- Modify: `supabase/migrations/20260807150000_reconcile_yarn_acl_and_recovery.sql`
- Modify: `test/server.test.js`
- Modify: `test/account-deletion-service.test.js` only if shared auth fixtures require it

- [x] Dodać testy RED: zwykła sesja nie zmienia hasła; grant innego użytkownika/wygasły jest odrzucany.
- [ ] Zużywać grant dopiero po udanym `updateUser`, z bezpieczną obsługą ponowienia.
- [ ] Po zmianie hasła wyczyścić cookies i unieważnić pozostałe sesje zgodnie z istniejącym kontraktem.
- [ ] Uruchomić testy Auth.

### Task 4: Make dependency failures and logout safe

**Files:**
- Modify: `server.js`
- Modify: `test/server.test.js`

- [ ] Dodać testy RED dla timeoutu/5xx profilu oraz wyjątku `signOut`.
- [x] Zwracać 503 dla awarii zależności bez kasowania poprawnych cookies.
- [x] Czyścić cookies w `finally` podczas logoutu.
- [ ] Dodać test rzeczywistej odpowiedzi dla slow-body i nie niszczyć socketu przed 408.

### Task 5: Bound matching and public API abuse

**Files:**
- Modify: `server.js`
- Modify: `server/pattern-routes.js`
- Modify: `test/matching-service.test.js`
- Modify: `test/pattern-routes.test.js`

- [ ] Dodać testy RED dla częściowego wyniku przy jednym zbyt ciężkim wariancie.
- [x] Dodać limit per IP/użytkownik dla `GET /api/patterns`, `/api/matches` i `POST /api/auth/recovery`.
- [ ] Zwracać 429 z `Retry-After` i nie ujawniać szczegółów limitów.
- [ ] Uruchomić testy tras i matching.

### Task 6: Supply-chain and staging correctness

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `deploy/staging/compose.yaml`
- Modify: `test/staging-config.test.js`
- Modify: `eslint.config.js`, `.prettierrc.json`, `package.json` only as required by formatter

- [x] Przypiąć `supabase/setup-cli` do pełnego SHA.
- [ ] Przypiąć obrazy stagingowe do digestów i zachować komentarze z tagami.
- [x] Zastąpić regex testem semantycznym, który zakazuje `ports` dla `app` i wymaga publicznego WAF.
- [ ] Usunąć sześć ostrzeżeń lint i naprawić formatowanie.

### Task 7: Auth single source and documentation

**Files:**
- Modify: `index.html`, `app.js`, `client/auth-controller.js`
- Modify: `test/auth-controller.test.js`, `test/auth.test.js`
- Modify: `README.md`, `SPEC.md`, `docs/operations/security-audit-status-2026-08-07.md`

- [ ] Wybrać jedną implementację Auth używaną przez produkcyjny `index.html`.
- [ ] Usunąć martwy import/duplikację bez zmiany widocznego kontraktu.
- [x] Udokumentować, że leaked-password protection pozostaje wyłączona z powodu planu Free.
- [ ] Dodać listę kontroli po wdrożeniu i komendę weryfikacyjną.

### Task 8: Final verification and checkpoint

- [ ] Uruchomić `npm run check`, `npm run lint`, `npm run format:check`, `npm audit --json`.
- [ ] Uruchomić `npm run staging:check` oraz dostępne testy pgTAP.
- [ ] Sprawdzić `https://www.rysia.org/health/ready` bez zmieniania produkcji.
- [ ] Zaktualizować `AUDYT_SEC.md` o statusy po poprawkach.
- [ ] Zaproponować osobny commit; push/deploy dopiero po decyzji użytkownika.
