# Kandydat stagingowy — zmiana hasła — 2026-08-16

## Status

Kandydat lokalny oparty bezpośrednio na `origin/staging` SHA
`18c1f5c530e0b26984ca2c04abecccceb36788e9`.

Nie został jeszcze wdrożony na Railway ani opublikowany na żadnym środowisku.

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

## Następny krok

Po zapisaniu i przeglądzie pakietu należy wykonać osobno zatwierdzone wdrożenie
na staging, a następnie ręczny test zalogowanego użytkownika z prawdziwą
CAPTCHA. Dopiero po tym można zamknąć blokadę funkcjonalną w pakiecie
produkcyjnym.
