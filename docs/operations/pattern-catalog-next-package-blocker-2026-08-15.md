# Kolejny pakiet katalogu wzorów — punkt pracy 2026-08-15

## Stan po imporcie stagingowym i benchmarku

Pierwszy pakiet katalogu został zweryfikowany i zaimportowany do Motek
Staging. Obejmuje trzy wzory z potwierdzonymi wymaganiami dopasowania:

- Holly Berry Charity Socks,
- Na Pole Tee,
- Oslo Hat.

Staging ma obecnie 111 rekordów: 3 `published`, 103 `hidden` oraz 5
`pending_review` będących testowymi fixture'ami `test-motek-*`. Katalog jest
dostępny w aplikacji, a ekran dopasowania poprawnie odrzuca aktualny magazyn,
ponieważ nie spełnia wymagań żadnego z trzech wzorów.

## Blokada kolejnego pakietu

Lokalne dane zawierają nazwy 106 źródeł, ale w repozytorium nie ma fizycznych
plików PDF do ponownego odczytu. W `data/patterns-import.json` tylko 3 rekordy
mają kompletne warianty w `matching_requirements`; pozostałe 103 rekordy nie
mają danych, na podstawie których można bezpiecznie wyliczyć metry, gramy,
role, materiały, kolory i alternatywy.

Nie publikujemy tych rekordów na podstawie samej nazwy pliku ani nie tworzymy
syntetycznych wymagań. Takie działanie mogłoby pokazać użytkownikowi błędne
dopasowania i naruszyć zasadę publikowania wyłącznie zweryfikowanych treści.

## Następny krok

Step 1 planu C4 / Task 12 pozostaje otwarty: trzeba wskazać następną małą
partię wzorów oraz dostarczyć dla niej źródło możliwe do audytu — plik PDF albo
oficjalną stronę autora/wydawcy. Dopiero potem można wykonać lokalny audyt,
`npm run patterns:check` i przygotować osobny pakiet importu stagingowego.

Do tego czasu nie zmieniamy 103 rekordów `hidden` ani 5 stagingowych fixture'ów
`pending_review`.

## Pozostałe blokady planu

- C5 jest zamknięte decyzją o pozostawieniu synchronicznego rankingu; pomiar
  nie uzasadnił workera ani kolejki.
- Production nadal pozostaje `NO-GO`: legal-readiness, dokładny release,
  ochrona katalogu anonimowego, backup/restore oraz dowody infrastruktury nie
  tworzą jeszcze kompletnej bramki promocji.
- RLS i cleanup legacy RPC pozostają osobnym zadaniem bezpieczeństwa; nie
  wykonano ich ad hoc.

