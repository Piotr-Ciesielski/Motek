# Preflight promocji staging → production — 2026-08-17

## Werdykt

**NO-GO — produkcja nie jest jeszcze gotowa do promocji stagingu.**

Dzisiejsza poprawka logowania działa na stagingu, ale staging i produkcja
różnią się większym pakietem kodu, migracji i konfiguracji. Nie wykonano
żadnej zmiany produkcyjnej.

## Tożsamość środowisk

| Zakres | Stan |
|---|---|
| Runtime stagingu | `https://staging.rysia.org`, commit `d7409a408351dc0a8f78f53eb5861c3db6eca627` |
| Runtime produkcji | `https://www.rysia.org`, commit `0b3d43347d6b982eb86303db26650cc804ec8cd9` |
| `origin/staging` | `d7409a408351dc0a8f78f53eb5861c3db6eca627` |
| `origin/main` | `0b3d43347d6b982eb86303db26650cc804ec8cd9` |

Staging jest o wiele więcej niż dwa ostatnie commity auth: różnica względem
`origin/main` obejmuje 93 pliki, w tym migracje Supabase, legal/publication,
recovery, katalog i dokumentację. Selektywne wdrożenie samych ostatnich zmian
auth wymaga osobnego sprawdzenia zależności; mechaniczny push stagingu na
`main` nie jest bezpieczną promocją.

## Świeże dowody HTTP

- `/health/release`: `200`, `status=ready` na obu środowiskach;
- produkcja `/informacje-prawne`: `404`, staging: `200`;
- produkcja anonimowy `/api/patterns`: `200`, staging: `401`;
- stagingowa regresja publiczna dla SHA `d7409a4`: zaliczona.

Różnice publicznych endpointów pokazują, że produkcja nie jest jeszcze
funkcjonalnie zgodna ze stagingiem.

## Wyniki lokalnych bram jakości

- `npm run check`: `399/399` testów;
- `npm run staging:check`: `17/17`;
- `npm run railway:check`: `3/3`;
- testy migracji, legal/publication i polityk katalogu: `37/37`;
- `npm run legal:check`: **NO-GO** — dostawcy Supabase, Railway i Cloudflare
  nie mają kompletnego zweryfikowanego dowodu publikacyjnego.

## Nadal otwarte blokady

1. Read-only ledger Supabase został zamknięty jako mapa efektów SQL. Staging ma
   29 wpisów, Production 24. Staging ma też zdalny wpis
   `20260815152553_restore_recovery_grant_creator`, którego nie ma w lokalnym
   katalogu migracji; pozostaje on informacją o historii środowiska i nie jest
   automatycznie promowany. Numery i nazwy migracji nie są mapowaniem 1:1.
2. Pakiet katalogu ma spełniony read-only precondition danych produkcyjnych,
   a lokalny test reprezentatywnego fixture przeszedł `1/1`. Nie tworzymy
   płatnego brancha ani kopii Supabase. Nie wolno odtwarzać całego łańcucha
   migracji stagingu.
3. Recovery ma pozostać przy aktywnym kontrakcie `jti_hash`; wariant lokalny z
   `grant_id` nie może być promowany bez osobnego audytu. Produkcja zachowuje
   dodatkowo dwa legacy overloady `insert_yarn_with_limit`, których staging nie
   ma.
4. Należy zamknąć macierz origin/cache/WAF, monitoringu, alertów i rollbacku.
5. Potrzebny jest świeży, odtwarzalny backup produkcji oraz 30-minutowe okno
   obserwacji po ewentualnym wdrożeniu.
6. Security Advisors obu projektów zgłaszają wykonywalne przez `authenticated`
   funkcje `SECURITY DEFINER` oraz wyłączoną ochronę przed wyciekłymi hasłami.
   Celowe RPC pozostają bez zmian zgodnie z wcześniejszą decyzją, a wyłączona
   ochrona przed wyciekłymi hasłami jest świadomie zaakceptowanym ryzykiem.
   Staging dodatkowo zgłasza RLS bez polityk dla `private.auth_recovery_grants`
   i `public.patterns`; nie jest to automatycznie zmieniane w ramach promocji.

## Read-only snapshot Supabase — 2026-08-17

Organizacja Motka działa na planie Free. Zgodnie z dokumentacją Supabase
backupów Free nie można pobrać z panelu; przed zmianą produkcji potrzebny jest
logiczny eksport przez CLI (`supabase db dump`) i bezpieczne przechowanie go
poza Supabase. Eksport wykonano po uzyskaniu zgody: schemat ma 75 034 bajty,
a dane 66 892 bajty. Pliki pozostają lokalnie w ignorowanym katalogu
`.tmp-production-backup/` i nie są publikowane.

Odtworzenie schematu w lokalnej bazie testowej przeszło w całości. Import danych
rozpoczął się poprawnie, ale zatrzymał na kolejnych tabelach Auth zarządzanych
przez Supabase (`mfa_amr_claims` i powiązane obiekty), których nie ma w pustej
bazie. Nie jest to błąd eksportu; pełny restore danych wymaga kompletnego
szkieletu Auth. Przyjęto, że wykonany logiczny backup jest wystarczający mimo
braku pełnego testu restore; jest to jawnie zaakceptowane ryzyko.

| Obszar | Staging | Production |
|---|---|---|
| `public.patterns` | 111 rekordów; 103 `description IS NULL`; 3 `published`; 5 `pending_review`; 103 `hidden` | 15 rekordów; 0 `description IS NULL`; brak pól publikacji |
| `private.auth_recovery_grants` | `jti_hash`, `user_id`, `expires_at`, `used_at`, `created_at`, `claimed_at` | ten sam kształt |
| `private.yarn_store_versions` | `user_id`, `version` | dodatkowo `updated_at NOT NULL DEFAULT now()` |
| `insert_yarn_with_limit` | brak | dwa legacy overloady |
| aktywne RPC recovery | kontrakt `jti_hash`, funkcje claim/release/consume | ten sam aktywny kontrakt |
| legal/rejestracja | tabele, RPC, polityki; `terms=1.0`, `privacy=1.0` | ten sam efekt i wersje; znormalizowane definicje funkcji zgodne |

Odczyt nie modyfikował danych. Wspólne ostrzeżenia Security Advisors o
`SECURITY DEFINER` nie są automatycznie naprawiane w ramach promocji, ponieważ
część RPC jest celowo używana jako kontrolowany backendowy kontrakt. Decyzja
„pozostawić bez zmian” musi jednak zostać jawnie zachowana w pakiecie GO/NO-GO.
Oba projekty mają dla tych funkcji pusty `search_path`, brak wykonania przez
`anon` i wykonanie przez `authenticated`/`service_role`; pod tym względem nie
ma dodatkowego driftu między środowiskami. Ochrona przed wyciekłymi hasłami jest
wyłączona w obu projektach i pozostaje świadomie zaakceptowanym ryzykiem.

## Następne bezpieczne kroki

1. Potwierdzić właściciela oraz 30-minutowe okno obserwacji.
2. Przygotować osobny pakiet `GO/NO-GO` z dokładnym SHA, zakresem, kolejnością
   Pakiet A → deploy kodu → smoke test, rollbackiem i kryteriami STOP.
3. Dopiero po zamknięciu tych bram i osobnej zgodzie wykonać migrację
   produkcyjną oraz ręczny deploy Railway z `main`.

## Aktualizacja po wdrożeniu produkcyjnym — 2026-08-17

Promocja została wykonana po osobnej zgodzie operatora. Produkcja działa na
commicie `a625bccbec827fd07965f476259f39836fc84b90` (`2.0.0-alpha.39`), a
Pakiet A został zastosowany na produkcyjnym Supabase.

Po publikacji testowego katalogu produkcyjny stan `public.patterns` wynosi:

- 15 rekordów `published`;
- 0 rekordów `pending_review`;
- 0 rekordów `hidden`;
- 0 pustych opisów.

Wzory są syntetycznymi rekordami testowymi i mają znacznik audytu
`synthetic-production-test-2026-08-17`. Nie zmieniano kodu aplikacji przy tej
publikacji danych.

## Aktualizacja kontroli HTTPS, originu i Cloudflare

- `https://www.rysia.org/` odpowiada przez Cloudflare (`Server: cloudflare`,
  `CF-RAY`);
- żądanie HTTP przekierowuje do HTTPS (`301`);
- HSTS jest aktywny z `max-age=2592000`;
- certyfikat domeny Railway jest ważny, a domena niestandardowa ma status
  `ACTIVE` i `Verified: yes`;
- bezpośredni adres Railway zwraca `404` z `x-railway-fallback`, nie ujawnia
  aplikacji Motek i nie omija publicznej warstwy Cloudflare.

Historyczny odczyt panelu Cloudflare z 2026-08-16 potwierdził dodatkowo:

- `Full (strict)` między Cloudflare i originem;
- `Always Use HTTPS` włączone;
- minimalny TLS 1.2 oraz TLS 1.3 włączony;
- `rysia.org` i `www.rysia.org` jako rekordy `Proxied`, a staging jako
  `DNS only`;
- 0 z 5 własnych reguł bezpieczeństwa oraz 0 z 1 reguł rate limiting;
- brak skonfigurowanych reguł zarządzanych w bieżącym planie — panel wskazywał
  przejście na plan Pro;
- brak aktywnych wpisów Cache Rules i Cache Response Rules, przy słabszym
  dowodzie, ponieważ tabela była wtedy w trakcie ładowania.

Późniejszy odczyt publiczny potwierdził włączenie HSTS w wariancie
`max-age=2592000`, bez `includeSubDomains` i bez `preload`.

Panelowa konfiguracja ochrony originu nie była ponownie zmieniana. Bezpośredni
odczyt adresu Railway wykonany 2026-08-17 zwrócił `404` z
`x-railway-fallback`, a nie aplikację Motek, co jest dodatkowym dowodem, że
origin nie omija obecnie publicznej warstwy Cloudflare. Operator potwierdził
również, że alerty Cloudflare są czyste.

## Końcowe potwierdzenie operatora — 2026-08-17

- produkcyjny smoke test został wykonany i zakończył się poprawnie;
- dokumentacja ma zostać opublikowana razem z tym checkpointem;
- legal readiness, ograniczenia backupu oraz ostrzeżenia Security Advisors
  pozostają świadomie zaakceptowanymi ryzykami i nie są teraz domykane;
- 15 opublikowanych rekordów pozostaje katalogiem syntetycznych wzorów demo do
  czasu planowanej zmiany produktowej.
