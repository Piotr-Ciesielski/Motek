# Dokładne dopasowanie wzorów — projekt

**Status realizacji:** wdrożone dla kontraktu wymagań v2 i 21 zweryfikowanych wariantów.

**Data:** 2026-07-30  
**Status:** zatwierdzony przez właścicielkę produktu  
**Zakres:** magazyn włóczek, katalog wzorów i automatyczne dopasowanie

## Cel

Motek ma przechowywać rzeczywisty skład włóczki i odwzorowywać wymagania
wzorów bez wymuszania danych, których źródłowy PDF nie podaje. Dopasowanie
ma rozumieć rozmiary, alternatywne włóczki, kilka kolorów lub ról, nitki
trzymane razem oraz ilości podane w różnych jednostkach.

Równolegle przycisk `+ Dodaj motek` ma być odporny na wielokrotne kliknięcie:
w magazynie może istnieć najwyżej jeden niezapisany formularz nowego motka.

## Decyzje produktowe

1. Przy jednym motku można wybrać kilka materiałów składowych.
2. Procentowy skład nie jest wymagany.
3. Materiały w magazynie i katalogu korzystają z jednej wspólnej listy nazw.
4. `dowolny materiał` opisuje elastyczny wzór i nie jest materiałem możliwym
   do przypisania motkowi.
5. Dotychczasowa wartość `mieszanka` pozostaje jako
   `Mieszanka — skład nieokreślony`, aby zachować istniejące dane.
6. Dokładność danych źródłowych ma pierwszeństwo przed wypełnianiem wszystkich
   pól. Jeśli wzór podaje tylko metry albo tylko gramy, zapisujemy tylko znaną
   jednostkę.
7. Liczba fabrycznych motków jest informacją pomocniczą. O wykonalności
   decyduje podana przez wzór minimalna ilość włóczki, nie liczba rekordów w
   magazynie.

## Wspólna lista materiałów

Lista wybieralna dla włóczki:

- wełna,
- alpaka,
- moher,
- kaszmir,
- angora,
- jak,
- bawełna,
- len,
- bambus,
- wiskoza,
- jedwab,
- poliamid,
- poliester,
- akryl,
- mieszanka.

Kolejność i polskie etykiety będą zdefiniowane w jednym współdzielonym module.
Backend użyje tego samego modułu do walidacji danych, a frontend do budowania
listy wyboru oraz filtrów.

W katalogu opcja materiału pozostaje dynamiczna: pokazuje tylko materiały
występujące w aktualnym katalogu. Nazwy i znaczenie opcji są jednak wspólne
z formularzem włóczki. Wzór oznaczony jako `dowolny materiał` pasuje do
każdego wybranego filtra materiału, lecz nie tworzy osobnej pozycji filtra.

## Formularz materiałów włóczki

Pole materiału zostanie zastąpione rozwijaną sekcją z checkboxami. Podsumowanie
sekcji pokazuje wybrane materiały. Wymagany jest co najmniej jeden wybór.

Istniejące rekordy zostaną przeniesione z pojedynczej wartości do jednoelementowej
tablicy. Przykład:

```text
wełna -> ["wełna"]
mieszanka -> ["mieszanka"]
```

Edycja dawnego rekordu z wartością `mieszanka` pozwoli użytkowniczce zastąpić
ją faktycznymi składnikami, jeżeli są znane.

## Model wymagań dopasowania

Wymagania pozostają w kolumnie JSON `matching_requirements`. Nie powstaje duża
grupa nowych tabel. Każdy rozmiar i każda alternatywna włóczka są zapisane jako
osobny, płaski wariant. Ogranicza to złożoność algorytmu i nadal pozwala
odwzorować źródło bez utraty informacji.

Nowy dokument ma wersję `2`:

```json
{
  "version": 2,
  "variants": [
    {
      "id": "M-safran",
      "label": "M — DROPS Safran",
      "size": "M",
      "yarn_option": "DROPS Safran",
      "requirements": [
        {
          "role": "włóczka główna",
          "measurement_basis": "meters",
          "meters_min": 800,
          "grams_min": 250,
          "skeins_min": 5,
          "materials": ["bawełna"],
          "material_match": "all",
          "color_mode": "same",
          "weight_classes": ["sport"]
        }
      ]
    }
  ]
}
```

### Zasady ilości

- `measurement_basis` ma wartość `meters` albo `grams`.
- Pole wskazane przez `measurement_basis` jest wymagane i służy do oceny
  wykonalności.
- Pozostała jednostka i liczba motków są opcjonalnymi informacjami
  prezentowanymi użytkowniczce.
- Każda ilość może mieć końcówkę `_min` i opcjonalnie `_max`.
- Wariant musi mieć przynajmniej jedno wymaganie.
- Brakująca jednostka nie jest automatycznie zgadywana.
- Jeżeli metry można jednoznacznie obliczyć z liczby motków i nawoju, trafiają
  do danych jako wartość obliczona, a źródłowe gramy i motki pozostają widoczne.

### Zasady materiałów

- `material_match: "all"` wymaga wszystkich wymienionych składników.
- `material_match: "any"` wymaga przynajmniej jednego z wymienionych
  składników.
- `material_match: "any_material"` nie ogranicza materiału; tablica
  `materials` jest wtedy pusta.
- Każda nazwa materiału musi pochodzić ze wspólnej listy.

### Role, kolory i nitki trzymane razem

Każdy kolor lub rodzaj włóczki jest osobnym elementem `requirements`.
Algorytm nie może wykorzystać tego samego fizycznego motka jednocześnie do
dwóch różnych ról.

Domyślnie motki łączone w obrębie jednej roli muszą mieć tę samą nazwę koloru
po pominięciu wielkości liter i zbędnych spacji. `color_mode: "any"` pozwala
łączyć różne kolory tylko wtedy, gdy wzór wprost dopuszcza resztki lub
dowolną kompozycję. Opcjonalne `distinct_color_group` wymaga różnych kolorów
dla ról takich jak kolor główny i kolory kontrastowe.

Opcjonalne `held_together_group` łączy role, które we wzorze są przerabiane
razem. Pole służy do poprawnego opisu wyniku; każda nitka nadal musi osobno
spełniać swoje wymaganie ilościowe.

## Dopasowanie

1. Dla każdej roli wybierane są motki o zgodnej grubości i materiałach.
2. W obrębie roli sumowana jest jednostka wskazana przez
   `measurement_basis`.
3. Rola jest spełniona po osiągnięciu wartości minimalnej.
4. Wszystkie role wariantu muszą być spełnione bez ponownego użycia tego
   samego rekordu magazynu.
5. W wynikach pokazujemy nazwę wzoru, rozmiar, alternatywną włóczkę oraz
   spełnione wymagania każdej roli.
6. Zakres `_min`–`_max` jest prezentowany użytkowniczce, ale minimalna wartość
   określa, czy projekt może zostać rozpoczęty.

## Pojedynczy formularz nowego motka

Kliknięcie `+ Dodaj motek`:

1. sprawdza, czy istnieje niezapisany nowy formularz;
2. jeśli istnieje, przewija do niego i ustawia kursor w pierwszym polu;
3. jeśli nie istnieje, tworzy dokładnie jeden formularz;
4. po zapisaniu albo anulowaniu ponownie pozwala utworzyć nowy formularz.

Obie drogi wejścia — przycisk w magazynie i przycisk onboardingu — korzystają
z tej samej operacji.

## Pierwszy zestaw rzeczywistych wzorów

Po wdrożeniu mechanizmu zostaną ręcznie odwzorowane i zweryfikowane:

1. `Na Pole Tee` — rozmiary i dwie alternatywne włóczki;
2. `Holly Berry Charity Socks` — włóczka główna i dwa kontrastowe kolory;
3. `Oslo Hat` — rozmiary, alternatywne włóczki i nitki trzymane razem.

Wartości będą pochodziły z PDF-ów lub jednoznacznych obliczeń na podstawie
liczby motków, masy i nawoju podanych w PDF-ie.

## Migracja i bezpieczeństwo danych

Migracja Supabase:

1. zmienia `yarns.material` z tekstu na `yarns.materials` typu `text[]`;
2. opakowuje każdą dotychczasową wartość w jednoelementową tablicę;
3. aktualizuje ograniczenie bazy i funkcję `insert_yarn_with_limit`;
4. zachowuje RLS i dotychczasowe zasady własności danych;
5. aktualizuje walidator `matching_requirements` do wersji 2.

Przed zastosowaniem migracji zdalnie zostaną wykonane testy lokalne,
sprawdzenie zgodności migracji i osobna prośba o zgodę właścicielki produktu.

## Weryfikacja

- testy modułu wspólnych materiałów;
- testy walidacji wejścia API;
- test zachowania dotychczasowych materiałów podczas migracji;
- testy filtrowania wzorów elastycznych;
- testy wariantów, alternatyw, zakresów, wielu ról i nitek razem;
- test regresji wielokrotnego kliknięcia `+ Dodaj motek`;
- pełne `npm run check`;
- kontrola w przeglądarce na komputerze i w widoku mobilnym;
- zapytania kontrolne do Supabase po zatwierdzonej migracji i imporcie.

## Poza zakresem

- wpisywanie procentowego składu włóczki;
- automatyczne rozpoznawanie materiału po nazwie handlowej;
- automatyczne importowanie niejednoznacznych ilości bez ręcznej weryfikacji;
- dopasowanie koloru na podstawie zdjęcia;
- ręczny test NVDA lub VoiceOver.
