# Benchmark dopasowania Motka — 2026-08-15

## Zakres

Pomiar obejmował syntetyczny magazyn 500 motków, katalog 300 wzorów oraz
rzeczywisty globalny limit 250 wariantów dopasowania na żądanie.

## Wynik

- wykonano 250 wywołań `matchVariant`,
- czas: około `655 ms`,
- wzrost użycia sterty: około `3,27 MB`,
- wszystkie warianty w scenariuszu testowym zakończyły się poprawnie,
- nie wystąpił limit złożoności ani błąd pamięci.

## Decyzja

Przy obecnych limitach synchroniczna ścieżka dopasowania jest wystarczająca.
Worker ani kolejka nie są potrzebne. Pomiar należy powtórzyć dopiero po
zwiększeniu limitu wariantów albo zmianie algorytmu alokacji.

Test 75 000 wywołań wykonany pomocniczo jako stres-test trwał około 95,6 s;
nie jest to scenariusz produkcyjny, ponieważ endpoint ogranicza pojedyncze
żądanie do 250 wariantów.
