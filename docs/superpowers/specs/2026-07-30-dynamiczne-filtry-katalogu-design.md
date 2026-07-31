# Dynamiczne filtry i kategorie katalogu wzorów

**Status:** wdrożone i zweryfikowane w aplikacji oraz testach.

Data: 2026-07-30

## Cel

Filtry katalogu mają zwracać wyłącznie wzory spełniające wszystkie aktywne
kryteria. Dostępne wartości typu projektu i materiału mają zmieniać się
dynamicznie, aby odzwierciedlać rzeczywiste kombinacje występujące w katalogu.

## Zdiagnozowany problem

Sama funkcja filtrowania łączy kryteria operatorem logicznym „i”. Główną
przyczyną błędnych wyników są nieprawidłowe kategorie w danych.

Generator zachowuje kategorię rozpoznaną na wczesnym etapie z nazwy pliku PDF.
Nie wylicza jej ponownie po zastosowaniu ręcznie poprawionej nazwy i opisu.
Dlatego jednoznaczne topy, skarpety i kardigany mogą pozostawać w kategorii
„Inny projekt”.

Drugi problem użyteczności polega na tym, że listy filtrów są statyczne.
Pozwalają wybierać typy i materiały, które nie występują razem, bez pokazania
użytkownikowi, które kombinacje mają wyniki.

## Zachowanie docelowe

1. Wynik spełnia równocześnie wyszukiwaną frazę, status danych, język, typ
   projektu i materiał.
2. Wzór zawierający kilka materiałów jest dostępny pod każdym z nich.
3. Opcje typu projektu są wyliczane z uwzględnieniem pozostałych aktywnych
   filtrów, ale bez ograniczania ich aktualnie wybranym typem.
4. Opcje materiału są wyliczane analogicznie — z uwzględnieniem pozostałych
   filtrów, ale bez ograniczania aktualnie wybranym materiałem.
5. Każda opcja typu i materiału pokazuje liczbę pasujących wzorów.
6. Opcje bez wyników są nieaktywne. Aktualnie wybrana opcja pozostaje widoczna,
   nawet jeśli zmiana frazy, języka lub statusu obniży jej wynik do zera.
7. Zmiana dowolnego filtra natychmiast aktualizuje wyniki, liczniki i pozostałe
   opcje.
8. „Wyczyść filtry” przywraca domyślne wartości i pełny zestaw dostępnych opcji.

## Poprawa kategorii

Kategoria będzie wyliczana na podstawie końcowej, scalonej nazwy i opisu wzoru.
Wczesna kategoria automatyczna nie będzie blokowała ponownego rozpoznania po
ręcznej korekcie danych.

Jawny `project_type` zapisany w ręcznej poprawce pozostaje nadrzędny. Dzięki temu
niejednoznaczne wzory można sklasyfikować świadomie bez walki z automatycznym
rozpoznawaniem.

Po przebudowaniu danych zostanie sprawdzony rozkład wszystkich kategorii oraz
lista wzorów nadal oznaczonych jako „Inny projekt”. Jednoznaczne pomyłki zostaną
poprawione ręcznie.

## Podział odpowiedzialności

- `scripts/build-pattern-import.py` odpowiada za wybór ręcznej albo ponownie
  wyliczonej kategorii.
- `scripts/pattern_taxonomy.py` odpowiada wyłącznie za rozpoznawanie typu z
  tekstu.
- `client-policy.js` otrzyma czyste funkcje filtrowania i budowy dostępnych
  opcji. Dzięki temu zachowanie będzie testowane bez przeglądarki.
- `app.js` pozostanie odpowiedzialny za odczyt kontrolek, renderowanie kart i
  aktualizowanie list wyboru.

## Testy

Testy automatyczne obejmą:

- połączenie typu projektu i materiału operatorem „i”,
- dostępność wzoru wielomateriałowego pod każdym materiałem,
- dynamiczne liczniki typu i materiału,
- wyłączenie kombinacji bez wyników,
- zachowanie aktywnej opcji z wynikiem zero,
- ponowne wyliczenie kategorii po poprawieniu nazwy i opisu,
- pierwszeństwo ręcznie ustawionej kategorii,
- charakterystyczne wzory z każdej używanej kategorii.

Test w przeglądarce obejmie co najmniej:

- sam filtr „Topy i bluzki”,
- kombinację „Topy i bluzki” z dostępnym materiałem,
- wzór zawierający kilka materiałów,
- dynamiczną zmianę liczników po zmianie typu i materiału,
- przywrócenie katalogu przez „Wyczyść filtry”.

## Dane i Supabase

Po lokalnej walidacji zostanie zbudowany nowy plik importowy. Aktualizacja
Supabase zmieni istniejące rekordy katalogu; nie doda ani nie usunie wzorów.
Przed wykonaniem importu zostanie pokazane podsumowanie zmian i poproszona
osobna zgoda na modyfikację zdalnej bazy.

## Kryteria zakończenia

- lokalny katalog i Supabase zawierają tę samą liczbę rekordów,
- filtry typu i materiału pokazują poprawne, dynamiczne liczby,
- wyniki spełniają wszystkie aktywne kryteria,
- wzory wielomateriałowe są dostępne pod każdym ze swoich materiałów,
- wszystkie testy automatyczne przechodzą,
- zachowanie jest potwierdzone w działającej aplikacji.
