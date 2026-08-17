# Pakiet GO/NO-GO dla promocji do produkcji — 2026-08-17

## Aktualny werdykt

**NO-GO.** Produkcja nie jest jeszcze zmieniana. Staging i produkcja są
jedynymi środowiskami Supabase; nie tworzymy płatnego brancha ani kopii.

## Zakres planowanej promocji

- docelowy artefakt aplikacji: stagingowy commit
  `d7409a408351dc0a8f78f53eb5861c3db6eca627`;
- Pakiet A: `supabase/production-deltas/20260816_add_pattern_publication_audit_compatible.sql`;
- Pakiet B: brak osobnej migracji — legal i rejestracja mają zgodny efekt;
- Pakiet C: brak migracji recovery — utrzymujemy aktywny kontrakt `jti_hash`;
- nie promujemy całego łańcucha migracji stagingu ani danych katalogu.

## Obowiązkowa kolejność w oknie produkcyjnym

1. Potwierdzić świeży backup produkcji i możliwość jego odtworzenia.
2. Wykonać Pakiet A na produkcji; transakcja ma zakończyć się poprawnie.
3. Wdrożyć dokładnie wskazany artefakt aplikacji.
4. Wykonać smoke testy API, logowania, legal/rejestracji, katalogu, magazynu
   i recovery.
5. Obserwować system przez 30 minut z właścicielem alertów.

Nie wdrażamy backendu przed Pakietem A, ponieważ nowy kod filtruje katalog po
`publication_status` i pobiera `official_source_url`.

## Warunki wejścia GO

- organizacja Supabase jest na planie Free, więc wymagany backup musi być
  logicznym eksportem CLI przechowanym poza Supabase; eksport schematu i danych
  został wykonany lokalnie i nie jest śledzony przez Git;
- precondition Pakietu A: produkcyjne `public.patterns` istnieje, ma kolumnę
  `description` i nie zawiera wartości NULL — odczyt read-only potwierdził
  obecnie 15 rekordów i 0 NULL;
- lokalny test reprezentatywnego fixture: **1/1**;
- testy projektu przed promocją: `399/399`, staging: `17/17`, Railway: `3/3`;
- znane różnice legal/rejestracji i recovery są opisane i nie wymagają
  dodatkowej migracji;
- potwierdzona zgoda na pozostawienie celowych RPC backendowych bez zmian;
- potwierdzony backup, rollback, właściciel alertów i 30-minutowe okno.

## Warunki STOP

Zatrzymujemy operację bez dalszych zmian, jeśli:

- Pakiet A nie spełni precondition albo transakcja nie zakończy się sukcesem;
- po wdrożeniu aplikacji wystąpi błąd zapytania katalogu lub regresja auth/legal;
- nie ma potwierdzonego backupu, właściciela alertów albo okna obserwacji;
- nie da się szybko cofnąć artefaktu aplikacji do poprzedniego commitu.

## Rollback

Podstawowy rollback to cofnięcie artefaktu aplikacji do poprzedniego commitu
przy pozostawieniu dodatnich kolumn Pakietu A. Stary backend ich nie odczytuje,
więc nie kasujemy danych audytowych przez zwykłe cofnięcie kodu. Usuwanie
kolumn nie jest zwykłym rollbackiem; pełne odtworzenie bazy z backupu wymaga
osobnej procedury awaryjnej i zgody.

## Decyzje nadal wymagające zamknięcia

1. Pełny test restore danych nie został wykonany; zaakceptowano logiczny backup
   i związane z tym ryzyko.
2. Osobna, jawna zgoda na wykonanie SQL Pakietu A i deploy produkcyjny.

Wyłączona ochrona Supabase przed wyciekłymi hasłami pozostaje świadomie
zaakceptowanym ryzykiem i nie blokuje tego pakietu.

Ten dokument nie jest zgodą na wykonanie SQL ani wdrożenie.
