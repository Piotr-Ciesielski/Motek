# Katalog wzorów — stan i zasady

## Aktualny stan

Katalog zawiera 119 rekordów w Supabase:

- 116 wzorów pochodzących z dotychczasowego importu;
- 3 syntetyczne wzory testowe oznaczone w nazwie jako `Wzór demo`.

Aktualna kompletność danych:

- 9 rekordów ma status `Zweryfikowany`, w tym 3 wzory demo;
- 110 rekordów nadal wymaga ręcznego sprawdzenia;
- 49 rekordów ma jednoznaczny przelicznik metrów na 100 gramów;
- 107 rekordów ma przynajmniej częściowy opis wymaganych włóczek;
- 3 wzory demo mają kompletne dane pozwalające na automatyczne dopasowanie;
- język źródła rozpoznano jako polski dla 62, angielski dla 56 i nieustalony
  dla 1 rekordu.
- każdy rekord ma kontrolowany typ projektu używany w karcie i filtrze katalogu;
- kategorie obejmują skarpety, swetry, kardigany, topy i bluzki, chusty i szale,
  nakrycia głowy, rękawiczki, kamizelki, spódnice i sukienki, koce oraz „inne”.

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
- nazwa pliku i nazwa wzoru mają pierwszeństwo przed opisem automatycznym;
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

Po uporządkowaniu typu projektu i źródeł należy wrócić do sześciu
zweryfikowanych rzeczywistych rekordów, przygotować dla nich kompletne warianty
`matching_requirements`, przetestować je na przykładowych magazynach i dopiero
potem przejść do kolejnych partii.

## Narzędzie importu

Źródło wzorów demo znajduje się w `data/pattern-demo.json`. Generator
`scripts/build-pattern-import.py` dołącza je do `data/patterns-import.json`,
więc nie znikną przy kolejnym przebudowaniu danych importowych.
