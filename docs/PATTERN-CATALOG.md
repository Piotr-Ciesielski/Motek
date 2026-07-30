# Katalog wzorów — stan i zasady

## Aktualny stan

Katalog zawiera 106 rekordów w Supabase:

- 103 samodzielne wzory pochodzące z lokalnych dokumentów PDF;
- 3 syntetyczne wzory testowe oznaczone w nazwie jako `Wzór demo`.

Aktualna kompletność danych:

- wszystkie 106 rekordów ma status `Zweryfikowany`;
- żaden rekord nie wymaga dalszego ręcznego sprawdzenia danych włóczki;
- 68 rekordów ma jednoznaczny przelicznik metrów na 100 gramów;
- wszystkie 106 rekordów ma opis wymaganych włóczek lub jawnie elastycznego
  doboru materiału;
- 3 wzory demo mają kompletne dane pozwalające na automatyczne dopasowanie;
- język źródła rozpoznano jako polski dla 49 i angielski dla 57 rekordów;
- każdy rekord ma kontrolowany typ projektu używany w karcie i filtrze katalogu;
- katalog zawiera 35 par skarpet, 21 swetrów, 9 kardiganów, 19 topów i bluzek,
  9 chust lub szali, 5 nakryć głowy, 1 parę rękawiczek, 2 kamizelki,
  4 spódnice lub sukienki oraz 1 inny projekt.

Filtry tekstu, statusu, języka, typu i materiału działają łącznie. Typ projektu
i materiał pokazują dynamiczne liczniki, a wzór wielomateriałowy jest dostępny
pod każdym swoim materiałem bez duplikowania wyników.

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

### 1. Typ projektu — wdrożone

Typ projektu jest zapisywany w osobnym polu `project_type`, importowany do
Supabase oraz pokazywany na karcie i w filtrze katalogu.

Zasady klasyfikacji:

- kategorie są ograniczone do zamkniętej listy wartości;
- typ jest wyliczany z ostatecznej nazwy i opisu po zastosowaniu ręcznych
  poprawek;
- jawny `project_type` z ręcznej poprawki ma pierwszeństwo przed klasyfikacją
  automatyczną;
- niejednoznaczne przypadki pozostają w kategorii `other`;
- ręczne korekty nadal można dodawać w pliku nadpisań.

### 2. Adres źródła

Obecne rekordy przechowują nazwę lokalnego pliku PDF, ale nie wiarygodny adres
publikacji. Adresów nie należy zgadywać na podstawie nazwy pliku.

Rekomendowane rozwiązanie:

- dodać opcjonalne pole `source_url`;
- uzupełniać je wyłącznie po ręcznym potwierdzeniu oficjalnej strony autora,
  wydawcy lub sklepu;
- nie pokazywać przycisku źródła, jeśli adres jest pusty;
- wzory demo pozostawić bez zewnętrznego adresu.

### 3. Dopasowanie rzeczywistych wzorów

Należy wybrać pierwszą małą partię rzeczywistych wzorów z jednoznacznymi
tabelami rozmiarów i zużycia, przygotować dla nich kompletne warianty
`matching_requirements`, przetestować je na przykładowych magazynach i dopiero
potem przejść do kolejnych partii. Adres źródła jest przydatny prezentacyjnie,
ale nie blokuje opracowania potwierdzonych wymagań ilościowych z dostępnego PDF.

## Narzędzie importu

Źródło wzorów demo znajduje się w `data/pattern-demo.json`. Generator
`scripts/build-pattern-import.py` dołącza je do `data/patterns-import.json`,
więc nie znikną przy kolejnym przebudowaniu danych importowych.
