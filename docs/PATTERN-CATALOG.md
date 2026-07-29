# Katalog wzorów — stan i zasady

## Aktualny stan

Katalog zawiera 119 rekordów w Supabase:

- 116 wzorów pochodzących z dotychczasowego importu;
- 3 syntetyczne wzory testowe oznaczone w nazwie jako `Wzór demo`.

Mechanizm dopasowania korzysta wyłącznie z kompletnych danych w polu
`matching_requirements`. Wzory bez potwierdzonych wymagań pozostają dostępne w
katalogu opisowym, ale nie są używane w rankingu.

## Wzory demo

Wzory demo służą do testów end-to-end. Zawierają własne, krótkie opisy oraz
kompletne warianty z liczbą motków, długością, wagą, materiałem i grubością.

- `Wzór demo — Leśny kardigan`
- `Wzór demo — Bawełniany top`
- `Wzór demo — Moherowa chusta`

Są syntetyczne i nie opisują istniejących publikacji ani instrukcji wykonania.

## Zasady treści

W katalogu publikujemy wyłącznie:

- nazwę wzoru, projektanta lub markę, jeśli mamy wiarygodne źródło;
- krótki, własny opis faktograficzny — najwyżej kilka zdań;
- link do źródła i techniczne parametry potrzebne do dopasowania;
- status kompletności danych.

Nie publikujemy instrukcji krok po kroku, tłumaczeń instrukcji, diagramów,
zdjęć stron PDF ani długich cytatów. Brakujących parametrów nie uzupełniamy
domysłami.

## Następny etap

Ręczna weryfikacja rzeczywistych wzorów jest wstrzymana. Po wznowieniu należy
zacząć od sześciu rekordów oznaczonych jako kompletne, przygotować dla nich
warianty `matching_requirements`, przetestować je na przykładowych magazynach
i dopiero potem przejść do kolejnych partii.

## Narzędzie importu

Źródło wzorów demo znajduje się w `data/pattern-demo.json`. Generator
`scripts/build-pattern-import.py` dołącza je do `data/patterns-import.json`,
więc nie znikną przy kolejnym przebudowaniu danych importowych.
