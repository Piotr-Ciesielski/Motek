# Mapa efektów migracji Production — 2026-08-17

## Zasada

Nie promujemy numerów migracji stagingu. Promujemy wyłącznie jawnie opisany
efekt SQL, po precondition, teście na izolowanym celu, backupie i planie
rollbacku. Ten dokument nie jest zgodą na wykonanie SQL ani wdrożenie.

## Mapa zakresu

| Obszar | Efekt stagingu | Stan produkcji | Decyzja |
|---|---|---|---|
| Publikacja katalogu | `publication_status`, audyt treści, źródło oficjalne i constraint publikacji | `public.patterns` nie ma tych pól; 15 rekordów, 0 pustych opisów | Przygotować i przetestować osobny pakiet kompatybilny z `description NOT NULL`; nie replayować migracji stagingu |
| Dane katalogu | 111 rekordów, 103 puste opisy, 3 `published`, 5 `pending_review`, 103 `hidden` | 15 rekordów bez pustych opisów | Nie przenosić danych ani statusów stagingu w ramach promocji kodu |
| Legal / rejestracja | wersjonowane dokumenty, akceptacje, zaproszenia, próby rejestracji i service-only RPC | ten sam efekt tabel, RPC, polityk oraz wersji `terms=1.0`, `privacy=1.0` | Nie tworzyć migracji legal; sprawdzić wyłącznie zgodność artefaktu aplikacji i testy po deployu |
| Recovery | aktywny kontrakt `jti_hash`, `claimed_at`, claim/release/consume | ten sam kształt tabeli i aktywnych RPC | Nie wykonywać migracji recovery; zmapować tylko stagingowy wpis `restore_recovery_grant_creator` i jego właściciela |
| Versioned yarn store | `user_id`, `version`; backend używa wersjonowanych RPC | dodatkowo `updated_at NOT NULL DEFAULT now()` | Zachować produkcyjną kolumnę; nie wykonywać destrukcyjnego ujednolicania |
| Legacy yarn RPC | brak `insert_yarn_with_limit` w stagingu | dwa overloady w produkcji | Nie usuwać bez potwierdzenia zewnętrznych konsumentów; pozostawić jako osobny cleanup |
| Auth/UI routing | natychmiastowy Magazyn i brak migotania bramy prawnej | produkcja ma starszy artefakt aplikacji, ale backend legal jest zgodny | Promować razem z pakietem kodu i kompatybilnym pakietem katalogu |

## Pakiety i zależności

### Pakiet A — katalog

Istnieje `supabase/production-deltas/20260816_add_pattern_publication_audit_compatible.sql`.
Pakiet zachowuje `description NOT NULL`, ustawia bezpieczny stan początkowy i
ma precondition blokujący dane z pustym opisem. Read-only odczyt produkcji
potwierdził, że ten konkretny precondition danych jest obecnie spełniony.

Przed wykonaniem nadal wymagane są: test lokalny na reprezentatywnych danych,
pgTAP, backup, rollback oraz osobna zgoda na SQL produkcyjny. Nie tworzymy
płatnego brancha ani kopii Supabase.

Kolejność jest obowiązkowa: `server.js` filtruje katalog po
`publication_status` i pobiera `official_source_url`, więc wdrożenie nowego
backendu przed zastosowaniem kompatybilnego efektu Pakietu A może zakończyć się
błędem zapytania do produkcyjnego `public.patterns`.

Plan rollbacku: jeśli smoke po wdrożeniu kodu nie przejdzie, najpierw cofamy
artefakt aplikacji do poprzedniego commitu i pozostawiamy dodatnie kolumny
Pakietu A. Stary backend ich nie odczytuje, więc taki rollback nie kasuje
nowych danych audytowych. Nie usuwamy kolumn w ramach zwykłego rollbacku;
pełne odtworzenie bazy z backupu jest osobną procedurą awaryjną i wymaga
wcześniej potwierdzonego backupu oraz osobnej zgody.

### Pakiet B — legal i rejestracja — zamknięty jako migracja

Read-only porównanie potwierdziło w obu projektach tabele
`private.legal_document_versions`, `private.terms_acceptances`,
`private.registration_invitations`, `private.registration_attempts` i
`private.privacy_notice_deliveries`, te same service-only RPC, te same polityki
oraz bieżące wersje `terms=1.0` i `privacy=1.0`. Po normalizacji końców linii
definicje funkcji są zgodne. Nie przygotowujemy dla tego obszaru osobnej
migracji; pozostaje test zachowania po promocji kodu.

### Środowiska walidacji

Staging i produkcja są jedynymi środowiskami Supabase. Staging służy do
walidacji artefaktu aplikacji, smoke testów i zachowania już istniejącego
schematu; nie jest kopią danych produkcyjnych i nie zastępuje testu SQL na
lokalnym, reprezentatywnym zbiorze danych. Produkcja pozostaje bez zmian do
czasu zamknięcia kryteriów GO/NO-GO.

### Pakiet C — recovery i magazyn

Nie promujemy lokalnej migracji tworzącej alternatywny wariant `grant_id`.
Oba projekty mają aktywny kontrakt `jti_hash`, pusty `search_path` w badanych
funkcjach i brak wykonania przez `anon`. Ostrzeżenia o wykonaniu przez
`authenticated` są znanym elementem kontrolowanego kontraktu backendowego i
muszą być jawnie opisane w decyzji GO/NO-GO.

## Kryteria STOP

Promocję zatrzymujemy, jeśli wystąpi którekolwiek z poniższych:

- nie ma potwierdzonego backupu i odtworzenia na izolowanym celu;
- read-only porównanie legal/rejestracja nie potwierdza zgodnego efektu;
- migracja zmienia lub usuwa dane, których zakres nie został policzony;
- test pgTAP lub smoke po migracji nie przechodzi;
- nie ma jasnego rollbacku dla kodu i bazy;
- nie są zamknięte ostrzeżenia bezpieczeństwa albo nie ma jawnej decyzji o
  pozostawieniu celowych RPC bez zmian;
- nie ma 30-minutowego okna obserwacji i właściciela alertów.

## Następny krok

Przygotować lokalny, reprezentatywny test Pakietu A oraz końcowy pakiet
GO/NO-GO. Staging wykorzystać do walidacji aplikacji i smoke testów. Żadnego
SQL produkcyjnego ani deployu nie wykonywać przed osobną zgodą na okno
produkcyjne.
