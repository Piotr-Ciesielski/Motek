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

1. Read-only ledger Supabase został odczytany, ale nie został jeszcze zamknięty
   jako mapa efektów SQL. Staging ma 29 wpisów, Production 24. Staging ma też
   zdalny wpis `20260815152553_restore_recovery_grant_creator`, którego nie ma
   w lokalnym katalogu migracji. Numery i nazwy migracji nie są mapowaniem 1:1.
2. Pakiet katalogu ma spełniony read-only precondition danych produkcyjnych,
   ale wymaga testu na izolowanej kopii. Nie wolno odtwarzać całego łańcucha
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
   Staging dodatkowo zgłasza RLS bez polityk dla `private.auth_recovery_grants`
   i `public.patterns`. To wymaga decyzji bezpieczeństwa przed GO.

## Read-only snapshot Supabase — 2026-08-17

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
natomiast wyłączona w obu projektach i pozostaje osobną decyzją bezpieczeństwa.

## Następne bezpieczne kroki

1. Sporządzić mapę efektów migracji, w tym zdalnego stagingowego wpisu
   `restore_recovery_grant_creator`, oraz przypisać każdy efekt do precondition,
   rollbacku i testu.
2. Zweryfikować precondition pakietu katalogu na produkcyjnych danych bez
   wykonywania migracji.
3. Rozstrzygnąć ostrzeżenia Security Advisors i potwierdzić, które RPC są
   celowo dostępne dla backendu.
4. Przygotować osobny pakiet `GO/NO-GO` z dokładnym SHA, zakresem, rollbackiem,
   kryteriami STOP i planem smoke testu.
5. Dopiero po zamknięciu bram i osobnej zgodzie wykonać migrację produkcyjną
   oraz ręczny deploy Railway z `main`.
