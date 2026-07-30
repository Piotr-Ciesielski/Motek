# QA — mini-prototypy Motka

## Automatyczne sprawdzenia

- `npm test`: 10/10 testów.
- `npm run build`: produkcyjny build Vite utworzony poprawnie.
- `npm run test:sites`: 4/4 testy pakietu podglądu.

## Sprawdzone zachowania

- Każdy parametr `?variant=` wybiera właściwy numer, nazwę, paletę, układ i grafikę.
- Magazyn startuje z ośmioma realistycznymi włóczkami.
- Formularz dodawania pokazuje czytelne błędy i zapisuje poprawne dane.
- Nawigacja przechodzi między Magazynem, Dopasowaniem i Katalogiem.
- Karta rekomendacji otwiera właściwy wzór w katalogu.
- Wyszukiwanie katalogu pokazuje stan pusty i można je wyczyścić.
- Wszystkie pięć wariantów działa przy `390 × 844` bez poziomego przepełnienia.
- Dolna nawigacja mobilna pozostaje widoczna i nie zasłania głównych przycisków.
- Pięć kart ma tytuły od `1 — Atelier — Motek` do `5 — Nocny Motek — Motek`.
- Konsola przeglądarki: 0 błędów i 0 ostrzeżeń.

## Dowody wizualne

- Zrzuty desktopowe i mobilne: `design-references/final/`.
- Porównania źródło–prototyp: `design-references/final/comparisons/`.
- Szczegółowy raport: `design-qa.md`.
