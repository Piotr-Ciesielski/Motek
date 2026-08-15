# Indeks dowodów preflight release — Motek

Dokument porządkuje dowody dostępne lokalnie dla kandydata release. Nie jest
potwierdzeniem konfiguracji usług produkcyjnych i nie zmienia statusu żadnego
dostawcy na `verified`.

## Kandydat

- źródło aplikacji: `origin/staging@e691af891758ebc17f6d4683dbca5d997f65dbe5`;
- wersja kandydata: `2.0.0-alpha.39`;
- bieżący checkout `agent/staging-security-merge` jest brudny i nie jest
  artefaktem do promocji;
- checkout `release/motek-recovery-rc` jest pomocniczym RC dokumentacyjnym;
  dla `supabase/migrations` i `supabase/tests/database` porównanie ze stagingiem
  nie wykazuje różnic.

## Lokalnie potwierdzone

Wyniki poniżej pochodzą z odczytów i testów wykonanych 2026-08-14 albo z
wcześniej zapisanych, powtarzalnych rehearsalów opisanych w dokumentach
powiązanych. Nie ma surowego logu CLI dla całego replayu; wynik jest odtwarzalny
z SHA, listy plików, hashy i zapisanych rezultatów.

| Zakres | Dowód i ograniczenie | Status |
|---|---|---|
| Migracje | Izolowany replay aktualnego RC obejmuje 32 pliki i `migration list` 32/32. To lokalny wynik z RC, nie dowód zgodności produkcyjnego ledgera; staging ma 27 wpisów zdalnych, a mapowanie wersja/nazwa/hash/efekt pozostaje otwarte. | PASS lokalny |
| Zdalny snapshot ledgerów | Odczyt Supabase API potwierdził Production `vueotocjsgzosqzhcish` = 23 migracje i Staging `rprhbmtabwjsenvfgicg` = 27 migracji, oba `ACTIVE_HEALTHY` w `eu-north-1`; pełna lista znajduje się w osobnym snapshotcie. | PASS odczyt; mapowanie otwarte |
| Macierz migracji | Wszystkie 27 wpisów Staging i 23 wpisy Production mają robocze mapowanie do lokalnego kandydata; pozycje scalone/przemianowane pozostają `UNRESOLVED`, a delta targetu jest `PENDING_DELTA`. | PASS analityczny; ledger OPEN |
| `harden_rls_auto_enable_permissions` | Odczyt `to_regprocedure('public.rls_auto_enable()')` zwrócił brak funkcji w Production i Staging. Lokalna migracja wykonuje REVOKE tylko warunkowo, więc efekt jest funkcjonalnie równoważnym no-op; historyczny hash pozostaje nieznany. | FUNCTIONALLY EQUIVALENT; zakres efektu zamknięty |
| ACL mutacji włóczek i sekwencji | Production/Staging: `public`, `anon`, `authenticated` bez `INSERT/UPDATE/DELETE` na `public.yarns` i bez `USAGE` `public.yarns_id_seq`; `service_role` zachowuje dostęp. | FUNCTIONALLY EQUIVALENT; zakres efektu zamknięty |
| Katalog i prywatna tabela recovery | `patterns_service_role_all` działa w obu środowiskach; RLS blokuje klienta mimo technicznych grantów relacji. `private.auth_recovery_grants` jest niedostępna klientom; Production ma jawne `false`, Staging osiąga tę samą granicę przez ACL/RLS. | FUNCTIONALLY EQUIVALENT; różna implementacja |
| Versioned RPC i legal gate — świeży odczyt | Oba środowiska: `SECURITY DEFINER`, `search_path=""`, anon bez EXECUTE, authenticated z EXECUTE. Production: brak legal gate i `40001`; Staging: legal gate w RPC/RLS i `P0003`. | CONFLICT potwierdzony; migracja produkcyjna otwarta |
| Recovery — świeży odczyt metadanych | Production: 0 grantów, brak `claimed_at`, constraint 43, legacy lifecycle service-only. Staging: 0 grantów, `claimed_at`, constraint 64 i claim/release/consume dla authenticated. Oba środowiska: anon bez EXECUTE, `SECURITY DEFINER`, pusty `search_path`. | CONFLICT potwierdzony; migracja 43→64 otwarta |
| Legacy `insert_yarn_with_limit` — świeży odczyt | Production ma oba przeciążenia z `EXECUTE` dla `authenticated`; Staging nie ma żadnego. Lokalny runtime nie używa legacy, ale zewnętrzne joby/skrypty wymagają osobnego potwierdzenia. | CONFLICT potwierdzony; cleanup otwarty |
| Legacy RPC — logi API 24h | Przetworzone bez ujawniania treści logów: Production/Staging mają 0 wzmianek `insert_yarn_with_limit` i 0 wpisów błędów w zwróconym oknie. To nie obejmuje niepodłączonych jobów ani pełnej historii audytowej. | Brak użycia w oknie; cleanup nadal otwarty |
| Zdalne definicje recovery/RLS/ACL | Read-only SQL potwierdził: Production ma legacy `create/consume` i constraint `jti_hash=43`, a także stare `insert_yarn_with_limit`; Staging ma `claimed_at`, `claim/release/consume` dla `authenticated`, SHA-256/64 oraz `has_current_terms_acceptance()` w politykach `yarns`. Decyzją produktu z 2026-08-14 bramka legalna ma obowiązywać także w Production. | PASS odczyt; konflikt techniczny do migracji |
| Fingerprint definicji zdalnych | Odczyt UTC `2026-08-14 15:32:46–48` dał różne fingerprinty funkcji, constraintów i polityk; fingerprint relacji/RLS/ACL dla wybranych tabel jest taki sam. To fingerprint efektu, nie hash migracji. | PASS odczyt; różnice potwierdzone |
| Versioned store / legal gate | Production ma `updated_at`, brak `has_current_terms_acceptance()` w RPC, kod konfliktu `40001` i 2 legacy overloady; Staging ma `user_id/version`, bramkę legalną, `P0003` i 0 legacy overloadów. | CONFLICT potwierdzony; `PENDING_DELTA` |
| Dane versioned store | Production: 2 rekordy licznika, 2 niepuste `updated_at`, 10 włóczek, 0 grantów recovery; lokalny kod nie używa `updated_at`. Decyzja: zachować kolumnę i wartości, bez `DROP COLUMN` w recovery. | ACCEPTED_COMPATIBILITY |
| Delta safety controls | Forward-only delta ma zakaz `DROP COLUMN`/`DROP TABLE`/resetu licznika oraz wymaga postflight RPC, 6 polityk RLS, ACL, legal gate, braku legacy RPC i kontroli recovery 43→64. | PLAN; wykonanie otwarte |
| Inwentaryzacja ryzyka delty | Osobny dokument porządkuje operacje ryzyka, kolejność `preflight → backup/restore → versioned store → legal → recovery → legacy cleanup → postflight` oraz warunki STOP. Backup/restore z bieżącego okna jest wykonany; przed zmianą danych trzeba odświeżyć pakiet. | PLAN; backup PASS warunkowy |
| Testy DB | 9 plików pgTAP, 291 testów w izolowanym stacku aktualnego RC. Brak surowego logu CLI jako osobnego artefaktu. | PASS lokalny |
| Recovery RPC | `SECURITY DEFINER`, pusty `search_path`, brak EXECUTE dla `anon`, ACL zgodne z kontraktem. Security Advisor nadal zgłasza ostrzeżenia dla celowych RPC dostępnych `authenticated`; nie jest to produkcyjne `GO`. | PASS kontraktu |
| Prywatność tabeli recovery | Brak SELECT dla `anon` i `authenticated` w izolowanym replayu. | PASS lokalny |
| Backup/restore public/private | Świeży pełny eksport produkcyjny odtworzono w izolowanym PostgreSQL i zgodnym stacku Supabase; liczności `profiles=2`, `yarns=10`, `patterns=15`, `yarn_store_versions=2`, `grants=0` były zgodne. | PASS |
| Backup/restore Auth | Świeży eksport `auth` odtworzono w zgodnym stacku Supabase/GoTrue: 2 użytkowników, 1 identity i 52 sesje; zdrowie, syntetyczna rejestracja, logowanie i recovery przeszły. | PASS warunkowy |
| Backup/restore Storage | Świeży eksport schematu i danych Storage wykonano; Production miał 0 bucketów i 0 obiektów, a cel również 0/0. Import wewnętrznej tabeli zarządzanej nie był potrzebny; przy niepustym Storage trzeba powtórzyć pełny test. | PASS warunkowy; zero danych |
| Storage — świeży odczyt | Production/Staging: `storage.objects=0`, `bucket_count=0`, brak bucketów. Zakres został objęty eksportem i odtworzeniem pustego stanu. | PASS zakresowy |
| Testy aplikacji RC | Ponowny `npm run check` na kandydacie RC przeszedł 388/388. Wcześniejszy pomiar 387/388 był pojedynczą obserwacją czasową; nie zmieniono progu ani kodu. | PASS lokalny |
| Kontrakty staging/Railway RC | `npm run staging:check` przeszedł 17/17, `npm run railway:check` 3/3, a `npm run lint` zakończył się poprawnie. To potwierdza kod i deklarowaną konfigurację, nie aktywne ustawienia dostawców. | PASS lokalny |
| Format RC | `format:check` zgłasza cztery pliki konfiguracyjne (`eslint.config.js`, `.prettierrc.json`, `package.json`, workflow CI); wynik jest związany z końcówkami linii/formatem środowiska Windows. Nie wykonano automatycznego zapisu ani nie dodano tych plików do pakietu recovery. | OGRANICZENIE lokalne |
| GitHub CI exact candidate | Run `31692102925` dla `e691af891758ebc17f6d4683dbca5d997f65dbe5` zakończył się sukcesem; joby `test` i `database` przeszły, w tym replay migracji i testy bazy. | PASS exact SHA |
| Full staging regression exact candidate | Run `31692142042` ma `headSha=e691af891758ebc17f6d4683dbca5d997f65dbe5`, workflow `Post-deploy regression`, job `regression` i krok `Uruchom pełną regresję staging` zakończony sukcesem. To zamyka workflowowy dowód pełnej regresji exact SHA; metadane nie są osobnym dowodem szczegółowego cleanupu ani braku osieroconych rekordów. | PASS exact SHA; zakres ograniczony |
| Publiczne HTTPS | `GET` healthchecka przez `www` i apex kończy się `200`; HTTP→HTTPS i apex→www zwracają `301`; Railway logs potwierdzają deployment bez upstream errors. | PASS zakresowy |
| Staging release smoke | `https://staging.rysia.org` zwraca `/health/release` z dokładnym `e691af891758ebc17f6d4683dbca5d997f65dbe5` i `environment: staging`; `regression:smoke` zakończył się kodem 0. Smoke potwierdza publiczny kontrakt kandydata, nie pełną regresję autoryzowaną ani produkcję. | PASS zakresowy |
| Publiczna strona prawna | Staging `/informacje-prawne` i `/informacje-prawne/` zwracają `200` z `Content-Type: text/html`, CSP i `X-Content-Type-Options: nosniff`; produkcja na aktualnym `c4b777a` zwraca `404` dla obu wariantów. | PASS staging; FAIL production |
| API/Auth/cache — odczyt GET | Staging: `/api/config` `200 no-store`, `/api/patterns`, `/api/yarns`, `/api/matches` `401 no-store`, `/api/auth/session` `200 no-store`. Production: te endpointy są `no-store`/`DYNAMIC`, ale `/api/patterns` zwraca `200` i 833 bajty JSON anonimowo, zamiast `401`; to narusza zaakceptowaną zasadę katalogu wyłącznie przez backend i wynika ze starszego SHA `c4b777a`. | PASS staging; FAIL production access control |
| TLS 1.2 client→edge | `curl --tlsv1.2` uzyskał `ssl_verify=0`: `www` 200, apex 301, staging 200. Potwierdza klient→edge dla testowanych hostów, nie handshake Cloudflare→Railway ani certyfikat originu. | PASS zakresowy |
| Production release smoke | Smoke dla kandydata `e691af8` słusznie oczekiwał innego SHA i wygasł. Odczyt `/health/release` potwierdził produkcyjny `c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b`; smoke dla tego SHA zatrzymał się na `GET /informacje-prawne = 404`. `c4b777a` jest przodkiem kandydata `e691af8`, więc produkcja nie jest jeszcze kandydatem recovery. | FAIL; NO-GO |
| Publiczny kontrakt — świeży odczyt | 2026-08-14: staging `health/release=e691af8`, legal `200`, anonimowy katalog `401`; production `health/release=c4b777a`, legal `404`, anonimowy katalog `200` / 833 bajty. | STAGING PASS; PRODUCTION FAIL |
| Cloudflare rules/cache | `0/5` custom rules, `0/1` rate limiting rules, brak aktywnych managed rules na planie Free, `0 active` Cache Rules i `0 active` Cache Response Rules. | ODCZYT; decyzja otwarta |
| Origin/cache — odczyt częściowy | Techniczny adres `u6438t9v.up.railway.app` zwraca Railway fallback `404 Application not found`, nie aplikację. `GET /api/config` przez `www` zwraca `Cache-Control: no-store` i `cf-cache-status: DYNAMIC`; nie dowodzi to wszystkich API/Auth ani pełnej ochrony originu. | CZĘŚCIOWO |
| Higiena Git | `git diff --check` sprawdzał śledzone różnice bieżącego checkoutu; pliki nieśledzone nie są objęte tym wynikiem. | PASS zakresowy |
| Bezpieczeństwo CLI | Podczas lokalnego `db dump --dry-run --linked --schema public,private` CLI wypisał w terminalu tymczasowe poświadczenie połączenia. Nie wykonano dumpu ani zapisu; wartość nie została zapisana w repozytorium ani dokumentacji. Poświadczenie zostało obrócone w panelu Supabase; CLI nie zostało jeszcze ponownie uwierzytelnione ani użyte. | ROTACJA WYKONANA; reautoryzacja CLI otwarta |
| Advisories Supabase — świeży odczyt | Production nadal zgłasza celowe ostrzeżenia `SECURITY DEFINER` dla versioned RPC oraz wyłączoną ochronę wyciekłych haseł; Staging zgłasza dodatkowo recovery/legal RPC i informacyjne RLS/index warnings. Nie wykonano automatycznego REVOKE ani zmiany Auth. | ODCZYT; decyzje zachowane |

## Łańcuch recovery — hashe plików

Poniższe wartości są hashami Git blobów plików w izolowanym checkoutcie RC;
łańcuch jest używany wyłącznie w kolejności rosnącej wersji migracji:

```text
974ee956c860bd3f1b173d504574bf207d866f4e  20260806120000_restrict_yarn_mutations.sql
c8ca118ca78f66f9b48e0e17b1537228aebdaa8e  20260806123000_add_recovery_grants.sql
2d16696ba3cdbd794fb6c151ee07fe399168e4bd  20260807090000_revoke_yarns_sequence_acl.sql
b288171e1217969e40f6e2d6292fdeee47852000  20260807093000_harden_profile_avatar_url.sql
9ce441f7a6824435668cb6d7e2db68a1459778b7  20260807150000_reconcile_yarn_acl_and_recovery.sql
24122827f3121cfc8d5f952e9b2ef2f2e038682c  20260809165750_add_pattern_publication_audit.sql
90460845ffa1f16651c88ff07df287745c6cd7a9  20260809185511_add_invited_registration_and_legal_acceptance.sql
6cb9f93580c8e8c174112381395366768354af5d  20260810120111_enforce_current_terms_for_private_data.sql
7a189db78c8fdbfc35e85d187687abe337d0a7da  20260810123000_revoke_registration_invitation.sql
f8507e3dc725fffc5db06365fab188b47fc535c0  20260812122131_add_recovery_grant_claim.sql
8e0405de10e7ee300873a6271bbc86ee05a93f1f  20260813100000_harden_recovery_grant_release.sql
```

## Dowody wymagające operatora lub usług

Indeks nie zamyka następujących bram:

- produkcyjny ledger migracji i brakujące recovery RPC; staging ma 27 wpisów
  zdalnych wobec 30 plików w lokalnym RC, więc przed migracją potrzebna jest
  mapa `remote version/name → plik → hash → efekt schematu`;
- odświeżenie backupu i izolowanego restore, jeśli przed oknem produkcyjnym
  zmieni się stan danych; bieżący pakiet z 2026-08-14 obejmuje `public/private`,
  Auth i pusty Storage;
- Cloudflare **edge**: `Full (strict)`, minimum TLS 1.2, redirecty HTTPS i
  `GET /health/ready` są już potwierdzone. Nadal otwarte są certyfikat/SNI
  originu, brak obejścia originu Railway, cache API/Auth, WAF/rate limiting,
  monitoring i odbiorca alertów;
- Cloudflare **Turnstile**: osobne dowody widgetu, sygnałów, lokalizacji,
  transferów, retencji, DPA i subprocesorów;
- legal scope Supabase i Railway: plan, zakres danych, retencja, lokalizacja,
  transfery, DPA i subprocesorzy;
- preflight rozszerzeń/RLS/ACL, właściciel decyzji stop, odbiorca alertów,
  kryteria naprawy forward/restore, post-migration readiness, smoke i okno
  obserwacji;
- osobne zgody na migrację Supabase, deploy aplikacji i obserwację po deployu.

Do czasu zamknięcia tych bram produkcja pozostaje `NO-GO`. Nie wpisywać tutaj
sekretów, PII ani `verifiedAt`; manifest pozostaje `unverified` zgodnie z
[pakietem dowodów legal-readiness](legal-evidence-request-2026-08-13.md).

## Świeży odczyt usług — 2026-08-15

- Supabase Production `vueotocjsgzosqzhcish` i Staging
  `rprhbmtabwjsenvfgicg` są `ACTIVE_HEALTHY` w `eu-north-1`.
- Odczyt logów API oraz logów Edge Functions z ostatnich 24 godzin nie zawiera
  `insert_yarn_with_limit`. Nie jest to dowód braku klientów poza usługą ani
  pełnej historii użycia.
- Railway nadal ma jeden serwis Motek w środowiskach `production` i `staging
  Motek`; oba statusy są `SUCCESS`, a `cronSchedule` jest pusty. Konfiguracja
  nie wykazuje harmonogramu cron. Odczytano wyłącznie nazwy zmiennych, bez ich
  wartości.
- Lista Edge Functions dla Production zwróciła pustą listę. Wywołanie listy
  dla Staging zakończyło się błędem argumentu konektora; nie oznaczam tego jako
  dowodu braku funkcji i pozostawiam ponowny odczyt jako zadanie otwarte.
- Bezpośredni odczyt katalogu PostgreSQL wykazał w obu projektach brak
  rozszerzeń `pg_cron` i `pg_net`, brak relacji `cron.job` oraz brak funkcji w
  schemacie `cron`. Ten dowód zamyka lokalny zakres schedulerów bazodanowych,
  ale nie wyklucza zewnętrznych webhooków ani ręcznych klientów.
- Ten sam odczyt potwierdził dwa przeciążenia `insert_yarn_with_limit` w
  Production i zero w Staging. Cleanup pozostaje osobną migracją po
  potwierdzeniu zależności zewnętrznych.
- Świeży odczyt publiczny z 2026-08-15 potwierdził brak zmiany kontraktu:
  Production `/health/release` = `c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b`,
  `/informacje-prawne` = `404`, anonimowe `/api/patterns` = `200`; Staging
  `/health/release` = `e691af891758ebc17f6d4683dbca5d997f65dbe5`, strona prawna
  = `200`, anonimowe `/api/patterns` = `401`.
- `npm run legal:check` nadal kończy się fail-closed jako
  `LEGAL_PUBLICATION=not ready`; Supabase, Railway i Cloudflare pozostają
  niezweryfikowane.

Nie wykonano zapisów, zmian konfiguracji, migracji, deployu ani operacji na
sekretach. Produkcja pozostaje `NO-GO`.

## Powiązane dokumenty

- [runbook wdrożenia i regresji](post-deploy-regression.md),
- [rehearsal backup/restore](backup-restore-rehearsal-2026-08-13.md),
- [status legal-readiness](legal-readiness-status-2026-08-11.md),
- [inwentaryzacja ryzyka delty forward-only](production-forward-delta-risk-inventory-2026-08-14.md),
- [plan dalszych zmian](../superpowers/plans/2026-08-12-motek-next-changes.md).
