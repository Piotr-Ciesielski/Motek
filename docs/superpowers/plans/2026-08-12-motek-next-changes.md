# Motek — recovery i gotowość release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Domknąć pakiet atomowego recovery, przygotować jeden kontrolowany release candidate i przejść przez techniczne, prawne oraz operatorskie bramki przed ewentualną publikacją produkcji.

**Architecture:** Prace są etapowe: najpierw weryfikacja recovery na poziomie Node i PostgreSQL, następnie izolowany candidate branch, potem staging na dokładnie tym samym SHA, gotowość prawna/infrastrukturalna i dopiero na końcu osobno zatwierdzona produkcja. Nie ma automatycznego scalania całej gałęzi stagingowej ani automatycznych zmian usług zewnętrznych.

**Tech Stack:** Node.js 24, natywny node:test, PostgreSQL/Supabase migrations i pgTAP, Git, GitHub Actions, Railway, Cloudflare, Markdown.

## Global Constraints

- Nie tworzyć drugiej migracji recovery; używać supabase/migrations/20260812122131_add_recovery_grant_claim.sql.
- Nie dodawać AUDYT_SEC.md, AUDYT_UXUI.md, Designs/, tools/ ani wcześniejszych nieśledzonych planów do checkpointu recovery.
- Nie wykonywać zdalnych migracji Supabase, importu danych, zmian Cloudflare, deployu Railway ani produkcyjnego rollbacku bez osobnej zgody operatora.
- Nie używać git push --force, git reset --hard, git clean -fd ani mechanicznego merge całej gałęzi stagingowej.
- Nie podbijać wersji do 2.0.0-alpha.40 przed przejściem jednego kandydata przez staging.
- Nie włączać Cloudflare Access przed obsługą service-tokenów w workflow regresji.
- Nie włączać HSTS przed potwierdzeniem wszystkich domen i subdomen HTTPS.
- Nie ujawniać sekretów, tokenów, haseł, cookies, pełnych URL-i z danymi dostępowymi ani danych QA.
- Zapisy do tych samych plików wykonuje jeden agent naraz; agenci read-only mogą działać równolegle.
- Każdy etap kończy się testem, przeglądem zakresu i decyzją: kontynuować albo zatrzymać.

## Aktualny punkt startowy

- Aktualny checkpoint pakietu RC: `release/motek-recovery-rc@8ea27c6` — `feat: add legacy yarn rpc cleanup migration`.
- Pakiet RC obejmuje forward-only recovery/legal/versioned delta oraz osobną migrację cleanupu dwóch legacy overloadów `insert_yarn_with_limit`; stagingowy SHA pozostaje źródłem prawdy dla wdrożonego kodu aplikacji.
- Kod wdrożony na stagingu pozostaje na dokładnie `e691af891758ebc17f6d4683dbca5d997f65dbe5`; RC `8ea27c6` jest kandydatem migracyjnym i dokumentacyjnym, nie dowodem wdrożenia aplikacji.
- Czysta weryfikacja RC: `npm run check` 389/389 PASS.
- `npm run lint`: PASS; `git diff --check`: PASS.
- Lokalny Supabase RC: czysty replay i pełny pgTAP PASS — 9 plików, 291/291 testów.
- `npm run format:check` pozostaje zależny od lokalnych końców linii Windows dla czterech niezmienionych plików bazowej konfiguracji; nie jest to zmiana pakietu RC.
- `npm run legal:check`: nadal `LEGAL_PUBLICATION=not ready`; dostawcy wymagają zewnętrznych dowodów.
- Pozostałe zmiany głównego checkoutu są niezależne od RC i nie należy ich dodawać do checkpointu.

## Zespół agentów

- motek_explorer — mapuje kod, migracje, dokumentację i ryzyka; tylko odczyt.
- motek_worker — wykonuje małą zmianę w jawnie przydzielonych plikach i uruchamia testy.
- motek_reviewer — niezależnie sprawdza wymagania, bezpieczeństwo, regresje i zakres; tylko odczyt.

Domyślny przebieg: explorer → worker → reviewer. Prace read-only recovery i release mogą być analizowane równolegle. Zmiany w server.js, test/server.test.js i SQL nie mogą być wykonywane równolegle przez różnych workerów.

---

### Task 1: Zamrozić zakres i przygotować inwentarz release

**Files:**
- Read: AGENTS.md, AGENTS.override.md, README.md, SPEC.md.
- Read: docs/operations/staging-status-2026-08-07.md, docs/operations/legal-readiness-status-2026-08-11.md, docs/operations/post-deploy-regression.md.
- Read: docs/superpowers/plans/2026-08-11-production-readiness-three-tracks.md.
- Read: Git status, log i diff.

**Interfaces:**
- Consumes: bieżący checkout i lokalne raporty.
- Produces: lista plików należących do recovery, lista pięciu nieopublikowanych commitów oraz lista nieśledzonych artefaktów wyłączonych z checkpointu.

- [x] **Step 1: Odczytać stan bez modyfikacji**

~~~
git status --short --branch
git log --oneline --decorate -12
git diff --stat
git diff --name-status
~~~

- [x] **Step 2: Ustalić zakres commitów przed origin**

~~~
git log --oneline origin/agent/staging-security-merge..HEAD
git diff --stat origin/agent/staging-security-merge...HEAD
~~~

Każdy z pięciu commitów ma otrzymać decyzję: należy do kandydata albo pozostaje poza kandydatem. Bez tej decyzji nie wykonywać pushu.

- [x] **Step 3: Sprawdzić nieśledzone materiały**

~~~
git status --short --untracked-files=all
~~~

Potwierdzić, że Designs/, AUDYT_*, tools/ i wcześniejsze plany nie są częścią recovery.

- [x] **Step 4: Przekazać raport do recenzji**

motek_explorer zwraca tabelę: element, ścieżka/SHA, decyzja, uzasadnienie i test wymagany przed dalszą pracą. motek_reviewer odrzuca raport, jeśli miesza nieśledzone materiały z kodem.

- [x] **Step 5: Bramka zakresu**

Kontynuować tylko wtedy, gdy istnieje jawna lista plików recovery i jawna lista commitów, które mogą wejść do candidate branch.

### Task 2: Domknąć kontrakt testowy recovery w Node

**Files:**
- Modify: test/server.test.js w istniejącym fixture recoveryGrantState i podteście zmiany hasła.
- Read: server.js w obsłudze POST /api/auth/password.
- Test: node --test test/server.test.js.

**Interfaces:**
- Consumes: claim_auth_recovery_grant, release_auth_recovery_grant, consume_auth_recovery_grant.
- Produces: testowy kontrakt kolejności i kompensacji bez ujawniania szczegółów recovery.

- [x] **Step 1: Zachować test błędu claim RPC**

Fixture ma ustawiać recoveryGrantState.claimError i potwierdzać:

~~~
assert.equal(response.status, 503);
assert.equal(recoveryGrantState.updateUserCalls, updateUserCallsBefore);
assert.equal(
  recoveryGrantEvents.some(({ name }) => name === "consume_auth_recovery_grant"),
  false,
);
~~~

- [x] **Step 2: Dodać test błędu release RPC**

Rozszerzyć fixture o releaseError. Po błędzie updateUser test ma potwierdzić status 400, sekwencję claim → updateUser → release oraz brak ujawnienia błędu RPC w odpowiedzi. Błąd release nie może zmienić bezpiecznego komunikatu użytkownika.

- [x] **Step 3: Utrzymać test braku release po consume**

Przy consumeResult = false potwierdzić status 503, brak release_auth_recovery_grant i pozostawienie grantu w stanie zajętym.

- [x] **Step 4: Utrzymać test współbieżności**

Dwa wywołania passwordRequest() przez Promise.all muszą dać dokładnie jeden status 200, jeden 400, jedno updateUser i jedno consume.

- [x] **Step 5: Uruchomić test i sprawdzić diff**

~~~
node --test test/server.test.js
git diff --check
~~~

Jeżeli istniejące testy już pokrywają wymaganie, nie dodawać duplikatu; rozszerzyć tylko brakujący przypadek błędu release.

### Task 3: Uzupełnić behawioralny kontrakt pgTAP

**Files:**
- Modify: supabase/tests/database/auth_recovery_grants.test.sql.
- Read: supabase/migrations/20260807150000_reconcile_yarn_acl_and_recovery.sql.
- Read: supabase/migrations/20260812122131_add_recovery_grant_claim.sql.
- Test: npm run test:db.

**Interfaces:**
- Consumes: auth.uid() z request.jwt.claim.sub, tabela private.auth_recovery_grants i RPC recovery.
- Produces: testy metadanych, uprawnień i zachowania claim/release/consume.

- [x] **Step 1: Zachować poprawny plan testów**

Pozostawić select plan(23); tylko wtedy, gdy liczba asercji nadal wynosi 23. Po dodaniu testów zachowania zwiększyć plan do faktycznej liczby asercji; nigdy nie maskować niezgodności samą zmianą licznika.

- [x] **Step 2: Przygotować dwa testowe konta i granty**

W transakcji testowej użyć stałych UUID istniejących w lokalnych testach, np. 00000000-0000-0000-0000-000000000601 i 00000000-0000-0000-0000-000000000602, oraz wstawić granty przez set local role service_role albo bezpośredni setup testowy. JTI nie może być przechowywany w tabeli — dla JTI grant-owner-a tabela ma otrzymać wyłącznie encode(extensions.digest('grant-owner-a', 'sha256'), 'hex').

- [x] **Step 3: Sprawdzić claim właściciela**

~~~
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select is(public.claim_auth_recovery_grant('grant-owner-a'), true, 'właściciel zajmuje ważny grant');
select is(
  (select claimed_at is not null
   from private.auth_recovery_grants
   where user_id = '00000000-0000-0000-0000-000000000601'),
  true,
  'claim zapisuje claimed_at'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select is(public.claim_auth_recovery_grant('grant-owner-a'), false, 'inny użytkownik nie zajmuje grantu');
~~~

- [x] **Step 4: Sprawdzić consume bez claimu i po claimie**

Utworzyć drugi ważny grant dla użytkownika 601. Najpierw oczekiwać false z consume_auth_recovery_grant, następnie wykonać claim i oczekiwać true z consume. Po consume ponowny claim i consume muszą zwracać false.

- [x] **Step 5: Sprawdzić release i przypadki końcowe**

Sprawdzić, że release zwalnia zajęty, niezużyty grant właściciela, zwraca false dla grantu zużytego, wygasłego i należącego do innego użytkownika. Na końcu usunąć wyłącznie rekordy utworzone przez test.

- [x] **Step 6: Uruchomić lokalny test bazy po zgodzie operatora**

~~~
npm run test:db
~~~

Komenda uruchamia supabase start, resetuje lokalną bazę i wykonuje wszystkie testy pgTAP. Jeśli Docker/Supabase nie działa, zapisać pełny błąd jako blokadę weryfikacji; nie oznaczać testu jako zaliczonego.

### Task 4: Domknąć ważność release grantu recovery

**Files:**
- Modify: supabase/migrations/20260812122131_add_recovery_grant_claim.sql.
- Read: supabase/tests/database/auth_recovery_grants.test.sql.

**Interfaces:**
- Consumes: kontrakt pgTAP release oraz istniejącą funkcję atomowego recovery.
- Produces: release, który nie zwalnia grantu wygasłego, zużytego ani należącego do innego użytkownika.

- [x] **Step 1: Dodać warunek ważności do release**

W istniejącej migracji uzupełnić `release_auth_recovery_grant` o warunek
`expires_at > pg_catalog.now()`. Nie tworzyć drugiej migracji i nie zmieniać
pozostałych RPC.

- [x] **Step 2: Sprawdzić kontrakt lokalnie**

Uruchomić `node --check` dla plików, `git diff --check` oraz recenzję
motek_reviewer. Pełne pgTAP pozostaje osobnym krokiem wymagającym zgody na
reset lokalnej bazy.

### Task 5: Niezależny przegląd recovery i checkpoint lokalny

**Files:**
- Review only: server.js, test/server.test.js, supabase/tests/database/auth_recovery_grants.test.sql, supabase/migrations/20260812122131_add_recovery_grant_claim.sql.
- Stage only after approval: the four modified recovery files above.

**Interfaces:**
- Consumes: wynik testów Node, pgTAP i diff trzech plików.
- Produces: decyzję accept/reject dla pakietu recovery oraz propozycję focused commit.

- [x] **Step 1: Uruchomić pełne kontrole lokalne**

~~~
npm run check
npm run lint
npm run format:check
git diff --check
~~~

- [x] **Step 2: Zlecić recenzję motek_reviewer**

Recenzent ma sprawdzić: brak service_role w backendzie zmiany hasła, atomowość claimu, właściciela z auth.uid(), pusty search_path, dokładne granty, brak release po consume oraz czyszczenie cookies po błędzie sign-out.

- [x] **Step 3: Sprawdzić staged zakres przed commitem**

Po zgodzie użytkownika na checkpoint:

~~~
git add -- server.js test/server.test.js supabase/migrations/20260812122131_add_recovery_grant_claim.sql supabase/tests/database/auth_recovery_grants.test.sql
git diff --cached --name-status
git diff --cached --check
~~~

Oczekiwane pliki to dokładnie cztery ścieżki; jeśli pojawi się inny plik, zatrzymać staging.

- [x] **Step 4: Utworzyć checkpoint recovery**

Proponowany komunikat:

~~~
fix: harden atomic password recovery
~~~

Commit `3e3712e` został utworzony po osobnej zgodzie użytkownika. Nie wykonano pushu.

### Task 6: Wybrać czystą linię release candidate

**Files:**
- Read: historia agent/staging-security-merge, origin/agent/staging-security-merge, origin/staging, origin/main.
- Create branch/worktree only after scope approval: release/motek-recovery-rc.
- No automatic inclusion: Designs/, AUDYT_*, tools/, old plans/specs.

**Interfaces:**
- Consumes: zaakceptowany recovery checkpoint i decyzję o pięciu lokalnych commitach.
- Produces: jedna gałąź candidate z jednoznacznym SHA i czystym working tree.

- [x] **Step 1: Porównać pięć lokalnych commitów**

~~~
git log --oneline origin/agent/staging-security-merge..agent/staging-security-merge
git diff --stat origin/agent/staging-security-merge...agent/staging-security-merge
~~~

Zaklasyfikować każdy commit jako candidate, history-only albo requires-review. Nie wykonywać cherry-pick bez tej klasyfikacji.

- [x] **Step 2: Wybrać bazę bez przepisywania historii**

Wybrać SHA, który zawiera zaakceptowane poprawki aplikacji i ma znany stan migracji. Nie używać git reset --hard ani force push. Po zapisaniu decyzji ustawić zmienną PowerShell $candidateBase na wybrany SHA i utworzyć osobny worktree:

~~~
git worktree add D:\Projekty\Motek\.worktrees\motek-recovery-rc -b release/motek-recovery-rc $candidateBase
~~~

Nie ustawiać $candidateBase przed zapisaniem konkretnej decyzji w raporcie; nie zgadywać SHA.

- [x] **Step 3: Przenieść wyłącznie zatwierdzone commity**

W candidate worktree ustawić zmienną PowerShell $candidateCommit na jeden z commitów oznaczonych jako candidate i wykonać git cherry-pick $candidateCommit, zatrzymując się przy konflikcie. Nie przenosić całej gałęzi stagingowej mechanicznie.

- [x] **Step 4: Potwierdzić czystość i wersję**

~~~
git status --short --branch
git log --oneline --decorate -12
node --check server.js
~~~

Working tree candidate pozostaje czysty poza niezależnym, niezmienianym artefaktem `data/pattern-content-audit.json`; wersja candidate to `2.0.0-alpha.39`.

- [x] **Step 5: Bramka GitHub**

Przed push przedstawić użytkownikowi: branch, bazę, listę commitów, SHA kandydata, listę plików i wpływ na staging/produkcję. Push bez --force wykonywać dopiero po osobnej zgodzie.

### Task 6A: Odtworzyć utwardzenie recovery na linii RC — zakończone lokalnie

**Files:**
- Modify: `server.js` tylko w zakresie recovery z checkpointu `3e3712e`.
- Modify: `test/server.test.js` tylko w zakresie odpowiadających testów recovery.
- Modify: `supabase/tests/database/auth_recovery_grants.test.sql` do wersji plan 48, z fixture istniejących i wygasłych grantów.
- Create: nowa sekwencyjna migracja `supabase/migrations/20260813100000_harden_recovery_grant_release.sql`.
- Do not modify: zastosowane migracje `20260806123000`, `20260807150000`, `20260812122131`.

**Interfaces:**
- Consumes: baza RC `301469d`, logiczny zakres checkpointu `3e3712e` oraz raporty Task 6.
- Produces: minimalny, testowalny pakiet recovery na linii stagingowej bez edycji historii migracji.

- [x] **Step 1: Przenieść testy i zachowania recovery TDD**

Najpierw przenieść testy cookie, błędu claim/release, statusu zwykłej sesji i
kontraktu pgTAP, uruchomić czerwone testy, a dopiero potem minimalny kod
produkcyjny. Nie przenosić zmian niezwiązanych z recovery.

- [x] **Step 2: Dodać migrację sekwencyjną**

Nowa migracja ma zastąpić historyczne edytowanie starej migracji: odtworzyć
`release_auth_recovery_grant(text)` z dodatkowym `expires_at > now()`, pustym
`search_path`, zachowanym `auth.uid()`, hashem JTI i jawnym revoke/grant.

- [x] **Step 3: Wykonać lokalne testy i recenzję**

Uruchomić `node --test test/server.test.js`, `npm run check`, `npm run lint`,
`git diff --check` oraz po osobnej zgodzie na reset lokalnej bazy `npm run
test:db`. Reset migracji i pełny pgTAP RC zakończone PASS; nie wykonywać
pushu, deployu ani zdalnych migracji.

### Task 7: Ujednolicić dowód release i raporty

**Files:**
- Modify: docs/operations/staging-status-2026-08-07.md.
- Modify: docs/operations/legal-readiness-status-2026-08-11.md.
- Modify: README.md and SPEC.md only where the canonical candidate/version status is documented.
- Modify: docs/superpowers/plans/2026-08-11-production-readiness-three-tracks.md.

**Interfaces:**
- Consumes: candidate SHA, wynik CI, wynik migracji i regresji stagingu.
- Produces: jeden kanoniczny opis bieżącego kandydata; historyczne SHA pozostają wyraźnie oznaczone jako historyczne.

- [x] **Step 1: Zdefiniować jeden rekord kandydata**

W raporcie zapisać dokładnie: branch, pełny SHA, wersję, datę, listę migracji, wynik CI, wynik pgTAP, wynik healthchecków, wynik regression:full i informację, czy produkcja została nietknięta.

- [x] **Step 2: Oznaczyć stare snapshoty**

Każdy wpis 62d0b84e, f118c84, 301469d, c4b777a, c7b4639 i inne historyczne SHA opisać rolą i datą. Nie pozostawiać kilku sekcji sugerujących, że są bieżącym candidate.

- [x] **Step 3: Sprawdzić dokumentację**

~~~
git diff --check
rg -n "62d0b84|f118c84|301469d|c4b777a|c7b4639|alpha\\.40" README.md SPEC.md docs
~~~

- [x] **Step 4: Zlecić przegląd dokumentacji**

motek_reviewer ma odrzucić dokumenty, jeśli wskazują więcej niż jeden bieżący candidate albo sugerują, że staging/produkcja są zsynchronizowane bez dowodu.

### Task 8: Zweryfikować candidate na stagingu

**Files:**
- Read: railway.json, deploy/railway/Dockerfile, .github/workflows/ci.yml, .github/workflows/post-deploy-regression.yml.
- Read: docs/operations/post-deploy-regression.md.
- External state: staging Supabase, Railway staging, https://staging.rysia.org only after approval.

**Interfaces:**
- Consumes: jeden candidate SHA i uporządkowany zestaw migracji.
- Produces: zewnętrzny dowód, że staging działa na dokładnie tym SHA.

- [x] **Step 1: Wykonać lokalne kontrole kandydata**

~~~
npm run check
npm run lint
npm run format:check
npm run staging:check
npm run railway:check
~~~

- [x] **Step 2: Zastosować migracje tylko na kontrolowanym stagingu**

Po osobnej zgodzie operatora zastosować kolejność migracji z repozytorium. Recovery migration 20260812122131_add_recovery_grant_claim.sql ma być zastosowana dokładnie raz; potwierdzić zdalny numer migracji i treść.

- [x] **Step 3: Wdrożyć candidate na staging**

Po zgodzie operatora uruchomić workflow/deploy skonfigurowany dla branchu staging. Nie wdrażać produkcji i nie używać sekretów produkcyjnych.

- [x] **Step 4: Potwierdzić healthchecki i SHA**

Sprawdzić /health/live, /health/ready i /health/release. Wymagać HTTP 200, właściwego środowiska i pełnego SHA kandydata.

- [x] **Step 5: Uruchomić pełną regresję stagingu**

~~~
npm run regression:full
~~~

Regresja ma obejmować Auth, akceptację dokumentów, magazyn, ETag/If-Match, katalog, dopasowania, logout i bezpieczny cleanup dokładnie utworzonego rekordu QA.

- [x] **Step 6: Bramka staging**

Staging przeszedł bramkę na SHA `e691af891758ebc17f6d4683dbca5d997f65dbe5`; produkcja pozostała nietknięta.

### Task 9: Domknąć legal-readiness

**Files:**
- Modify: data/legal-data-providers.json only after receiving operator evidence.
- Modify: legal-document.js only with values matching the verified manifest.
- Modify: docs/operations/legal-readiness-status-2026-08-11.md.
- Test: test/legal-publication-policy.test.js, test/legal-readiness.test.js, npm run legal:check.

**Interfaces:**
- Consumes: datowane dowody Supabase, Railway i Cloudflare.
- Produces: spójny manifest oraz publiczny dokument prawny; bramka LEGAL_PUBLICATION=ready albo jawny, niezamaskowany not ready.

- [ ] **Step 1: Zebrać dowody Supabase**

Potwierdzić projekt produkcyjny, region, plan, zakres danych, retencję logów i kopii, usuwanie danych, transfery, DPA i subprocesorów. Nie wpisywać wartości wynikających tylko z ogólnej dokumentacji dostawcy.

- [ ] **Step 2: Zebrać dowody Railway**

Potwierdzić środowisko produkcyjne, region sfo, zakres przetwarzania logów, retencję, transfery, DPA i subprocesorów.

- [ ] **Step 3: Zebrać dowody Cloudflare**

Potwierdzić osobno dla edge i turnstile: plan, lokalizację, transfery, retencję, role, DPA, subprocesorów i zakres dowodu HTTPS.

- [ ] **Step 4: Uzupełnić manifest bez placeholderów**

Każdy wpis ma mieć status verified, verifiedAt, produkcyjny environment, nieplaceholderowe location, transfer, retention, niepusty evidence i poprawny evidenceScope. Cloudflare musi mieć kompletne serviceEvidence.edge i serviceEvidence.turnstile.

- [ ] **Step 5: Zgodność dokumentu i bramki**

~~~
npm run legal:check
node --test test/legal-publication-policy.test.js test/legal-readiness.test.js
~~~

Jeśli bramka nadal zwraca not ready, pozostawić ją fail-closed i wskazać konkretny brak; nie zmieniać walidatora, aby przepuścić niepotwierdzone dane.

### Task 10: Przygotować decyzję produkcyjną bez wykonywania zmian

**Files:**
- Read: supabase/migrations/*.sql, docs/operations/post-deploy-regression.md.
- Create/Modify only after review: release decision report in docs/operations/.
- External state: production Supabase, Railway and Cloudflare, read-only first.

**Interfaces:**
- Consumes: zielony staging candidate i dowody legal-readiness.
- Produces: runbook decyzji produkcyjnej z zakresem migracji, backupem, rollbackiem i listą testów.

- [ ] **Step 1: Porównać historię migracji produkcji**

Odczytowo ustalić ostatnią zastosowaną migrację produkcji i różnicę względem candidate. Nie uruchamiać supabase db push na produkcji.

- [ ] **Step 2: Rozstrzygnąć RPC i Security Advisor**

Dla czterech RPC SECURITY DEFINER zapisać oczekiwane granty, rzeczywisty stan produkcji i wynik przeglądu. Nie wykonywać automatycznego revoke/grant bez osobnej decyzji.

- [ ] **Step 3: Przygotować backup i rollback**

Opisać kolejność backupu, migracji addytywnych, testu, rollbacku aplikacji i ewentualnej procedury naprawczej bazy. Zaznaczyć, że rollback Railway nie cofa migracji Supabase.

- [ ] **Step 4: Potwierdzić Railway i Cloudflare**

Operator ma dostarczyć dowody branchu main, domeny www.rysia.org, /health/ready, proxy DNS, TLS Full (strict), WAF, rate limitingu, braku cache API/Auth, prywatności /internal/metrics i ochrony originu.

- [ ] **Step 5: Uzyskać decyzję GO/NO-GO**

Przedstawić użytkownikowi dokładny SHA, migracje, ryzyko, komendy/akcje i plan rollbacku. Brak któregokolwiek dowodu oznacza NO-GO.

### Task 11: Wykonać produkcję wyłącznie po osobnej zgodzie

**Files:**
- External state: production Supabase, Railway production, Cloudflare production.
- Read/update: docs/operations/ after completion.

**Interfaces:**
- Consumes: zatwierdzony GO, ten sam candidate SHA, backup i rollback plan.
- Produces: zweryfikowany deployment produkcyjny albo zatrzymanie z zachowanym stanem diagnostycznym.

- [ ] **Step 1: Uzyskać wysokiego ryzyka zgodę na migrację i deploy**

Zgoda musi obejmować konkretny SHA, listę migracji, środowisko, ryzyko i sposób wycofania. Nie traktować wcześniejszej zgody na lokalny commit jako zgody na produkcję.

- [ ] **Step 2: Zastosować migracje produkcyjne**

Wykonać tylko zatwierdzony, addytywny zestaw migracji. Po każdym kroku sprawdzić wynik i zatrzymać się przy błędzie.

- [ ] **Step 3: Wdrożyć dokładny SHA na Railway**

Wdrożyć ręcznie produkcję zgodnie z runbookiem. Nie zmieniać branchu ani nie używać force.

- [ ] **Step 4: Wykonać smoke test**

Sprawdzić healthchecki, publiczną stronę prawną, logowanie stałego QA, odczyt magazynu, dokładnie jeden niedestrukcyjny zapis/edycję/usunięcie włóczki i logout. Nie uruchamiać pełnej regresji na produkcji.

- [ ] **Step 5: Zarchiwizować wynik**

Zapisać SHA, wersję, wynik migracji, healthchecków, smoke testu i ewentualne problemy. Nie zapisywać sekretów, cookies ani haseł.

### Task 12: Wrócić do rozwoju produktu po zamknięciu bram release

**Files:**
- Read/Modify later: data/patterns-import.json, data/pattern-manual-overrides.json, matching-policy.js, server/matching-service.js, docs/PATTERN-CATALOG.md.
- Read later: Designs/implementation_qa.md, docs/UX-UI-ROADMAP.md.

**Interfaces:**
- Consumes: stabilny release i aktualny katalog.
- Produces: kolejne zweryfikowane warianty dopasowania, benchmark rankingu i osobny pakiet wizualnej QA.

- [ ] **Step 1: Wybrać kolejne wzory**

Wybrać wzory z kompletnym źródłem danych i uzupełniać wyłącznie potwierdzone metry/gramy, role, materiały, kolory i alternatywy.

- [ ] **Step 2: Przejść kontrolę danych bez importu**

~~~
npm run patterns:check
~~~

Import wykonawczy pozostawić poza tym planem i wymagać osobnej zgody.

- [ ] **Step 3: Przygotować benchmark rankingu**

Zmierz czas odpowiedzi, pamięć i liczbę odwiedzonych węzłów dla magazynu 500 włóczek, katalogu 300 wzorów i maksymalnego limitu wariantów. Worker/queue pozostawić odłożone, jeśli pomiar nie pokaże realnego problemu.

- [ ] **Step 4: Wykonać osobną wizualną QA**

Uruchomić aplikację lokalnie, porównać cztery widoki w obu motywach z materiałami Designs/, sprawdzić mobile i klawiaturę oraz zapisać wyniki w osobnym pakiecie. Nie mieszać tego z release/security checkpointem.

## Final verification

Przed uznaniem lokalnego pakietu recovery za gotowy:

~~~
node --test test/server.test.js
npm run check
npm run lint
npm run format:check
git diff --check
git status --short --branch
~~~

Przed stagingiem:

~~~
npm run test:db
npm run staging:check
npm run railway:check
~~~

Po wdrożeniu stagingu:

~~~
npm run regression:full
~~~

npm run legal:check może pozostawać not ready do czasu zebrania dowodów. Tego wyniku nie wolno obchodzić zmianą walidatora.

## Handoff — pauza 2026-08-12

- Pakiet recovery RC jest zakończony i zweryfikowany bez commita: Node 35/35, pełny check 388/388, lint OK, lokalny Supabase 287/287.
- Ostatni worktree: `D:\Projekty\Motek\.worktrees\motek-next-changes` na branchu `codex/motek-next-changes`.
- Working tree zawiera tylko niezależną zmianę `data/pattern-content-audit.json`; nie należy jej dodawać do recovery.
- Kod candidate został wysłany do `origin/staging` na dokładnym SHA `e691af8`; commit dokumentacyjny `a1d72f8` został wysłany wyłącznie na `release/motek-recovery-rc`. Produkcja nie była publikowana ani zmieniana.
- Następny krok: zebrać datowane dowody legal-readiness dla Supabase, Railway i Cloudflare; `npm run legal:check` pozostaje `LEGAL_PUBLICATION=not ready`. `data/pattern-content-audit.json` pozostaje poza zakresem.
- Przygotowano formularz zbierania dowodów w
  `docs/operations/legal-evidence-request-2026-08-13.md`; manifest dostawców
  pozostaje niezmieniony, dopóki operator nie dostarczy i nie zatwierdzi danych.
- Odczyt techniczny potwierdził, że produkcyjny Supabase kończy się na
  `20260807114728`, a staging ma dodatkowo migracje prawne i recovery do
  `20260813103831`; nie wykonano migracji produkcyjnej.
- Odczyt RPC potwierdził P1: produkcja ma starszy kontrakt recovery bez nowych
  funkcji claim/release/consume. Uprawnienia RPC włóczek są takie same jak na
  stagingu i pozostają osobnym ostrzeżeniem Security Advisor. Nie wykonywać
  ręcznych grantów ani migracji poza osobnym, zatwierdzonym oknem produkcyjnym.
- Dalsze bramki: uzupełnienie manifestu prawnego, osobny odczyt i porównanie produkcyjnych migracji/RPC, decyzja GO/NO-GO oraz dopiero potem osobna zgoda wysokiego ryzyka na produkcję. Produkcja pozostaje NO-GO.
- Operacje zewnętrzne i produkcyjne wymagają osobnych zgód zgodnie z `AGENTS.override.md`.

## Handoff — 2026-08-14

- RC HEAD pozostaje `6a479077e6891d65f7a3841683138f80a09519cf`; branch lokalny i `origin/release/motek-recovery-rc` są zsynchronizowane.
- Test wydajności magazynu nie zmienił się od stagingowego SHA `e691af8`; trzy uruchomienia izolowane przeszły, ale pełny `npm run check` ponownie wykazał pojedynczy pomiar ponad limitem (`250.5 ms` przy limicie `250 ms`). Traktować jako blokadę jakości/flake do potwierdzenia logiem CI, bez zmiany testu lub kodu recovery.
- `npm run lint` i `git diff --check` przeszły. `format:check` przechodzi po LF, natomiast lokalny Windows przywraca CRLF; cztery pliki konfiguracji nie mają treściowego diffu i nie zostały dodane do RC.
- W RC pozostaje wyłącznie niezależna, niezatwierdzona zmiana `data/pattern-content-audit.json`; nie dodawać jej do checkpointu recovery.
- Produkcja nadal `NO-GO`: nie wykonano migracji, deployu ani smoke testu. Następny bezpieczny krok to uzyskać log CI/re-run dla testu wydajności, a potem osobno ocenić pakiet promocji i ewentualnie przygotować propozycję checkpointu.
- Dodatkowe kontrole RC: `npm run staging:check` 17/17, `npm run railway:check` 3/3, `npm audit --omit=dev --audit-level=moderate` 0 podatności. `npm run test:db` przekroczył 5 minut, ponieważ lokalny Docker działał pod innym projektem (`code-audit-remediation`); proces testowy zakończono, bez usuwania kontenerów. W tej próbie pgTAP nie ma nowego wyniku — obowiązuje wcześniejsze potwierdzenie 8 plików / 287 testów.
- Po uzupełnieniu lokalnych devDependencies i uruchomieniu CLI bez resetu bazy pgTAP ponownie przeszedł: 8 plików / 287 testów. Nie powstał diff `package.json` ani `package-lock.json`; zmiana dotyczyła wyłącznie lokalnego `node_modules`. Vector pozostaje problemem pomocniczego kontenera, ale nie blokuje testów bazy. Nie dodawać warstwy obejścia do aplikacji.
- Dodatkowa recenzja potwierdziła kolizję lokalnego stacku: Docker używa konfiguracji głównego checkoutu przy tym samym `project_id`, Kong ma błędne mounty plików w `.temp/start-secrets`, a Vector restartuje się bez dostępu do Docker socketu. To wyjaśnia timeout `supabase start`; nie zmieniać przez to architektury Motka ani skryptu produkcyjnego. Weryfikację pgTAP wykonywać bez resetu tylko jako diagnostykę, a pełny reset rezerwować dla osobnego, kontrolowanego środowiska.
- W kontrolowanym środowisku RC wykonano pełny rehearsal: osobny lokalny projekt/port, tylko usługi bazy, odtworzenie pustej bazy, wszystkie migracje i pgTAP. Wynik: 8 plików / 287 testów PASS. Stack zatrzymano, konfigurację przywrócono, a worktree RC pozostał bez nowych zmian. To zamyka lokalną bramkę migracji/recovery; nie zmienia statusu produkcji `NO-GO`.
- Raport z liczbami `230/363` dotyczył głównego checkoutu z niezależną zmianą testu recovery (`plan(23)`), a nie RC. Dla RC obowiązują wyłącznie dowody z `release/motek-recovery-rc@6a47907`: `plan(48)`, `migration_replay` `plan(11)` oraz clean rehearsal `8 plików / 287 testów PASS`.
- Pakiet promocji został wyrównany do aktualnego RC docs-only HEAD `6a479077e6891d65f7a3841683138f80a09519cf`; dowody stagingu nadal dotyczą wyłącznie wdrożonego `e691af891758ebc17f6d4683dbca5d997f65dbe5`. `npm run legal:check` pozostaje fail-closed z trzema niezweryfikowanymi dostawcami.

## Handoff — decyzja P1 RPC, 2026-08-14

- Candidate recovery ma kompletny łańcuch migracji `20260806123000`,
  `20260812122131` i `20260813100000`; lokalny replay oraz pgTAP RC potwierdzają
  8 plików / 287 testów.
- Nie dodawać kolejnej migracji, RPC ani ręcznych grantów. Różnicę Production–
  Staging zamykać wyłącznie przez zatwierdzone zastosowanie całego łańcucha w
  kolejności na produkcji.
- Nadal nie są zamknięte: pełna zgodność historii migracji, legal-readiness/
  Cloudflare oraz osobne zgody na migrację i deploy. Backup/restore wymaga
  utrzymania procedury z użyciem zgodnego stacku Supabase, a nie surowego
  PostgreSQL.
- Produkcja pozostaje `NO-GO`; następny krok wymagający decyzji operatora to
  osobne okno backupu danych produkcyjnych i odtworzenia na izolowanym celu.

## Handoff — runbook okna produkcyjnego, 2026-08-14

- Pakiet promocji zawiera siedem etapów z dowodem i punktem zatrzymania po
  każdym etapie: preflight, backup, restore, replay/RPC, legal/infrastruktura,
  osobne zgody, migracja oraz deploy/obserwacja.
- Dla tego pakietu docelowym SHA aplikacji pozostaje stagingowo zweryfikowany
  `e691af891758ebc17f6d4683dbca5d997f65dbe5`. Dokumentacyjny RC
  `6a479077e6891d65f7a3841683138f80a09519cf` nie jest dowodem wdrożenia.
- Produkcja nadal `NO-GO`; backup danych, restore, legal-readiness i osobne
  zgody pozostają niewykonanymi bramkami.

## Handoff — GitHub CI, 2026-08-14

- PR `#49` jest scalony do `staging` na SHA
  `e691af891758ebc17f6d4683dbca5d997f65dbe5`.
- GitHub CI `test` i `database`, post-deploy `regression` oraz Railway staging
  zakończyły się powodzeniem.
- Lokalny pomiar wydajności `250.5 ms` nie został powtórzony w CI; nie zmieniać
  testu ani kodu bez nowego, powtarzalnego dowodu.
- Produkcja nadal `NO-GO` z powodu legal-readiness, Cloudflare i osobnych zgód
  operacyjnych; backup/restore jest zamknięty tylko dla kontrolowanego celu
  zgodnego z Supabase.

## Handoff — odczyt Cloudflare, 2026-08-14

- Bezpośredni odczyt panelu Cloudflare wykonano tylko do odczytu. Rekordy DNS
  `rysia.org` i `www.rysia.org` są proxied do Railway, a
  `staging.rysia.org` pozostaje DNS-only i wskazuje osobny target stagingowy.
- Widget Turnstile produkcji ma w ostatnich 24 godzinach 167 wydanych wyzwań,
  96 rozwiązanych oraz 5 żądań Siteverify: 5 poprawnych i 0 niepoprawnych.
  To potwierdza bieżącą ścieżkę techniczną, ale nie jest dowodem lokalizacji,
  transferów, retencji, DPA ani listy podprocesorów.
- Universal SSL jest aktywny, TLS 1.3 i Automatic HTTPS Rewrites są włączone.
  Odczyt wykazał wyłączone Always Use HTTPS, nieaktywne HSTS oraz domyślne
  minimum TLS 1.0. Reguł custom, rate limiting ani managed WAF nie ma.
- Nie zmieniano ustawień Cloudflare. Są to osobne decyzje bezpieczeństwa i
  produktu, wymagające oceny oraz osobnej zgody przed zapisem zewnętrznym.

## Handoff — ocena bram HTTPS/TLS/WAF, 2026-08-14

- Analiza kodu i runbooka potwierdziła, że produkcja uruchamia bezpośrednio
  Node.js, a konfiguracja Nginx/ModSecurity dotyczy wyłącznie stagingu.
  Aplikacja wymaga produkcyjnie dokładnego `APP_ORIGIN` HTTPS,
  `COOKIE_SECURE=true` i `TRUST_PROXY=true`; kontrola CSRF porównuje Origin z
  `APP_ORIGIN`.
- Odczyt Cloudflare nie dowodzi jeszcze TLS `Full (strict)`, poprawnych
  redirectów dla wszystkich metod, braku cache ani ukrycia originu Railway.
  Te punkty pozostają bramką przed zmianami.
- Always Use HTTPS może zmienić zachowanie klientów API przy redirectach metod
  mutujących. HSTS ma ryzyko trwałego cache przeglądarek, a podniesienie
  minimum TLS może odciąć starsze klienty i monitoring. WAF/rate limiting mogą
  blokować poprawny Auth, Turnstile i JSON; managed WAF nie jest dostępny w
  obecnym planie.
- Następny krok to zebranie macierzy testów i decyzji operatora. Nie włączać
  HSTS, Always Use HTTPS, wyższego minimum TLS, WAF ani rate limitingu bez
  osobnej zgody na zmianę zewnętrzną. Produkcja pozostaje `NO-GO`.

## Handoff — dokumentacja dostawców, 2026-08-14

- Oficjalna dokumentacja Supabase potwierdza, że na planie Free własny eksport
  jest wymagany jako praktyczna ścieżka backupu; schema-only rehearsal nie
  zamyka bramki danych.
- Railway dokumentuje 7 dni retencji logów dla Hobby/Trial oraz wskazuje w DPA
  podstawowe przetwarzanie w USA i listę subprocesorów w Trust Center.
- Cloudflare wskazuje, że lokalizacja metadanych i przetwarzania wymaga
  Data Localization Suite (Enterprise). Turnstile ma odrębne role procesora i
  administratora danych przy ulepszaniu detekcji.
- Te informacje uzupełniają dowody i ryzyka, ale nie są potwierdzeniem
  akceptacji DPA ani konfiguracji konkretnego konta. Manifest pozostaje
  `unverified`, `LEGAL_PUBLICATION=not ready`, produkcja `NO-GO`.
- Manifest dostawców pozostaje `unverified`, `LEGAL_PUBLICATION=not ready`, a
  produkcja pozostaje `NO-GO` do czasu zamknięcia pełnego zakresu prawnego,
  backupu/restore i pozostałych bramek operacyjnych.

## Handoff — kolejność decyzji Cloudflare, 2026-08-14

- Odczyt Cloudflare był wyłącznie odczytem: DNS produkcji jest proxied,
  staging pozostaje DNS-only; Always Use HTTPS i HSTS są wyłączone, minimum TLS
  to 1.0, a reguł custom WAF, rate limiting ani managed WAF nie ma.
- Lokalne przekierowanie HTTPS w aplikacji/Nginx nie dowodzi konfiguracji
  Cloudflare ani ukrycia originu Railway.
- Najpierw trzeba potwierdzić `Full (strict)`, przekierowania HTTP→HTTPS dla
  wszystkich domen, brak cache API/Auth, test bezpośredniego originu oraz
  kompatybilność TLS. Dopiero potem można osobno zatwierdzić zmiany Cloudflare.
- HSTS niesie ryzyko utrwalenia wymuszonego HTTPS w cache przeglądarek. TLS 1.2
  wymaga decyzji kompatybilności, a WAF/rate limiting na obecnym planie wymaga
  decyzji kosztowo-produktowej.
- Nie zmieniano ustawień zewnętrznych; produkcja pozostaje `NO-GO` do czasu
  uzyskania wymaganych dowodów i osobnych zgód.

## Handoff — przygotowanie pełnego backupu danych, 2026-08-14

- Obecny rehearsal potwierdza tylko odtworzenie schematów `public` i `private`.
  Pełny pakiet musi osobno objąć wiersze danych, Auth users/identities oraz
  obiekty i metadane Storage; sam dump bazy nie wystarcza.
- Przed eksportem trzeba uzyskać zgodę wysokiego ryzyka, ustalić szyfrowany cel
  poza repozytorium, zakres danych i politykę usunięcia kopii. W logach wolno
  zapisywać tylko zakres, rozmiar, czas i hash, nigdy dane ani sekrety.
- Restore ma trafić wyłącznie do świeżego, izolowanego celu. Niezgodność
  zakresu, hashy, liczności, Auth/Storage lub próba połączenia z produkcją jest
  natychmiastowym stopem.
- Pakiet został przygotowany dokumentacyjnie; wykonanie backupu nastąpiło w
  kolejnym handoffie poniżej. Na tym etapie produkcja pozostawała `NO-GO`.

## Handoff — wynik okna backup/restore, 2026-08-14

- Za zgodą operatora wykonano eksport danych produkcyjnego Supabase bez zapisu
  do produkcji. Odczyt wykazał 2 użytkowników Auth i brak obiektów Storage.
- Dane `public/private` odtworzono w izolowanym PostgreSQL z pełną zgodnością
  liczności i obiektów. Auth schema/data zostały wyeksportowane, ale pełne
  odtworzenie zarządzanego schematu Auth zatrzymało się na niezgodności
  `auth.users.is_sso_user` z surowym celem.
- Nie wykonano ręcznego obejścia, restore produkcyjnego, migracji ani deployu.
  Artefakt Auth nie jest dowodem pełnego recovery; bramka backup/restore nadal
  pozostaje otwarta, produkcja `NO-GO`.

## Handoff — korekta bramki runbooka, 2026-08-14

- Kanoniczny runbook został uzupełniony o obowiązkową kolejność preflight →
  pełny backup danych → izolowany restore → replay migracji/RPC → legal/
  infrastruktura → osobne zgody → migracja/deploy/obserwacja.
- Brak pełnego backupu, zielonego restore rehearsal, zgodności danych,
  legal-readiness lub wymaganej zgody jest jednoznacznym `NO-GO`.
- Schema-only rehearsal nie jest już traktowany jako spełnienie bramki danych;
  produkcja pozostaje nietknięta.

## Handoff — zgodny restore Auth, 2026-08-14

- Świeży, izolowany stack Supabase z GoTrue przyjął eksport Auth bez błędu;
  zweryfikowano 2 użytkowników, 1 identity, 52 sesje, hashe haseł oraz
  obecność `auth.users.is_sso_user`.
- Zdrowie Auth zwróciło HTTP 200, a syntetyczna rejestracja, logowanie i
  recovery zakończyły się sukcesem. Konto testowe, kontener, wolumeny i plik
  eksportu zostały usunięte.
- Wcześniejszy błąd wynikał z niewłaściwego celu — surowego PostgreSQL — i nie
  uzasadnia ręcznego dopasowywania schematu. Produkcja nie była zapisywana;
  status pozostaje `NO-GO` do zamknięcia legal/infrastruktury i osobnych zgód.

## Handoff — blokada reconciliation migracji, 2026-08-14

- Odczytowy `list_migrations` stagingu zwrócił 27 wpisów do
  `20260813103831_harden_recovery_grant_release`; lokalny RC ma inną numerację
  oraz nie ma plików 1:1 dla trzech wcześniejszych nazw migracji związanych z
  atomowym magazynem włóczek.
- Kandydackie mapowania recovery to staging `20260812135011` → lokalny plik
  `20260812122131_add_recovery_grant_claim.sql` oraz staging `20260813103831`
  → lokalny `20260813100000_harden_recovery_grant_release.sql`, ale sama nazwa
  nie dowodzi zgodności treści.
- Replay nie został uruchomiony jako dowód promocji. Najpierw trzeba uzgodnić
  mapę `remote version/name → local file → content hash → schema effect`;
  produkcja pozostaje `NO-GO`.

GitHub `staging` zawiera aktualne pliki claim/release, a ich Git blob SHA-1
odpowiada `f8507e3dc725fffc5db06365fab188b47fc535c0` oraz
`8e0405de10e7ee300873a6271bbc86ee05a93f1f`. To potwierdza źródło candidate,
ale nie zamyka rozbieżności starszych wpisów w zdalnym ledgerze.

## Handoff — staging jako źródło prawdy i replay lokalny, 2026-08-14

- Na decyzję operatora branch GitHub `staging` jest kanonicznym źródłem plików
  migracji dla dalszych prac. Zdalny ledger stagingu traktujemy jako historię
  środowiska, a nie jako listę plików wejściowych do lokalnego replayu.
- W świeżym, tymczasowym stacku Supabase odtworzono od pustej bazy wszystkie
  30 migracji z tego źródła. `migration list` wykazał 30/30 zgodnych wersji.
- Testy pgTAP przeszły: 8 plików, 287 testów. Kontrola recovery potwierdziła
  `SECURITY DEFINER`, pusty `search_path`, brak EXECUTE dla `anon`, właściwe
  granty dla `authenticated`/`service_role` oraz brak odczytu tabeli prywatnej
  przez role API.
- Tymczasowy stack, kontenery i katalog replayu usunięto. Nie wykonano zapisu
  na stagingu ani produkcji. Produkcja pozostaje `NO-GO` przez legal/infrastrukturę
  i brak osobnych zgód operacyjnych.

## Handoff — dowód zgodności źródła replayu z `origin/staging`, 2026-08-14

- `origin/staging` wskazuje na `e691af891758ebc17f6d4683dbca5d997f65dbe5`
  (`e691af8`) i zawiera dokładnie 30 plików migracji.
- Porównanie treści `origin/staging` z `release/motek-recovery-rc` dla
  `supabase/migrations` oraz `supabase/tests/database` nie wykazało różnic.
- Wniosek: replay uruchomiony w izolowanym stacku z RC był treściowo replayem
  kanonicznego źródła `staging` dla zakresu migracji i testów. Główny checkout
  `agent/staging-security-merge` pozostaje brudnym środowiskiem roboczym i nie
  jest podstawą tego dowodu.
- Nie zapisano surowego logu CLI jako artefaktu; odtworzenie wyniku opiera się na
  zamrożonym SHA, liście plików, czystym porównaniu treści i zapisanych liczbach
  `30/30` oraz `8/287`. Produkcja pozostaje `NO-GO`.

## Handoff — wybrany artefakt i bramka legal/infrastructure, 2026-08-14

- Wybranym artefaktem kandydującym pozostaje wyłącznie
  `origin/staging@e691af891758ebc17f6d4683dbca5d997f65dbe5`. Bieżący checkout
  `agent/staging-security-merge` jest brudnym środowiskiem roboczym i nie może
  być promowany na podstawie replayu stagingu.
- `npm run legal:check` wykonano lokalnie: wynik `LEGAL_PUBLICATION=not ready`,
  kod 1. Supabase, Railway i Cloudflare pozostają `unverified`; brakuje
  kompletnego pakietu transferów, retencji, lokalizacji, DPA i subprocesorów.
- Przed produkcją pozostają do zamknięcia: dowody HTTPS/Full (strict), ochrona
  originu Railway, decyzja WAF/rate limiting/HSTS, monitoring i odbiorca alertów,
  zatwierdzona kolejność migracji z rollbackiem oraz osobne zgody na migrację,
  deploy i obserwację.
- Nie wykonano zmian kodu, migracji zdalnych, deployu ani zmian dostawców.
  Produkcja pozostaje `NO-GO`.

## Handoff — aktualna macierz Production ↔ Staging RPC, 2026-08-14

Odczyt Supabase wykonany ponownie, bez zapisu, potwierdził:

| Zakres | Production | Staging |
|---|---|---|
| Ledger | 23 migracje, koniec `20260807114728_document_recovery_grants_no_client_policy` | 27 wpisów, koniec `20260813103831_harden_recovery_grant_release` |
| `create_auth_recovery_grant` | `(uuid,text,timestamptz)`, EXECUTE tylko `service_role` | ten sam wariant oraz `()` dla `authenticated` |
| `claim_auth_recovery_grant` | brak | `(text)`, EXECUTE `authenticated` |
| `release_auth_recovery_grant` | brak | `(text)`, EXECUTE `authenticated` |
| `consume_auth_recovery_grant` | `(uuid,text)`, EXECUTE tylko `service_role` | `(text)`, EXECUTE `authenticated` oraz historyczny wariant serwisowy |
| Funkcje | `SECURITY DEFINER`, pusty `search_path` | `SECURITY DEFINER`, pusty `search_path` |
| Tabela prywatna | brak SELECT dla `anon`/`authenticated` | brak SELECT dla `anon`/`authenticated` |

Wniosek: produkcja nie ma kontraktu wymaganego przez bieżący przepływ recovery.
Różnica jest realną blokadą P1, a nie wyłącznie różnicą numeracji migracji.
Wdrożenie musi użyć pełnego, uporządkowanego pakietu migracji ze stagingu oraz
planu rollbacku; ręczny `GRANT` jest wykluczony. Produkcja pozostaje `NO-GO`.

## Handoff — operator packet recovery i model rollbacku, 2026-08-14

- Agenci potwierdzili, że pełny pakiet stagingu ma 11 migracji i nie może być
  traktowany jako zwykły `db push` z możliwością cofnięcia SQL.
- Łańcuch przejściowo obsługuje hashy JTI 43-znakowe, a następnie konwertuje je
  do 64-znakowego SHA-256 hex. Aplikacji nie wolno udostępnić pomiędzy migracją
  `20260807150000`/`20260812122131` a `20260813100000`.
- Migracja `20260807150000` dotyka jednocześnie recovery, ACL i liczników włóczek;
  migracje prawne zapisują zaproszenia i akceptacje. `DROP ... CASCADE` oraz
  zmiany danych wykluczają bezpieczny „down migration”.
- Runbook został uzupełniony o preflight backup/restore, postflight RPC/RLS/ACL,
  twarde warunki stopu oraz model: rollback tylko kompatybilnej aplikacji,
  naprawa forward albo restore po osobnej zgodzie.
- Produkcja pozostaje `NO-GO`; nie wykonano migracji ani zmian zewnętrznych.

## Handoff — Supabase Advisors i decyzja bezpieczeństwa RPC, 2026-08-14

- Production i Staging są zdrowe (`ACTIVE_HEALTHY`), w tym samym regionie
  `eu-north-1` i na PostgreSQL `17.6.1.155`.
- Production ma ostrzeżenia dla czterech RPC magazynu jako `SECURITY DEFINER`
  dostępnych `authenticated` oraz wyłączoną ochronę wyciekłych haseł.
- Staging ma te same ostrzeżenia, a także ostrzeżenia dla recovery RPC i
  `has_current_terms_acceptance`; dodatkowo Advisor informuje o RLS bez polityki
  tam, gdzie dostęp jest celowo zamknięty grantami.
- Nie zmieniamy automatycznie grantów ani trybu `SECURITY INVOKER`: RPC magazynu
  i recovery są częścią kontraktu aplikacji. Przed produkcją trzeba zatwierdzić
  intencję, właściciela ryzyka i testy uprawnień. Informacje Performance Advisor
  odkładamy do osobnego zadania optymalizacyjnego.
- Odczyt nie zmienił danych ani konfiguracji; produkcja pozostaje `NO-GO`.

## Handoff — decyzje po Advisorach, 2026-08-14

Przyjęto następujące decyzje operatora:

- `public.patterns` pozostaje dostępna tylko przez backend `service_role`, co
  upraszcza RLS i chroni rekordy ukryte/nieopublikowane;
- obecny kontrakt RPC `SECURITY DEFINER` dla `authenticated` pozostaje celowy,
  z testami uprawnień i formalnym właścicielem ryzyka;
- operator zaakceptował wyłączoną ochronę wyciekłych haseł na planie Free;
- Performance Advisor pozostaje osobnym zadaniem optymalizacyjnym.

Nie wykonujemy automatycznego `REVOKE`, zmiany RLS ani przełączenia
`SECURITY INVOKER`, ponieważ każda z tych zmian może zmienić zachowanie produktu.
Decyzje są zamknięte. Produkcja pozostaje `NO-GO` do czasu zamknięcia
pozostałych bram legal/infrastructure i osobnych zgód operacyjnych.

## Handoff — świeży odczyt Cloudflare SSL/DNS, 2026-08-14

Odczyt panelu Cloudflare dla `rysia.org` był tylko odczytowy:

- SSL/TLS działa w trybie `Full`, nie `Full (strict)`; Universal SSL jest
  aktywny do 2026-11-02 dla apexu i wildcardu;
- `Always Use HTTPS` i HSTS są wyłączone, minimalny TLS to domyślny `TLS 1.0`,
  a TLS 1.3 i Automatic HTTPS Rewrites są włączone;
- produkcyjne rekordy apex/www są proxied do Railway, staging pozostaje
  DNS-only.

Nie zmieniono ustawień Cloudflare. Do zamknięcia pozostają dowody ochrony
originu Railway, wybór minimum TLS/HTTPS/HSTS, potwierdzenie WAF/rate
limiting oraz monitoring i odbiorca alertów. Produkcja nadal `NO-GO`.

## Handoff — powtórna weryfikacja bramy jakości, 2026-08-14

- Na izolowanym checkoutcie RC pojedynczy `npm run check` zakończył się
  `387/388`; jedynym błędem było filtrowanie 500 kart w czasie `305,3 ms` przy
  limicie `250 ms`.
- Ten sam test uruchomiony samodzielnie przeszedł `3/3`, a kolejny pełny
  `npm test` przeszedł `388/388`. Wynik nie jest więc powtarzalną regresją
  funkcjonalną; pozostaje obserwacją wrażliwości testu na obciążenie wspólnego
  procesu `--test-isolation=none`.
- Nie zmieniono progu, kodu ani testu. Nie wolno używać tej obserwacji do
  sztucznego rozluźnienia jakości. Dokumentacyjne wskazania snapshotu zostały
  ujednolicone do `origin/staging@e691af8` w README i SPEC.

## Handoff — kontrola referencji i legal:check, 2026-08-14

- Historyczny SHA `62d0b84e` występuje już tylko w miejscach jawnie opisanych
  jako historyczne albo jako ostrzeżenie przed pomyleniem artefaktów; aktywny
  kandydat pozostaje `origin/staging@e691af8`.
- Ponowny `npm run legal:check` zakończył się oczekiwanym kodem 1 i wynikiem
  `LEGAL_PUBLICATION=not ready`. Supabase, Railway i Cloudflare nadal nie mają
  kompletnego, zatwierdzonego pakietu dowodowego.
- Nie wykonano zmian zewnętrznych ani operacji publikacji. Produkcja pozostaje
  `NO-GO`.

## Handoff — indeks dowodów preflight, 2026-08-14

Dodano lokalny [indeks dowodów preflight](../../operations/release-preflight-evidence-index-2026-08-14.md).
Zawiera zamrożony SHA stagingu, hashe 11 migracji recovery, wyniki replayu,
pgTAP, backup/restore i rozdzielenie faktów lokalnych od dowodów wymagających
operatora lub usług. Nie zawiera sekretów ani `verifiedAt` i nie zmienia
statusu `unverified`. Produkcja pozostaje `NO-GO`.

## Handoff — korekta indeksu po recenzji, 2026-08-14

Indeks doprecyzowano o ograniczenia dowodów: osobno opisano restore
public/private, Auth i pusty Storage; wskazano brak surowego logu CLI; rozdzielono
Cloudflare edge od Turnstile; dodano rozjazd 27 wpisów zdalnego ledgera stagingu
oraz 30 lokalnych plików; dopisano Advisor warnings, zakres `git diff --check`,
forward/restore, alerty, RLS/ACL i post-migration gates. Werdykt pozostaje
`NO-GO`; nie zmieniono usług, manifestu ani kodu.

## Handoff — Cloudflare SSL/HTTPS wykonane za zgodą, 2026-08-14

W produkcyjnej strefie `rysia.org` zapisano `Full (strict)`, minimum TLS 1.2
oraz `Always Use HTTPS`. TLS 1.3 i Automatic HTTPS Rewrites pozostały włączone;
HSTS, WAF, rate limiting, DNS, Turnstile i origin Railway nie zostały zmienione.
Panel potwierdził utrzymanie ustawień po odświeżeniu. Publiczny healthcheck nie
został oznaczony jako PASS, ponieważ kontrolowana przeglądarka zwróciła
`ERR_BLOCKED_BY_CLIENT`. Produkcja pozostaje `NO-GO` przez recovery, legal i
pozostałe dowody infrastruktury.
## Handoff — publiczna weryfikacja HTTPS po zmianie, 2026-08-14

Po zapisaniu Cloudflare wykonano odczyt publiczny: HTTP apex i `www` przekierowują
301 do HTTPS, a `GET https://www.rysia.org/health/ready` oraz wynik po apexie
kończą się `200` z `{"status":"ready"}`. Railway HTTP logs potwierdzają
deployment `551aa616-a3e9-4b85-9e98-7cf15630b6d3` bez błędów upstreamu.
Brama HTTPS/TLS/redirect/readiness jest zamknięta; produkcja pozostaje `NO-GO`
przez recovery, legal, ochronę originu, cache, WAF/rate limiting i monitoring.

## Handoff — odczyt Cloudflare rules/cache, 2026-08-14

Panel potwierdził `0/5` custom rules, `0/1` rate limiting rules, brak
aktywnych managed rules na planie Free oraz `0 active` Cache Rules i Cache
Response Rules. To zamyka inwentaryzację, ale nie daje ochrony ani dowodu
bezpośredniego originu/cache API/Auth. Nie zmieniono reguł; WAF/rate limiting,
origin, cache i monitoring pozostają otwarte.

## Handoff — częściowy odczyt origin/cache, 2026-08-14

Techniczny adres Railway zwraca fallback `404 Application not found`, a nie
aplikację. Publiczny `/api/config` przez `www` zwraca `Cache-Control: no-store`
i `cf-cache-status: DYNAMIC`. To zamyka wyłącznie dowód dla tego endpointu;
nie potwierdza wszystkich API/Auth ani pełnej ochrony originu. WAF/rate
limiting, origin, cache API/Auth i monitoring pozostają otwarte.

## Handoff — macierz następnego okna origin/cache/API, 2026-08-14

Na podstawie recenzji agentów dopisano do runbooka macierz dowodów dla TLS/SNI,
redirectów metod mutujących, reprezentatywnego API, Auth, prywatnych odpowiedzi,
wszystkich znanych wariantów originu Railway, ochrony brzegowej i monitoringu.
Rozdzielono w niej `PASS` od natychmiastowego `STOP`. Fallback Railway dla
jednego hosta nie jest traktowany jako dowód ochrony originu, a `no-store` dla
`/api/config` nie jest traktowane jako dowód dla całego API/Auth.

Najbliższy bezpieczny krok pozostaje lokalny: przygotować i wypełnić tę macierz
na czystym kandydacie `origin/staging@e691af8`, a następnie zebrać wyłącznie
brakujące dowody z produkcji. Bez pełnej macierzy, legal-readiness, recovery i
osobnych zgód migracja/deploy pozostają `NO-GO`.

## Handoff — lokalne kontrole kandydata RC, 2026-08-14

Na kandydacie recovery wykonano bezpieczne kontrole lokalne: `npm run check`
przeszedł `388/388`, `npm run staging:check` `17/17`,
`npm run railway:check` `3/3`, a `npm run lint` zakończył się poprawnie.
`npm run legal:check` utrzymał fail-closed `LEGAL_PUBLICATION=not ready`,
ponieważ dostawcy nadal nie mają kompletnego zatwierdzonego pakietu dowodowego.

`format:check` zgłosił cztery pliki konfiguracyjne przez różnicę końców linii /
formatu w środowisku Windows. Nie wykonano automatycznego formatowania, aby nie
zmieniać niezwiązanych plików i nie mieszać ich do pakietu recovery. RC ma także
lokalne zmiany dokumentacyjne/danych niezwiązane z kodem recovery; dlatego
porównania migracji i testów zakresu recovery nadal opierają się na SHA oraz
jawnie wskazanym zakresie plików, nie na pełnej czystości worktree.

## Handoff — production smoke i rozjazd release, 2026-08-14

Pierwszy smoke z oczekiwanym stagingowym SHA `e691af8` wygasł, ponieważ
`/health/release` produkcji zwracał inny commit. Odczyt potwierdził aktualne
production `c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b`, wersję `2.0.0-alpha.39`
i środowisko `production`. Smoke uruchomiony dla tego faktycznie wdrożonego
SHA zatrzymał się na `GET /informacje-prawne = 404`.

Commit `c4b777a` jest przodkiem `origin/staging@e691af8`; porównanie wskazuje
późniejsze zmiany w `legal-document.js`, `server.js` i testach serwera. Wynik
nie jest podstawą do migracji ani deployu, ale zamyka ważną diagnostykę:
produkcja nie jest jeszcze zgodna z kandydatem recovery, a obecny publiczny
smoke nie przechodzi. Nie wykonywano żadnej modyfikacji danych ani usługi.

## Handoff — staging release smoke, 2026-08-14

Na `https://staging.rysia.org` `/health/release` potwierdził dokładny kandydat
`origin/staging@e691af891758ebc17f6d4683dbca5d997f65dbe5` oraz
`environment: staging`. `regression:smoke` zakończył się kodem 0. Oznacza to,
że rzeczywisty staging przechodzi publiczny smoke dla tego artefaktu.

Nie jest to pełna regresja autoryzowana, dowód zgodności produkcji, dowód
ochrony originu ani zgoda na deploy. Produkcja nadal działa na `c4b777a` i ma
404 strony prawnej; przed oknem produkcyjnym pozostają recovery, legal-readiness,
infrastruktura i osobne zgody operacyjne.

## Handoff — publiczny kontrakt prawny staging/production, 2026-08-14

Odczyt publiczny potwierdził, że stagingowy kandydat `e691af8` serwuje
`/informacje-prawne` oraz `/informacje-prawne/` z HTTP 200, HTML i nagłówkami
bezpieczeństwa. Produkcja na `c4b777a` zwraca 404 dla obu wariantów.

To jest techniczny PASS stagingu i jednocześnie FAIL bieżącej produkcji; nie
zmienia `LEGAL_PUBLICATION=not ready`. Przed deployem trzeba zachować pełny
pakiet recovery, zamknąć legal/infrastructure i uzyskać osobne zgody operacyjne.

## Handoff — GET API/cache/TLS i blokada starej produkcji, 2026-08-14

Odczyt nagłówków bez zapisu potwierdził na stagingu `e691af8`: `/api/config`
zwraca 200, a `/api/patterns`, `/api/yarns` i `/api/matches` zwracają 401;
wszystkie testowane odpowiedzi mają `Cache-Control: no-store`. Anonimowa sesja
Auth również ma `no-store`.

Produkcja na `c4b777a` ma `no-store`/`DYNAMIC`, ale `/api/patterns` zwraca
anonimowo 200 z odpowiedzią JSON. To jest naruszenie decyzji „katalog wyłącznie
przez backend” i kolejny dowód, że nie wolno traktować bieżącej produkcji jako
kandydata recovery. Nie wykonywano POST, zmian danych ani zmian usług.

Test `curl --tlsv1.2` potwierdził poprawne połączenie klient→edge dla `www`,
apexu i stagingu (`ssl_verify=0`); nie zamyka to certyfikatu originu ani
handshake’u Cloudflare→Railway.

## Handoff — finalny pakiet decyzji produkcyjnych, 2026-08-14

Dodano [pakiet decyzji promocji produkcji](../../operations/production-promotion-decision-packet-2026-08-14.md).
Dokument wiąże aktualny stan produkcji `c4b777a` z kandydatem `e691af8`, znane
błędy `/informacje-prawne` i anonimowego `/api/patterns`, warunki backupu/
restore, mapę ledgera, model forward-only, kryteria post-deploy smoke oraz
osobne zgody na backup, migrację, deploy i obserwację.

Werdykt pozostaje `NO-GO`: pakiet jest gotowy do przeglądu decyzyjnego, ale
nie stanowi zgody na wykonanie operacji.

## Handoff — pełny zdalny snapshot ledgerów Supabase, 2026-08-14

Bez zapisu odczytano oba projekty Supabase: Production
`vueotocjsgzosqzhcish` ma 23 migracje, a Staging `rprhbmtabwjsenvfgicg` ma 27;
oba są `ACTIVE_HEALTHY` w `eu-north-1`. Dodano [snapshot ledgerów](../../operations/supabase-ledger-reconciliation-2026-08-14.md)
z pełnymi wersjami i nazwami.

Odczyt zamyka stan zdalny „przed”, ale nie mapę treść/hash/efekt. Różnice
`harden_rls_auto_enable_permissions`, trzech stagingowych poprawek wersjonowania,
ACL oraz późniejszych migracji legal/recovery nadal wymagają analizy przed
jakąkolwiek migracją produkcji.

## Handoff — GitHub CI i brak exact full regression, 2026-08-14

GitHub Actions run `31692102925` dla dokładnego kandydata
`e691af891758ebc17f6d4683dbca5d997f65dbe5` zakończył się sukcesem. Joby `test`
i `database` przeszły, w tym replay migracji i testy bazy.

Istnieje także run `31692142042` dla tego samego exact SHA. Ma workflow
`Post-deploy regression`, job `regression` oraz krok `Uruchom pełną regresję
staging`, zakończony sukcesem. Zamykamy więc bramę pełnej regresji na poziomie
workflowu bez ponownego zapisu stagingu. Metadane nie są osobnym dowodem
szczegółowego cleanupu ani braku osieroconych rekordów, dlatego pozostawiamy
ten zakres jako ograniczenie dowodowe.

## Handoff — świeże blokady legacy/legal/infrastructure, 2026-08-15

Read-only `extensions.pg_stat_statements` potwierdził, że Production ma osiem
dopasowanych wywołań dotyczących wyłącznie definicji, komentarzy i grantów
legacy RPC. Staging ma czternaście dopasowanych wywołań, w tym cztery przez
PostgREST pod rolą `authenticated`; statystyka trwa co najmniej od 3 sierpnia,
ale nie wskazuje ostatniego wykonania ani konkretnego klienta. To wzmacnia
bramkę „brak zewnętrznych klientów” jako `OPEN` i wyklucza automatyczny cleanup.

Railway potwierdził read-only nazwy zmiennych: Production ma 25, Staging 23,
bez odczytu wartości sekretów. Ostatni udany deployment Production to
`c4b777a` z 2026-08-08, a Staging `e691af8` z 2026-08-13; nie ma niejawnej
promocji RC do produkcji.

Ponowny odczyt panelu Cloudflare nie dostarczył nowego dowodu, ponieważ
bezpośrednie trasy WAF i SSL/TLS zwróciły pustą zawartość/404. Nie zmieniano
ustawień. Pozostają otwarte: legal scope dostawców, origin/WAF/rate limiting,
monitoring, pełne uzgodnienie produkcyjnego ledgera oraz osobne zgody
wykonawcze. Produkcja pozostaje `NO-GO`.
