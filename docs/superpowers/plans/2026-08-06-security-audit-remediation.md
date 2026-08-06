# Motek Security Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zamknąć ustalenia audytu bezpieczeństwa z 2026-08-06 przed wdrożeniem produkcyjnym, zaczynając od integralności danych i przejęcia sesji, a kończąc na odporności, łańcuchu dostaw i dokumentacji.

**Architecture:** Naprawy są pogrupowane według wspólnej granicy odpowiedzialności: baza/RPC, sesja Auth, frontendowy stan wyścigów, kontrakty API i limity, wdrożenie oraz dokumentacja. Każdy pakiet ma własne testy regresyjne i może zostać wdrożony dopiero po przejściu lokalnej bramki; zdalne migracje i staging wymagają osobnej zgody.

**Tech Stack:** Node.js 24, CommonJS, `node:test`, jsdom, Supabase/PostgreSQL, pgTAP, GitHub Actions, Docker/Podman dla lokalnego replay migracji.

## Global Constraints

- Nie wdrażać migracji ani nie zmieniać konfiguracji Supabase, Railway, Cloudflare lub produkcji bez osobnej zgody użytkownika.
- Zachować RLS, `USING`/`WITH CHECK`, `(select auth.uid())`, pusty `search_path` funkcji `SECURITY DEFINER` i zasadę least privilege.
- Nie ujawniać sekretów, tokenów, cookies ani pełnych błędów dostawców w logach lub odpowiedziach HTTP.
- Nie zmieniać zatwierdzonego wyglądu i tekstów produktu poza komunikatami koniecznymi do poprawnego błędu.
- Każda zmiana kontraktu API musi mieć test integracyjny klient–backend; testy tekstu migracji pozostają pomocnicze.
- Przed rozpoczęciem sprawdzić istniejące zmiany `git status --short`; nie usuwać ani nie nadpisywać plików stagingowych i wcześniejszych planów.
- Po każdym spójnym pakiecie uruchomić `npm run check`, a checkpoint Git proponować dopiero po weryfikacji i zgodzie użytkownika.

---

### Task 0: Ustalenie punktu bazowego i zakresu

**Files:**
- Inspect: `git status --short`, `README.md`, `SPEC.md`, `AUDYT_SEC.md`
- Inspect: `package.json`, `.github/workflows/ci.yml`, `supabase/migrations/`, `supabase/tests/database/`

**Interfaces:**
- Consumes: bieżący stan gałęzi i wyniki audytu.
- Produces: lista ustaleń nadal otwartych, lista zmian obcych pakietowi oraz potwierdzona komenda bazowa.

- [ ] **Step 1: Spisać stan repozytorium bez modyfikacji**

Run:

```powershell
git status --short --branch
git diff --stat
git diff --cached --stat
```

Expected: wiadomo, które pliki są już zmienione; żaden plik nie jest resetowany ani usuwany.

- [ ] **Step 2: Uruchomić istniejącą bramkę aplikacji**

Run: `npm run check`

Expected: wynik bazowy zapisany w notatce zadania; ewentualne wcześniejsze awarie są odseparowane od regresji.

- [ ] **Step 3: Potwierdzić ograniczenia środowiska DB**

Run: `supabase --version` oraz `docker version` lub `podman version`.

Expected: jeśli brak silnika kontenerów, zaplanować wykonanie pgTAP w środowisku CI/staging jako osobną bramkę, bez udawania lokalnego sukcesu.

---

### Task 1: Wymuszenie wersjonowanego zapisu magazynu włóczek (U-01, U-05, U-11)

**Files:**
- Create: `supabase/migrations/20260806120000_restrict_yarn_mutations.sql`
- Modify: `server.js`, `server/yarn-routes.js`
- Modify: `supabase/tests/database/yarn_store_versions.test.sql`
- Modify: `supabase/tests/database/migration_replay.test.sql`
- Modify: `test/yarn-routes.test.js`, `test/server.test.js`

**Interfaces:**
- Consumes: istniejące RPC wersjonowane oraz `If-Match`/ETag z tras `/api/yarns`.
- Produces: `authenticated` może odczytywać własne dane, ale mutacje tabeli i sekwencji są możliwe wyłącznie przez kontrolowane RPC; konflikt wersji zwraca HTTP `409`.

- [ ] **Step 1: Napisać wykonawcze testy ACL/RLS jako `anon` i `authenticated`**

Testy pgTAP mają wykazać: brak `INSERT/UPDATE/DELETE` na `public.yarns`, brak dostępu do sekwencji, widoczność wyłącznie własnych rekordów, działanie RPC, limit 500, zmianę wersji i odrzucenie stale version.

- [ ] **Step 2: Odtworzyć replay migracji i ustalić duplikat tabeli**

Na pustej bazie oraz na kopii schematu sprawdzić istnienie `public.yarn_store_versions` i docelowej tabeli prywatnej. Historycznych migracji nie zmieniać; nowa migracja najpierw odbiera ACL, a następnie usuwa publiczny duplikat tylko po potwierdzeniu, że nie zawiera danych wymaganych przez backend.

- [ ] **Step 3: Odebrać bezpośrednie mutacje i sekwencje**

Nowa migracja wykonuje jawne `REVOKE INSERT, UPDATE, DELETE ON public.yarns FROM authenticated` oraz `REVOKE USAGE, SELECT ON SEQUENCE public.yarns_id_seq FROM authenticated`, a następnie nadaje wyłącznie wymagane `GRANT SELECT` i `GRANT EXECUTE` na RPC. Nie zmieniać istniejących plików migracji, aby nie rozjechać historii wdrożeń.

- [ ] **Step 4: Sprawdzić ścieżki backendu**

`server/yarn-routes.js` i funkcje w `server.js` nie mogą omijać RPC. Błąd SQL konfliktu mapować na `409`, a limit i licznik wersji zweryfikować testem dwóch równoległych zapisów z jednym ETagiem.

- [ ] **Step 5: Uruchomić bramkę DB i aplikacji**

Run: `supabase db reset --local`, `supabase test db --local`, `npm run check`.

Expected: bezpośredni zapis jest odrzucony, RPC działa, jeden z dwóch równoległych zapisów kończy się `200/201`, drugi `409`, a rollback nie zmienia rekordu ani licznika.

---

### Task 2: Zamknięcie luk w sesji Auth i odporność na awarie dostawcy (U-02, U-03, U-06, U-07)

**Files:**
- Modify: `server.js`
- Modify: `client/idle-session-controller.js`
- Create: `supabase/migrations/20260806123000_add_recovery_grants.sql`
- Modify: `test/auth.test.js`, `test/server.test.js`, `test/idle-session-controller.test.js`
- Inspect/adjust: `index.html`, `app.js` dla kontraktu recovery

**Interfaces:**
- Consumes: cookies `motek_access_token`, `motek_refresh_token`, `motek_idle_activity` oraz istniejące `/api/auth/recovery`.
- Produces: brak lub nieważność idle cookie kończy zwykłą sesję; zmiana hasła wymaga jednorazowego, DB-backed dowodu recovery; awaria profilu nie kasuje poprawnej sesji; logout zawsze czyści cookies.

- [ ] **Step 1: Zdefiniować stan recovery i politykę sesji**

Użyć krótkotrwałego, podpisanego cookie `motek_recovery_grant` zawierającego `user_id`, `jti` i `exp`; hash `jti` przechowywać w `private.auth_recovery_grants` z `expires_at` i `used_at`. Grant tworzyć wyłącznie po udanym `/api/auth/recovery`, atomowo oznaczać jako użyty przy zmianie hasła i po sukcesie unieważnić pozostałe sesje. Nie używać pamięci procesu jako jedynego magazynu, bo aplikacja może działać na wielu instancjach.

- [ ] **Step 2: Napisać testy RED**

Testy mają obejmować usunięte idle cookie przy ważnych tokenach (`401` i czyszczenie), recovery token wygasły/przypisany do innego użytkownika/powtórnie użyty, błąd `signOut` z wygaszeniem cookies oraz timeout/5xx lookupu profilu (`503` bez kasowania cookies).

- [ ] **Step 3: Zmienić `getAuthenticatedSession` i `/api/auth/password`**

Brak idle cookie nie może być automatycznie odtwarzany dla istniejącej sesji; wyjątkiem jest tylko bezpośrednia odpowiedź login/recovery, która sama ustanawia komplet cookies. `/api/auth/password` ma wymagać ważnego, nieużytego grantu, a po sukcesie atomowo oznaczyć go jako użyty i wyczyścić cookies. Rozróżnić `not found` profilu od timeoutu, błędu sieci i 5xx.

- [ ] **Step 4: Zabezpieczyć logout i heartbeat**

Czyścić cookies w `finally` niezależnie od `signOut`. W kliencie `client/idle-session-controller.js` wygaszać sesję natychmiast tylko dla jednoznacznych `401/403`; timeout, `429` i `5xx` obsługiwać ograniczonym retry/backoffem.

- [ ] **Step 5: Uruchomić testy**

Run: `node --test test/auth.test.js test/server.test.js test/idle-session-controller.test.js` oraz `npm run check`.

Expected: żadna awaria dostawcy nie powoduje niejawnego przejęcia ani utraty poprawnej sesji, a zmiana hasła nie jest możliwa ze zwykłej sesji bez dodatkowego dowodu.

---

### Task 3: Ochrona draftu i spójny kontrakt klienta Auth (U-04, U-08, U-13, U-14, U-15, U-20, U-21)

**Files:**
- Modify: `app.js`
- Modify: `client/idle-session-controller.js`, `client/auth-controller.js`, `client/api-client.js`
- Modify: `index.html`
- Modify: `test/*-controller.test.js`, `test/api-client.test.js`, `test/password-reveal-dom.test.js`

**Interfaces:**
- Consumes: `refresh()`, `loadYarns()`, istniejący `/api/auth/recovery` oraz stan formularzy Auth.
- Produces: opóźniony GET nie nadpisuje nowszego draftu; frontend i backend używają jednego kontraktu confirmation/recovery; timeout sesji pochodzi z serwera; CAPTCHA jest resetowana po każdej próbie; produkcja używa tego samego kontrolera Auth, który jest testowany.

- [ ] **Step 1: Napisać test wyścigu GET–draft**

Opóźnić odpowiedź `GET /api/yarns`, rozpocząć dodawanie lub edycję, a następnie zwrócić dane. Test ma potwierdzić, że `replaceChildren` nie usuwa niezapisanego draftu, a odpowiedź ze starej generacji jest ignorowana.

- [ ] **Step 2: Dodać licznik generacji żądań**

W `app.js` przechowywać licznik bieżącego odczytu i stosować wynik tylko dla aktualnej generacji. Zwiększać licznik przed każdym `refresh()` oraz przed zmianą widoku, aby przestarzała odpowiedź nie mogła wykonać `replaceChildren`.

- [ ] **Step 3: Uzgodnić endpoint confirmation**

Dodać brakującą trasę `POST /api/auth/confirmation`, przyjmującą wyłącznie tokeny z fragmentu URL, walidującą `access_token`/`refresh_token`, ustawiającą cookies po udanym `setSession` i zwracającą generyczny błąd dla tokenu wygasłego lub ponownie użytego. Objąć ją tym samym limitem Auth co recovery. Test ładuje prawdziwy `index.html`, nie tylko moduł pomocniczy.

- [ ] **Step 4: Ujednolicić timeout, heartbeat i CAPTCHA**

Dodawać `idleTimeoutMs` do odpowiedzi `/api/auth/session`, loginu, rejestracji, recovery i confirmation, a kontrolerowi udostępnić `setTimeoutMs(timeoutMs)`. Po każdej próbie resetu hasła zerować token CAPTCHA i resetować widget w `finally`; komunikat hasła ma odpowiadać walidacji Unicode po stronie serwera.

- [ ] **Step 5: Usunąć duplikację Auth bez zmiany UX**

Podłączyć `client/auth-controller.js` w produkcyjnym `index.html` i przekazać mu istniejący `api-client.js`; następnie usunąć duplikaty obsługi login/register/logout z `app.js`, tak aby testowany moduł był tym, który obsługuje realny przepływ.

- [ ] **Step 6: Uruchomić testy przeglądarkowe i regresję**

Run: `npm run check` oraz `npm run regression:smoke` przy uruchomionym lokalnym serwerze.

Expected: draft pozostaje nienaruszony, recovery działa przez jeden kontrakt, błędy sieci nie wylogowują pochopnie, a CAPTCHA wymaga nowego tokenu po każdej próbie.

---

### Task 4: Kontrakty API, limity kosztu i walidacja danych (U-09, U-10, U-12, U-18, U-19)

**Files:**
- Modify: `server.js`, `server/pattern-routes.js`, `server/yarn-routes.js`, `server/matching-service.js`
- Modify: `matching-policy.js`, `material-policy.js`, `scripts/import-patterns.js`
- Create: `supabase/migrations/20260806130000_harden_pattern_payload_limits.sql`
- Modify: `test/matching-service.test.js`, `test/yarn-routes.test.js`, `test/pattern-routes.test.js`, `test/import-patterns.test.js`
- Modify: `supabase/tests/database/matching_requirements.test.sql`

**Interfaces:**
- Consumes: publiczny katalog, `/api/matches`, importer wzorów i `readBody`.
- Produces: kosztowne trasy mają limity per IP/użytkownik i `429 Retry-After`; pojedynczy wariant ponad limit daje częściowy/oznaczony wynik; importer i DB mają ten sam kontrakt walidacji; timeout body kończy się kontrolowanym HTTP; `avatar_url` ma limit lub zostaje usunięte.

- [ ] **Step 1: Napisać testy graniczne**

Obejmują one: jeden wariant ponad limit przy poprawnych pozostałych, serię żądań poniżej/powyżej progu, nieznany materiał, zbyt wiele wymagań, dokument ponad limit, wolne body oraz `avatar_url` ponad 2048 znaków.

- [ ] **Step 2: Wprowadzić wspólną politykę limitowania**

Zastosować limity przed kosztownym dopasowaniem: pominąć tylko wariant przekraczający budżet, zwrócić poprawne pozostałe wyniki z `limited: true`, a całe żądanie odrzucać wyłącznie wtedy, gdy nie da się bezpiecznie obliczyć żadnego wyniku. Skonfigurować zaufany proxy tak, aby klucz IP nie był sterowany przez klienta; dodać `Retry-After`.

- [ ] **Step 3: Ujednolicić walidację importera i DB**

Egzekwować dozwolone materiały, maksymalną liczbę wymagań, długości pól, wartości liczbowe, rozmiar JSON i limit 300 wzorów zarówno w `scripts/import-patterns.js`, jak i w migracji/triggerze DB.

- [ ] **Step 4: Naprawić timeout body i profil URL**

Nie niszczyć socketu przed próbą wysłania deklarowanego 408; zakończyć przetwarzanie body w sposób zgodny z Node HTTP. Zachować `avatar_url`, dodać `CHECK (char_length(avatar_url) <= 2048)` oraz walidację URL w tym samym kontrakcie API.

- [ ] **Step 5: Uruchomić testy**

Run: `node --test test/matching-service.test.js test/yarn-routes.test.js test/pattern-routes.test.js test/import-patterns.test.js`, następnie `npm run check`.

Expected: pojedyncze wadliwe dane nie wyłączają całego dopasowania, nadużycie publicznych tras kończy się `429`, a walidacja API/importera/DB jest spójna.

---

### Task 5: Powtarzalny łańcuch dostaw i konfiguracja wdrożeń (U-16, U-17 oraz założenia środowiskowe)

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `deploy/staging/compose.yaml`, `deploy/staging/compose.dashboard.yaml`
- Modify: `deploy/staging/nginx/templates/default.conf.template`
- Modify: `test/deployment-policy.test.js`, `test/staging-config.test.js`, `test/proxy-policy.test.js`
- Add/update: konfiguracja Dependabot lub Renovate, jeśli repozytorium już jej używa

**Interfaces:**
- Consumes: referencje akcji GitHub, obrazy stagingowe, `TRUST_PROXY`, `/internal/metrics` i Turnstile.
- Produces: akcje i obrazy są przypięte do pełnych SHA/digestów; testy odrzucają ruchome tagi; staging dokumentuje ukrycie originu, zaufany proxy, metrics i CAPTCHA.

- [ ] **Step 1: Przypiąć `supabase/setup-cli` do pełnego SHA**

Zachować proces aktualizacji przez Dependabot/Renovate lub ręczny review; test workflow ma odrzucać referencje `@v1`, `@main` i podobne.

- [ ] **Step 2: Przypiąć obrazy do digestów**

W obu plikach Compose zastąpić tagi referencjami `image@sha256:...`; tag wersji zachować w komentarzu/metadanych dla czytelności.

- [ ] **Step 3: Zweryfikować stagingowe granice zaufania**

Testy i konfiguracja mają potwierdzić nadpisywanie `X-Forwarded-For`, brak bezpośredniego originu, prywatność `/internal/metrics` oraz jawne wymaganie CAPTCHA, gdy Turnstile jest włączony.

- [ ] **Step 4: Uruchomić walidację CI/staging**

Run: `npm run lint`, `npm run format:check`, `npm run staging:check`, `npm run railway:check` oraz testy workflow bez publikowania wdrożenia.

---

### Task 6: Dokumentacja kontraktów i pomiar wydajności (U-22, U-23)

**Files:**
- Modify: `SPEC.md`, `README.md`
- Modify: `docs/ARCHITECTURE.md`, jeśli opis jest niespójny z implementacją
- Create: `test/inventory-performance.test.js`
- Modify: `test/design-layout.test.js` tylko jeśli test ma ładować zaktualizowane źródła

**Interfaces:**
- Consumes: faktyczne trasy, sposób zapisu magazynu i limit 500 rekordów.
- Produces: specyfikacja opisuje aktualny kontrakt, a pomiar definiuje budżet renderowania 500 kart bez wdrażania wirtualizacji bez dowodu problemu.

- [ ] **Step 1: Zaktualizować kontrakt produktu**

Usunąć opis autosave, dodać `PATCH /api/yarns/:id`, tabelę tras Auth/yarns/patterns/matches oraz jedno źródło prawdy dla zapisu i wersjonowania.

- [ ] **Step 2: Dodać pomiar 500 kart**

Zmierz czas pierwszego renderu, filtrowania, interakcji i zużycie pamięci dla 500 kart na umiarkowanym środowisku. Ustalić próg regresji; wirtualizację/paginację wdrożyć tylko po przekroczeniu progu.

- [ ] **Step 3: Zweryfikować dokumentację**

Run: test dokumentacyjny tras oraz `git diff --check`. Każda udokumentowana trasa ma odpowiadać rejestracji backendu i wywołaniu klienta.

---

### Task 7: Końcowa bramka i decyzja o wdrożeniu

**Files:**
- Inspect: wszystkie pliki zmienione w Tasks 1–6
- Modify: `docs/operations/post-deploy-regression.md`

**Interfaces:**
- Consumes: wyniki testów wszystkich pakietów i potwierdzenia środowiskowe.
- Produces: dowód gotowości albo jawna lista blokad przed produkcją.

- [ ] **Step 1: Uruchomić pełny zestaw lokalny**

Run:

```powershell
npm run lint
npm run format:check
npm run check
npm audit
git diff --check
```

- [ ] **Step 2: Uruchomić DB replay/pgTAP w środowisku z kontenerami**

Run: `supabase db reset --local` oraz `supabase test db --local`.

Expected: testy wykonawcze ACL, RLS, RPC, rollbacku, stale version i współbieżności przechodzą; jeśli środowisko nadal nie jest dostępne, wynik pozostaje oznaczony jako niewykonany.

- [ ] **Step 3: Wykonać smoke test HTTP**

Przy `npm start` sprawdzić logowanie, recovery, zmianę hasła, logout po błędzie dostawcy, magazyn, konflikt wersji, draft, katalog, matches, rate limiting i oba motywy. Nie usuwać realnego konta bez osobnej zgody.

- [ ] **Step 4: Sporządzić decyzję release**

Wdrożenie blokują: którekolwiek ustalenie wysokie, brak testów DB lub niepotwierdzone granice originu/metrics. Po zamknięciu blokad przygotować osobny, zatwierdzany checkpoint Git i dopiero potem planować publikację.

## Definition of Done

- U-01–U-04 mają testy regresyjne i poprawki potwierdzone lokalnie.
- `authenticated` nie może mutować tabeli włóczek bez RPC; dwa równoległe zapisy z jednym ETagiem dają jeden sukces i jeden `409`.
- Brak/wygaśnięcie idle cookie nie odtwarza sesji, a zmiana hasła wymaga przyjętego dowodu recovery lub reautoryzacji.
- Opóźniony GET nie usuwa draftu; błędy sieci nie powodują niepotrzebnego wylogowania.
- Publiczny duplikat tabeli wersji jest usunięty albo odizolowany, a testy DB wykonują realne operacje jako właściwe role.
- Publiczne i kosztowne trasy mają rate limiting, `Retry-After` i bezpieczny kontrakt częściowych wyników.
- Akcje CI i obrazy stagingowe są przypięte do niezmiennych rewizji/digestów.
- `SPEC.md` opisuje faktyczne trasy i zapis, a wydajność 500 kart ma zmierzony budżet.
- Pełna bramka przechodzi albo każda niewykonana część jest jawnie oznaczona jako blokada; nie ma twierdzenia o gotowości produkcyjnej bez tych dowodów.
