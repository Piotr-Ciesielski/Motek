# Audyt danych katalogu wzorów

Data zakończenia: 2026-07-30

## Wynik

- przeanalizowano 116 plików PDF z lokalnego folderu `Wzory`,
- 103 pliki reprezentują samodzielne wzory w katalogu,
- 13 plików świadomie wykluczono,
- katalog zawiera dodatkowo 3 rekordy demonstracyjne,
- Supabase zawiera łącznie 106 rekordów,
- każdy rekord ma potwierdzony materiał albo jawne oznaczenie dowolnego materiału,
- żaden rekord nie jest oznaczony jako wymagający dalszej weryfikacji.

## Jak interpretowano dane

Informacje odczytywano z tekstu PDF, tabel, legend i stron graficznych. W
przypadkach, w których wzór podawał nazwę handlową włóczki bez pełnego składu
lub nawoju, parametry potwierdzano w katalogu producenta. Nie otwierano ani nie
wykorzystywano kodów dostępu.

W danych rozróżniono trzy poprawne sytuacje:

1. jeden jednoznaczny motek z długością, wagą i materiałem,
2. kilka włóczek alternatywnych, z których każda ma własne parametry,
3. elastyczny dobór włóczki, gdy autor świadomie pozwala użyć resztek, łączyć
   nitki albo dobrać dowolny materiał do próbki.

W drugim i trzecim przypadku pole zbiorcze `meters_per_100g` może pozostać
puste. Szczegóły są wtedy zapisane w `yarn_requirements`; nie jest to brak
danych.

## Pliki wykluczone

### Instrukcja techniczna

- `48121b_76193f9fc7a34173bf81ea1ae1c28b28.pdf`

### Kupony z kodem dostępu, a nie samodzielne wzory

- `Basic Kardigan Kod Dostępu.pdf`
- `Kardigan All Day Long Kod Dostępu.pdf`
- `Kardigan Simple as That Kod Dostępu.pdf`
- `Kardigan_20no_201_20Kod_20Dost_C4_99pu.pdf`

### Kopie identycznych plików

- `HAPPY-TRIO-SWEATER-Tkane-na-okraglo-Wzor-na-druty-exxadt(1).pdf`
- `Kopia pliku SweetTreatsSocks_NBielińska(1).pdf`
- `Kopia pliku SweetTreatsSocks_NBielińska.pdf`
- `Sweter_Kikimora_Moracraft(1).pdf`

### Starsze albo powielone wersje

- `BIG-BIG-BUBBLES-WZOR-INSTRUKCJA-WYKONANIA06.23-tbto93.pdf`
- `Diamond Fade Socks.pdf`
- `Teddy Bear Socks - wzór PL (ang skróty).pdf.pdf`

### Plik pomocniczy do wzoru

- `You Make Me (W)hole Cardigan - Schematy.pdf`

Pliki pozostały w lokalnym folderze `Wzory`; wykluczenie dotyczy wyłącznie
rekordów katalogu aplikacji.

## Kontrola po imporcie

Po aktualizacji Supabase potwierdzono:

- 106 rekordów w tabeli `patterns`,
- 0 rekordów `needs_review`,
- 0 rekordów bez materiału,
- 0 wykluczonych plików pozostawionych w tabeli.

Osobno sprawdzono przykłady reprezentujące trudniejsze przypadki:

- `Na Pole Tee` zachowuje dwie alternatywy: bawełnę 160 m / 50 g oraz mieszankę
  bawełny z bambusem 125 m / 50 g,
- `Penguono` zachowuje elastyczny dobór włóczek z zapasów i ilość podaną w
  gramach, bez wymyślania jednego nawoju.

## Dalszy krok

Parametry włóczek są kompletne na potrzeby prezentacji katalogu. Oddzielnym
zadaniem pozostaje uzupełnienie zużycia dla konkretnych rozmiarów i wariantów
tych wzorów, które mają uczestniczyć w automatycznym dopasowaniu do magazynu.
