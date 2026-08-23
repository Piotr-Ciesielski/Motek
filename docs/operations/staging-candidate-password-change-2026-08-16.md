# Kandydat stagingowy — zmiana hasła — 2026-08-16

## Status

Kandydat lokalny oparty bezpośrednio na `origin/staging` SHA
`18c1f5c530e0b26984ca2c04abecccceb36788e9`.

Wdrożony na Railway wyłącznie do środowiska `staging Motek` pod adresem
`https://staging.rysia.org`. Deployment Railway: `a349d770-54bf-4431-a8cd-25c5d6b807b8`.
Produkcja nie została zmieniona.

## Zakres

- dodano formularz zmiany hasła dla zalogowanego użytkownika;
- dodano podgląd trzech pól hasła w jasnym i ciemnym motywie;
- dodano CAPTCHA dla zmiany hasła;
- backend weryfikuje bieżące hasło i tożsamość aktualnej sesji;
- aktualizacja używa `current_password` oraz bezpiecznego tokenu odświeżającego;
- dodano limit żądań i obsługę niepewnego wyniku aktualizacji;
- po zmianie hasła sesja jest globalnie unieważniana;
- komunikat wymaga minimum 8 znaków oraz małej i wielkiej litery, cyfry i znaku specjalnego.

## Weryfikacja lokalna

- `npm test`: 392/392;
- `npm run lint`: zaliczony;
- test kontraktu: 3/3;
- `git diff --check`: zaliczony.
- staging `/health/release`: HTTP 200, `status=ready`, `environment=staging`;
- staging `/api/config`: HTTP 200, Turnstile włączony;
- log startowy Railway: aplikacja uruchomiona i połączona z Supabase.

## Następny krok

Pozostaje ręczny test zalogowanego użytkownika z prawdziwą CAPTCHA oraz
wizualne sprawdzenie formularza w przeglądarce. Automatyczne połączenie z
przeglądarką Codex nie uruchomiło się w tej sesji, więc tych dwóch punktów nie
uznaję za wykonane. Dopiero po ich zaliczeniu można zamknąć blokadę
funkcjonalną w pakiecie produkcyjnym.
