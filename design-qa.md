# Design QA — checkpoint ds1

## Porównanie

- Źródło wizualne: `D:\Projekty\Motek\Designs\ds1.png`.
- Źródło: 1488 × 1058 px, dwa warianty motywu obok siebie; aplikacja pokazuje jeden motyw naraz.
- Docelowy viewport implementacji: 1440 × 1024 CSS px, device scale factor 1.
- Stan: zalogowany użytkownik, widok „Moje włóczki”, mapa ośmiu reprezentatywnych motków.
- Screenshot implementacji: niedostępny.

## Wykonana zmiana

- Tytuł „Mój schowek” i podsumowanie zostały przeniesione do redakcyjnego hero.
- Usunięto widoczną, zdublowaną akcję „Dobierz wzór”.
- „Pokaż cały schowek” jest akcją w górnej części widoku.
- Kot, mapa motków, pojedynczy arkusz szczegółów i węzeł dodawania tworzą jedną kompozycję.
- Zachowano produkcyjne hooki, obsługę danych, oba motywy i pionową ścieżkę mobilną.

## Bramka wizualna

Nie wykonano prawidłowego porównania obrazu referencyjnego z renderem. Wbudowana przeglądarka zablokowała lokalne adresy `127.0.0.1`, `localhost` oraz adres LAN, a połączenie z Chrome nie jest dostępne. Zgodnie z procedurą nie zastępuję tego oceną samego kodu ani testami DOM.

Do sprawdzenia po otrzymaniu renderu:

- font i zawijanie nagłówka;
- proporcje hero oraz kadrowanie kota;
- położenie motków, nici i arkusza;
- kolory oraz czytelność obu motywów;
- zawartość pierwszego kadru przy 1440 × 1024;
- pionowy układ przy 390 × 844.

## Sprawdzenia bez obrazu

- Kontrakt DOM ds1: przechodzi.
- Chronione akcje i hooki aplikacji: przechodzą.
- Screenshot, konsola i interakcje w przeglądarce: zablokowane.

final result: blocked
