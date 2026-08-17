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

1. Trzeba odczytać aktualny ledger migracji obu projektów Supabase i przypisać
   każdy efekt SQL do produkcyjnego precondition, rollbacku oraz testu. Lokalny
   CLI w tym checkoutcie nie jest obecnie powiązany z projektem zdalnym, więc
   nie wykonano dziś zapytań do ledgeru.
2. Pakiet katalogu wymaga read-only preflightu danych produkcyjnych i testu na
   izolowanej kopii. Nie wolno odtwarzać całego łańcucha migracji stagingu.
3. Recovery ma pozostać przy aktywnym kontrakcie `jti_hash`; wariant lokalny z
   `grant_id` nie może być promowany bez osobnego audytu.
4. Należy zamknąć macierz origin/cache/WAF, monitoringu, alertów i rollbacku.
5. Potrzebny jest świeży, odtwarzalny backup produkcji oraz 30-minutowe okno
   obserwacji po ewentualnym wdrożeniu.

## Następne bezpieczne kroki

1. W trybie read-only połączyć oba projekty Supabase i sporządzić mapę efektów
   migracji oraz obiektów RPC.
2. Zweryfikować precondition pakietu katalogu na produkcyjnych danych bez
   wykonywania migracji.
3. Przygotować osobny pakiet `GO/NO-GO` z dokładnym SHA, zakresem, rollbackiem,
   kryteriami STOP i planem smoke testu.
4. Dopiero po zamknięciu bram i osobnej zgodzie wykonać migrację produkcyjną
   oraz ręczny deploy Railway z `main`.

