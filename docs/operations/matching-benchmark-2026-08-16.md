# Benchmark dopasowania wzorów — 2026-08-16

## Cel

Sprawdzono, czy obecny algorytm dopasowania wymaga osobnego workera, kolejki
lub dodatkowej infrastruktury przy limitach Motka. Benchmark był lokalny,
syntetyczny i nie korzystał z Supabase, Railway ani danych użytkowników.

Limity wejściowe:

- 500 włóczek;
- 300 wzorów;
- maksymalnie 8 wymagań ról;
- limit wyszukiwania `25 000` węzłów.

## Scenariusz typowy

Każdy z 300 wzorów miał trzy role, po jednym zgodnym motku na rolę. Magazyn
zawierał 500 włóczek rozłożonych na cztery materiały i cztery klasy grubości.

Wynik:

- wszystkie 300 wzorów otrzymało wykonalne dopasowanie;
- czas całkowity: około `2,43 s`;
- średnio: około `8,1 ms` na wzór;
- wzrost RSS procesu w trakcie scenariusza: około `4,9 MB`.

## Scenariusz skrajny

Jedno żądanie miało osiem ról, każda wymagała 100 włóczek, a wszystkie 500
włóczek spełniało kryteria. Uruchomiono 10 powtórzeń.

Wynik:

- `10/10` prób zakończyło się kontrolowanym błędem limitu złożoności `503`;
- czas całkowity: około `7,69 s`;
- średnio: około `770 ms` na próbę;
- wzrost RSS procesu po serii: około `40,5 MB`.

Wartość RSS jest obserwacją procesu testowego, a nie ścisłym kosztem jednego
żądania. Wynik potwierdza jednak, że limit węzłów ogranicza koszt skrajnego
przypadku zamiast pozwalać na nieograniczone przeszukiwanie.

## Decyzja

Przy obecnych limitach i typowym scenariuszu nie ma dowodu, że Motek potrzebuje
workera, kolejki, Redis ani funkcji Edge. Zachowujemy prostą architekturę.

Worker lub kolejka wracają do planu dopiero, gdy pojawi się jeden z mierzalnych
sygnałów:

- regularne przekraczanie limitu złożoności przez prawidłowe dane;
- czasy odpowiedzi typowych żądań przekraczające zaakceptowany próg;
- większy katalog lub magazyny ponad obecne limity;
- powtarzalne problemy z pamięcią lub konkurencją żądań.

Benchmark nie zastępuje testu obciążeniowego produkcji. Nie wykonywano testów
obciążeniowych na stagingu ani produkcji.
