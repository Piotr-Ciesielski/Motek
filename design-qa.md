# Design QA — Rysia the Stashbuster

## Źródła

- `Designs/ds1.png` — Schowek
- `Designs/ds2.png` — Dopasowania
- `Designs/ds3.png` — Wzory
- `Designs/ds4.png` — Konto
- `Designs/SPEC-Design.md`

## Sprawdzone warianty

- Desktop 1440 × 1024: cztery widoki, light i dark.
- Tablet 834 × 1194: cztery widoki.
- Mobile 390 × 844: cztery widoki.
- Konto wylogowane; pozostałe widoki i Konto zalogowane z lokalnymi danymi demonstracyjnymi przechowywanymi wyłącznie w pamięci przeglądarki.
- Nawigacja, przełączanie motywu, zwijane alternatywy, filtry, karta główna, aktywny projekt i mapa włóczek.

## Wynik porównania

- Hierarchia, typografia, paleta i asymetryczne arkusze odpowiadają wybranym mockom.
- Schowek zachowuje jeden detal i maksymalnie osiem reprezentatywnych motków.
- Dopasowania mają jeden dominujący wynik i zwarte, natywnie zwijane alternatywy.
- Wzory mają wyszukiwanie przed filtrami, jedną dominantę i trzy lekkie kolejne karty.
- Konto ma jeden arkusz i jeden kadr kota w obu stanach.
- Brak poziomego przepełnienia na 390 px, 834 px i 1440 px.
- Konsola nie zgłosiła błędów renderowania w sesji z danymi demonstracyjnymi.
- Sekcja G i zdjęcia wzorów zostały świadomie pominięte.

## Pozostałe uwagi

- Statyczny podgląd bez backendu pokazuje oczekiwany komunikat o braku połączenia na ekranie logowania.
- Pełne zachowanie sieciowe i bezpieczeństwo są weryfikowane przez testy automatyczne, nie przez dane demonstracyjne.

final result: passed
