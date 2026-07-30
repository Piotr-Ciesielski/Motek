# Design QA — pięć kierunków Motka

## Zakres porównania

- Stan: `Magazyn włóczek`, dane demonstracyjne: 8 włóczek i 12 wzorów.
- Źródła prawdy wizualnej:
  - `design-references/01-atelier.png`
  - `design-references/02-nordic.png`
  - `design-references/03-forest.png`
  - `design-references/04-color.png`
  - `design-references/05-night.png`
- Zrzuty implementacji:
  - `design-references/final/motek-01-atelier-desktop.png`
  - `design-references/final/motek-02-nordic-desktop.png`
  - `design-references/final/motek-03-forest-desktop.png`
  - `design-references/final/motek-04-color-desktop.png`
  - `design-references/final/motek-05-night-desktop.png`
  - `design-references/final/motek-01-atelier-mobile.png`
  - `design-references/final/motek-02-nordic-mobile.png`
  - `design-references/final/motek-03-forest-mobile.png`
  - `design-references/final/motek-04-color-mobile.png`
  - `design-references/final/motek-05-night-mobile.png`

## Normalizacja

- Desktop: viewport CSS `1912 × 943`, `devicePixelRatio: 1`; zapisany obraz ma `1897 × 936` px po odjęciu obszaru pasków przewijania przeglądarki.
- Mobile: viewport CSS `390 × 844`, `devicePixelRatio: 1`; zapisany obszar strony ma `375 × 812` px.
- Źródła mają `1487 × 1058` px, z wyjątkiem Nordic `1536 × 1024` px.
- Do pełnego porównania źródło i implementacja zostały umieszczone obok siebie, bez rozciągania, na płótnie `2880 × 1060` px:
  - `design-references/final/comparisons/01-atelier-comparison.png`
  - `design-references/final/comparisons/02-nordic-comparison.png`
  - `design-references/final/comparisons/03-forest-comparison.png`
  - `design-references/final/comparisons/04-color-comparison.png`
  - `design-references/final/comparisons/05-night-comparison.png`

## Powierzchnie zgodności

- Typografia: Atelier, Leśna Pracownia i Nocny Motek używają mocnego kroju szeryfowego dla tytułów; Nordic i Koloroterapia mają geometryczny, bezszeryfowy charakter. Hierarchia, zawijanie i wysokości wierszy są czytelne na obu szerokościach.
- Rytm i układ: Atelier zachowuje spokojny, poziomy hero; Nordic ma uporządkowany magazyn z prawą szyną graficzną; Leśna Pracownia ma stały boczny panel; Koloroterapia ma asymetryczną kompozycję; Nocny Motek ma zwartą, wysokokontrastową pracownię.
- Kolory: pięć osobnych zestawów tokenów odwzorowuje palety źródłowe. Stany aktywne, obramowania i przyciski używają właściwego akcentu, a tekst pozostaje czytelny.
- Grafiki: pięć osobnych obrazów PNG `1448 × 1086` px; brak emoji, rysunków CSS, atrap i własnych SVG. Wszystkie obrazy mają tekst alternatywny.
- Treść: polskie etykiety, realistyczne marki, materiały, grubości, długości i projekty dziewiarskie. Teksty są spójne z samodzielnym prototypem Motka.
- Ikony: jeden zestaw Lucide, spójna grubość linii i rozmiar; ikona niedostępna w przypiętej wersji biblioteki została zastąpiona obsługiwanym odpowiednikiem.

## Historia porównań i poprawek

### Iteracja 1 — wynik zablokowany

- [P1] Cztery kierunki miały zbyt podobną, poziomą kompozycję hero, a magazyn znajdował się zbyt nisko względem wzorców.
  - Dowód: pierwsze porównania Nordic, Forest, Color i Night.
  - Poprawka: osobne siatki desktopowe; prawa szyna graficzna obejmuje teraz hero, podsumowanie i widoczną część magazynu, a Leśna Pracownia zachowuje własny sidebar.
- [P2] W wysokich szynach część kotów była przycięta.
  - Dowód: pierwsze zrzuty po zmianie siatek.
  - Poprawka: kierunkowe kadrowanie obrazów (`72%` dla Nordic, prawa krawędź dla Forest, Color i Night).
- [P2] Mobilne reguły pozostawiały ukrytą drugą kolumnę, przez co tekst i grafika były ściśnięte.
  - Dowód: wczesne zrzuty mobilne Nordic i Forest.
  - Poprawka: przy szerokości do `980px` hero wraca do jednej kolumny, a grafika jest umieszczana pod treścią.

### Iteracja 2 — wynik pozytywny

- Dowód pełnego widoku: pięć aktualnych plików `design-references/final/comparisons/*-comparison.png`.
- Dowód obszarów wymagających zbliżenia: pięć aktualnych zrzutów mobilnych; przy tej szerokości tytuły, przyciski, kadry i dolna nawigacja są wystarczająco duże do bezpośredniej oceny.
- Brak aktywnych problemów P0, P1 i P2.
- Pozostała różnica akceptowalna: obrazy koncepcyjne pokazują dodatkowe drobne kontrolki tabel, które nie należą do rdzenia mini-prototypu. Działające są wszystkie elementy potrzebne do głównej ścieżki.

## Interakcje i odporność

- Dodanie włóczki: otwarcie formularza, walidacja sześciu wymaganych pól, poprawny zapis i pojawienie się dziewiątej pozycji.
- Dopasowanie: przejście do trzech rekomendacji i otwarcie wybranego wzoru w katalogu.
- Katalog: wyszukiwanie, stan `0 z 12 wzorów`, czytelny stan pusty oraz reset do `12 z 12 wzorów`.
- Mobile: pięć wariantów przy `390 × 844`, brak poziomego przepełnienia, widoczna dolna nawigacja.
- Konsola: 0 błędów i 0 ostrzeżeń we wszystkich pięciu kartach oraz w karcie testu przepływu.

## Ustalenia końcowe

**Findings**

- Brak aktywnych ustaleń P0/P1/P2.

**Open Questions**

- Brak pytań blokujących. Dalszy etap może dotyczyć wyboru jednego kierunku i rozwinięcia go do produkcyjnego design systemu.

**Implementation Checklist**

- [x] Pięć osobnych kierunków i grafik.
- [x] Główna ścieżka Magazyn → Dopasowanie → Katalog.
- [x] Formularz, walidacja, filtry i stan pusty.
- [x] Desktop i mobile.
- [x] Porównania źródło–implementacja.
- [x] Brak błędów konsoli.

**Follow-up Polish**

- [P3] Po wyborze jednego kierunku można dodać bardziej rozbudowane sortowanie i zmianę widoku tabeli.

final result: passed
