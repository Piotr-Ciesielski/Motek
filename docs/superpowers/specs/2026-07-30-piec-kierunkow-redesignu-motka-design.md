# Motek — pięć kierunków redesignu

Data: 2026-07-30

## Cel

Przygotować pięć pełnych, klikalnych mini-prototypów Motka dla użytkowniczek
robiących na drutach i szydełku. Każdy prototyp ma pokazywać ten sam główny
przepływ produktu, ale mieć wyraźnie inny charakter wizualny, układ, kontrast,
typografię i oprawę graficzną.

Prototypy służą wyłącznie do porównania kierunków. Nie zmieniają produkcyjnego
frontendu, backendu, Supabase ani danych użytkowników.

## Użytkowniczka i pożądane odczucie

Główną odbiorczynią jest dziewiarka o wysokiej wrażliwości estetycznej i dobrej
wyobraźni przestrzennej. Interfejs powinien być piękny i inspirujący, ale nadal
pomagać szybko odpowiedzieć na pytanie: „co mogę zrobić z włóczek, które mam?”.

Grafiki włóczek, dzianin i kotów są mile widziane, ale nie mogą utrudniać
skanowania danych, obsługi formularzy ani podejmowania decyzji.

## Wybrane podejście

Powstanie jeden izolowany „design lab” z pięcioma osobnymi wariantami. Wszystkie
warianty użyją wspólnego zestawu realistycznych danych demonstracyjnych i tego
samego modelu interakcji, ale każdy otrzyma własny system wizualny oraz inną
kompozycję kluczowych ekranów.

Każdy wariant będzie dostępny pod osobnym adresem i zostanie otwarty w oddzielnej
karcie Chrome, ponumerowanej od 1 do 5.

## Wspólny zakres funkcjonalny

Każdy prototyp zawiera trzy pełne widoki:

1. **Magazyn** — podsumowanie zapasu, lista motków, dodanie motka, edycja
   przykładowej pozycji i główna akcja „Dobierz wzór”.
2. **Dopasowanie** — podsumowanie użytego zapasu, lista rekomendacji, procent
   dopasowania, warianty rozmiarowe i przejście do wzoru w katalogu.
3. **Katalog** — wyszukiwanie, podstawowe filtry, karty wzorów, stan pusty oraz
   możliwość powrotu do listy po zmianie filtrów.

Nawigacja między tymi widokami działa bez przeładowania strony. Dane są
demonstracyjne i pozostają wyłącznie w pamięci przeglądarki.

## Pięć kierunków

### 1. Atelier

- Paleta: krem, ciepła biel, głębokie bordo i przygaszony róż.
- Charakter: elegancki magazyn redakcyjny i kameralna pracownia.
- Typografia: wyrazisty szeryf dla nagłówków, neutralny krój bezszeryfowy dla
  danych.
- Grafiki: artystyczna fotografia motków i dzianin, subtelny jasny kot jako
  element narracji.
- Układ: duże fotografie, spokojne marginesy, listy danych przypominające
  katalog tkanin.

### 2. Nordic

- Paleta: śnieżna biel, grafit, chłodny błękit i pojedynczy czerwony akcent.
- Charakter: nowoczesna, uporządkowana pracownia skandynawska.
- Typografia: geometryczny krój bezszeryfowy, wysoka czytelność liczb.
- Grafiki: studyjne zdjęcia motków na jasnym tle, minimalistyczny kot.
- Układ: modułowa siatka, dużo przestrzeni, wyraźne metadane i proste separatory.

### 3. Leśna Pracownia

- Paleta: głęboka zieleń, len, miedź, mech i ciepły bursztyn.
- Charakter: przytulna pracownia inspirowana naturą i rękodziełem.
- Typografia: miękki szeryf połączony z czytelnym krojem użytkowym.
- Grafiki: ilustracyjny kot wśród motków, roślin i próbek dzianin.
- Układ: boczna nawigacja, warstwowe powierzchnie oraz wyróżnione rekomendacje.

### 4. Koloroterapia

- Paleta: koral, lawenda, kobalt, morela i złamana biel.
- Charakter: odważny, radosny i kreatywny, bez infantylności.
- Typografia: współczesny krój o mocnych nagłówkach i czytelnych etykietach.
- Grafiki: barwne kompozycje motków, figlarny kot i fragmenty wzorów
  dziewiarskich.
- Układ: asymetryczne moduły, wyraźne plamy koloru i dynamiczne karty.

### 5. Nocny Motek

- Paleta: granatowo-czarne tło, śliwka, złoto i jasny piaskowy tekst.
- Charakter: premium, nastrojowy i wysoko kontrastowy.
- Typografia: elegancki szeryf dla nazw oraz precyzyjny krój bezszeryfowy dla
  parametrów.
- Grafiki: makrofotografie włókien w dramatycznym świetle i czarny kot.
- Układ: ciemne powierzchnie, świetlne akcenty, mocno wyeksponowane wyniki
  dopasowania.

## Wspólne komponenty

- pasek marki i główna nawigacja,
- podsumowanie magazynu,
- wiersz lub karta motka,
- formularz dodawania i edycji,
- karta dopasowania z wynikiem procentowym,
- wariant rozmiaru,
- pasek wyszukiwania i filtry katalogu,
- karta wzoru,
- stan pusty i komunikat błędu,
- mobilna nawigacja i główna akcja.

Komponenty współdzielą dane oraz zachowanie, ale mogą mieć inną kompozycję w
każdym kierunku. Nie należy wymuszać jednego identycznego układu, jeśli osłabiłby
to odrębność wariantu.

## Dane i interakcje

Prototypy wykorzystują realistyczny, stały zestaw:

- osiem motków o różnych kolorach, materiałach, grubościach, długościach i wadze;
- co najmniej trzy rekomendowane wzory z wynikiem dopasowania;
- kilkanaście pozycji katalogu wystarczających do pokazania filtrów;
- przykład pustego wyniku po zawężeniu filtrów.

Dodanie lub edycja motka zmienia dane tylko w bieżącej karcie. Odświeżenie
przywraca stan demonstracyjny. Żadna akcja nie wywołuje API Motka.

## Stany błędów i puste widoki

- Brak wyników filtrów wyjaśnia przyczynę i oferuje wyczyszczenie filtrów.
- Niekompletny formularz wskazuje brakujące pole i nie udaje zapisu.
- Brak dopasowania sugeruje dodanie włóczki lub zmianę magazynu.
- Elementy nieaktywne wyglądają na nieaktywne i nie mają mylącego cienia.

## Responsywność i dostępność

Każdy wariant zostanie sprawdzony w widoku desktopowym około 1440 × 1024 oraz
mobilnym 390 × 844.

Wymagania:

- brak poziomego przewijania,
- czytelny tekst podstawowy i etykiety,
- widoczny fokus klawiatury,
- kontrast tekstu i głównych akcji zgodny co najmniej z WCAG AA,
- elementy dotykowe o wygodnym rozmiarze,
- długie nazwy wzorów nie niszczą układu,
- grafiki mają tekst alternatywny albo są poprawnie oznaczone jako dekoracyjne.

## Grafiki

Każdy kierunek otrzyma niezależnie wygenerowane obrazy dopasowane do
przewidzianych proporcji i palety. Nie będą używane emoji, rysunki z CSS,
placeholdery ani ręcznie tworzone SVG udające docelowe grafiki.

Grafiki powinny wspierać atmosferę produktu. Dane magazynu, parametry motków i
wynik dopasowania pozostają ważniejsze od dekoracji.

## Izolacja od aplikacji produkcyjnej

Design lab powstaje w osobnym katalogu prototypowym. Nie importuje produkcyjnego
`app.js`, nie łączy się z backendem i nie modyfikuje istniejących plików
`index.html`, `styles.css` ani danych Supabase.

Wspólna warstwa danych demonstracyjnych i logiki nawigacji zostanie oddzielona
od pięciu modułów wizualnych. Dzięki temu można porównywać stylistykę bez pięciu
rozbieżnych implementacji zachowania.

## Weryfikacja

Każdy wariant przejdzie:

1. uruchomienie lokalnego podglądu,
2. przejście Magazyn → Dopasowanie → Katalog,
3. sprawdzenie formularza i filtrów,
4. kontrolę stanów pustych,
5. zrzut ekranu desktopowego i mobilnego,
6. kontrolę przepełnień, odstępów, typografii, obrazów i kontrastu,
7. sprawdzenie konsoli przeglądarki.

## Kryteria akceptacji

- Dostępnych jest pięć pełnych i wyraźnie różnych mini-prototypów.
- Każdy zawiera trzy wymagane widoki oraz działający główny przepływ.
- Każdy używa własnej palety, kontrastu, kompozycji, typografii i grafik.
- Włóczki i koty występują w oprawie wizualnej bez obniżenia czytelności.
- Wszystkie warianty działają na desktopie i telefonie.
- Produkcyjny Motek i dane użytkowników pozostają niezmienione.
- Pięć ponumerowanych wersji jest otwartych w osobnych kartach Chrome.

## Decyzja po przeglądzie prototypów — 2026-07-30

Do dalszego rozwoju wybrane zostały dwa kierunki:

1. **4 — Koloroterapia** (`color`)
2. **5 — Nocny Motek** (`night`)

Kierunki 1–3 pozostają materiałem referencyjnym. Kolejne prace powinny
koncentrować się na rozwijaniu i porównywaniu kierunków 4 i 5. Na tym etapie
nie wskazano jednego ostatecznego zwycięzcy.
