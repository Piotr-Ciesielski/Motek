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
- 21 wariantów trzech rzeczywistych wzorów ma kompletne dane pozwalające na
  automatyczne dopasowanie;
- wszystkie 106 rekordów korzysta z walidowanego formatu wymagań v2;
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

## Dokładne dopasowanie — wdrożone

Pierwszy zweryfikowany pakiet obejmuje 21 wariantów trzech rzeczywistych
wzorów:

- `Holly` — 1 wariant z włóczką główną i dwoma kontrastowymi kolorami;
- `Na Pole` — 12 wariantów rozmiaru i rodzaju włóczki;
- `Oslo Hat` — 8 wariantów rozmiaru i rodzaju włóczki, z dwiema nitkami.

Wymagania rozdzielają metry lub gramy, klasy grubości, materiały, role i
zależności kolorystyczne. Ranking wskazuje, które konkretne motki zostały
przydzielone do każdej roli i nie wykorzystuje jednego motka ponownie.

## Wzory demo

Wzory demo zachowują własne, krótkie opisy, ale nie uczestniczą już w rankingu.
Testy dokładnego dopasowania korzystają z potwierdzonych danych rzeczywistych
wzorów oraz osobnych danych testowych.

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

### 3. Dopasowanie rzeczywistych wzorów — pierwszy pakiet wdrożony

Pierwszy pakiet Holly, Na Pole i Oslo Hat został przygotowany, zwalidowany i
zaimportowany. Kolejne wzory należy dodawać partiami tą samą metodą: potwierdzić
tabele rozmiarów i zużycia w PDF, zapisać kompletne warianty, sprawdzić je na
przykładowych magazynach i dopiero wtedy włączyć do rankingu.

## Narzędzie importu

Źródło wzorów demo znajduje się w `data/pattern-demo.json`. Generator
`scripts/build-pattern-import.py` dołącza je do `data/patterns-import.json`,
więc nie znikną przy kolejnym przebudowaniu danych importowych.
