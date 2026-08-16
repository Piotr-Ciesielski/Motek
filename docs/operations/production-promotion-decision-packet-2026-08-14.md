# Pakiet decyzji: promocja recovery na produkcję — 2026-08-14

## Decyzja bieżąca

**NO-GO — nie wykonywać jeszcze migracji ani deployu produkcji.**

Pakiet jest gotowy do przeglądu i uzyskania osobnych zgód planistycznych, ale
nie do wykonania operacji. Produkcja i staging nie są obecnie tym samym
artefaktem.

## Aktualny baseline — 2026-08-16

Poniższy dokument zawiera również historyczne snapshoty z 2026-08-14–15.
Dla bieżącej decyzji obowiązuje ten stan:

- aplikacja produkcyjna działa na bezpiecznym pakiecie wizualnym
  `0b3d43347d6b982eb86303db26650cc804ec8cd9`, z pominięciem pełnego pakietu
  recovery/password-management;
- produkcyjna baza Supabase ma 24 wpisy migracji, staging 28;
- aktywna ścieżka recovery używana przez aplikację (`create()` plus
  `claim/release/consume(text)`) oraz `claimed_at` i hash 64 znaków są obecne
  i zgodne między środowiskami;
- pełny release aplikacyjny nadal pozostaje `NO-GO` przez niezamknięty ledger,
  legal-readiness, Cloudflare/origin/WAF i brak osobnych zgód wykonawczych.
- świeży odczyt publiczny potwierdził: Production `/health/release` = 200,
  commit `0b3d43347d6b982eb86303db26650cc804ec8cd9`, ale
  `/informacje-prawne` = 404 i anonimowe `/api/patterns` = 200; Staging
  `/health/release` = 200, commit `3b07f6c71c32a068e12412ea30481f667bfd140c`,
  `/informacje-prawne` = 200 i anonimowe `/api/patterns` = 401.

Szczegółowy odczyt zdalny znajduje się w sekcji „Odczytowa rewalidacja
kontraktu recovery — 2026-08-16” na końcu dokumentu.

## Decyzja produktowo-prawna — potwierdzona 2026-08-14

Zaakceptowano, że Production ma wymagać aktualnej akceptacji warunków prawnych
przy dostępie do prywatnych danych użytkownika, tak samo jak Staging. Oznacza
to przyjęcie przez produkt docelowego zachowania:

- odczyt i modyfikacja własnych włóczek wymagają `has_current_terms_acceptance()`;
- RPC wersjonowanego magazynu włóczek zachowują tę samą bramkę;
- brak aktualnej akceptacji blokuje operację, ale nie zmienia publicznego
  katalogu wzorów ani procesu logowania;
- pierwszy pakiet migracji celowo pozostawia legacy `insert_yarn_with_limit`;
  jego usunięcie wymaga osobnej migracji po snapshotcie, preflight i obserwacji.

Decyzja zamyka wybór produktu, ale nie jest zgodą na wykonanie migracji.
Backup i izolowany restore wykonano 2026-08-14 z wynikiem `PASS warunkowy` dla
obecnego pustego Storage. Nadal wymagane są uzgodnienie ledgeru, preflight,
osobna zgoda na migrację i postflight.

## Stan przed operacją

- produkcyjny SHA aplikacji: `c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b`;
- produkcyjny ledger: 23 migracje (snapshot historyczny z 2026-08-14; bieżący
  odczyt po późniejszej delcie: 24);
- snapshot pełnego ledgera Production/Staging: [supabase-ledger-reconciliation-2026-08-14.md](supabase-ledger-reconciliation-2026-08-14.md);
- robocza macierz stagingowych wpisów: [supabase-staging-migration-matrix-2026-08-14.md](supabase-staging-migration-matrix-2026-08-14.md);
- zdalne porównanie recovery/RLS/ACL: [supabase-remote-definition-comparison-2026-08-14.md](supabase-remote-definition-comparison-2026-08-14.md);
- produkcja `/informacje-prawne`: `404`;
- produkcja `/api/patterns` anonimowo: `200` z odpowiedzią JSON — naruszenie
  decyzji „katalog wyłącznie przez backend”;
- historyczny snapshot z tej sekcji nie miał kompletnego kontraktu recovery
  stagingu; późniejsza delta i rewalidacja z 2026-08-16 zamknęły tę konkretną
  różnicę.

## Kandydat docelowy

- źródło: `origin/staging@e691af891758ebc17f6d4683dbca5d997f65dbe5`;
- wersja: `2.0.0-alpha.39`;
- staging `/health/release`: dokładny SHA i `environment: staging`;
- CI `31692102925`: test i database PASS;
- post-deploy `31692142042`: pełna regresja stagingu PASS;
- lokalny replay aktualnego RC: 32/32 migracji, pgTAP 9 plików / 291 testów;
- staging `/informacje-prawne`: `200`;
- staging anonimowy `/api/patterns`: `401`.

Ważne: lokalny łańcuch 32 migracji oraz jego 11-migracyjny podpakiet recovery
to kandydat z repozytorium, nie dowód zgodności z 23 wpisami Production ani z
27 historycznymi wpisami Staging. Pełny ledger i efekt obiektów zdalnych nadal
muszą zostać uzgodnione przed migracją produkcji.

## Warunki przed zgodą wykonawczą

1. Uzupełnić mapę `wersja zdalna → plik → hash → efekt schematu/RPC` dla
   produkcyjnego ledgera. Lokalny plik/hash map jest już zapisany w [reconciliacji
   ledgerów](supabase-ledger-reconciliation-2026-08-14.md), ale zdalna
   równoważność treści i efektu nadal nie jest potwierdzona. Trzeba zebrać
   minimalny snapshot funkcji, constraintów, RLS, polityk, grantów, triggerów i
   rozszerzeń opisany w tym dokumencie. Nie stosować migracji tylko na podstawie
   numerów.
2. Rozstrzygnąć potwierdzoną różnicę kontraktu recovery: Production nie ma
   `claimed_at` ani RPC `claim/release`, a jego ścieżka legacy używa 43-znakowego
   hasha. Staging ma lifecycle `claim → release/consume` z SHA-256 i dodatkowo
   wymusza `has_current_terms_acceptance()` na włóczkach. Szczegóły są w
   [porównaniu definicji zdalnych](supabase-remote-definition-comparison-2026-08-14.md).
3. Użyć wykonanego 2026-08-14 pełnego backupu produkcji (`public/private`,
   Auth, Storage, metadane) i izolowanego restore; przed oknem odświeżyć go,
   jeśli zmieni się stan danych. Hash pakietu jest zapisany poza repozytorium
   i w lokalnym indeksie dowodów.
 4. Utrzymać dowód odtworzenia w zgodnym, izolowanym stacku Supabase: eksport
    `public/private`, Auth i Storage został już odtworzony, porównano liczności,
    zdrowie Auth, logowanie/recovery oraz pusty Storage. Przed przyszłym oknem
    produkcyjnym odświeżyć eksport, jeżeli zmieni się stan danych; nie wykonywać
    restore na produkcji.
5. Potwierdzić legal-readiness: dane, role dostawców, regiony, transfery,
   retencję, DPA i subprocesorów dla Supabase, Railway, Cloudflare edge oraz
   Turnstile. Do tego czasu pozostaje `LEGAL_PUBLICATION=not ready`.
6. Zamknąć infrastrukturę: origin Railway, cache API/Auth, WAF/rate limiting,
   monitoring, odbiorcę alertów oraz certyfikat/SNI originu.
7. Wskazać kompatybilny rollback aplikacji. Sam rollback Railway nie cofa
   migracji Supabase; po migracji stare `c4b777a` nie jest automatycznie
   bezpiecznym rollbackiem.
8. Zachować produkcyjne `private.yarn_store_versions.updated_at` jako
   zaakceptowaną kompatybilność danych. Odczyt wykazał 2 wiersze z wypełnioną
   wartością; delta nie może wykonywać `DROP COLUMN` ani zmieniać tych wartości.

## Proponowana kolejność operacji

Poniższa kolejność jest propozycją wykonawczą, a nie udzieloną zgodą:

1. Odczyt preflight i backup produkcji.
2. Izolowany restore oraz porównanie danych.
3. Replay i walidacja pełnego łańcucha migracji forward-only.
4. Osobno zatwierdzona migracja produkcyjnego Supabase.
5. Postflight RPC/RLS/ACL i zatrzymanie przy pierwszej niezgodności.
6. Osobno zatwierdzony deploy aplikacji `e691af8` na Railway production.
7. Post-deploy smoke, test publicznego kontraktu i obserwacja.
8. Końcowe `GO/NO-GO` po obserwacji.

## Wspólne warunki natychmiastowego STOP

Operację należy zatrzymać i nie przechodzić do następnego etapu, gdy wystąpi
którykolwiek z poniższych warunków:

- niezgodny exact SHA lub `environment` kandydata;
- nieuzgodniony ledger, nieznany efekt migracji albo częściowo zastosowana
  migracja;
- brak potwierdzonego backupu, hasha, szyfrowania lub izolowanego restore;
- brak write-freeze albo niekontrolowane zapisy w czasie migracji;
- `404` na `/informacje-prawne` albo anonimowy `200` na `/api/patterns`,
  `/api/yarns` lub `/api/matches`;
- `HIT` cache dla prywatnej odpowiedzi, błąd Auth/recovery albo ujawnienie
  sekretu/PII;
- brak kompatybilnego rollbacku aplikacji i właściciela decyzji awaryjnej;
- brak potwierdzonego cleanupu, alertów, odbiorcy alertów lub okna obserwacji;
- dowolny nieoczekiwany 5xx albo niezgodność RPC/RLS/ACL po migracji.

Nie przygotowywać klasycznego `down SQL`. W razie błędu wybór jest jawny:
kompatybilny rollback aplikacji, naprawa forward albo restore bazy — każdy
wymaga osobnej decyzji.

## Minimalny post-deploy smoke

Za `PASS` uznać dopiero jednocześnie:

- `/health/release` ma SHA `e691af8…` i `environment: production`;
- `/health/ready` i `/health/live` zwracają sukces;
- `/informacje-prawne` oraz `/informacje-prawne/` zwracają `200`;
- anonimowe `/api/patterns`, `/api/yarns` i `/api/matches` zwracają `401`;
- `/api/config` i `/api/auth/session` mają `Cache-Control: no-store`;
- `/internal/metrics` pozostaje niedostępne publicznie;
- redirecty, TLS, brak 5xx i nagłówki bezpieczeństwa są poprawne;
- nie ma niepewnego cleanupu ani ujawnienia sekretów.

## Proponowane okno obserwacji po deployu

Minimalne okno obserwacji: 30 minut od zakończenia smoke. Kontrole co 10 minut
oraz po każdym alarmie obejmują `/health/ready`, `/health/release`, błędy 5xx,
logowanie, recovery, opóźnienia żądań i odpowiedzi prywatnych. Proponowane
kryterium końcowe to brak nieoczekiwanych 5xx, brak błędów Auth/recovery,
zgodny exact SHA, brak `HIT` dla prywatnego API i potwierdzony cleanup testów.

Właścicielem dyżuru i odbiorcą alertów jest operator Motka. Operator zaakceptował
30-minutowe okno obserwacji; konkretne progi opóźnień i kryteria STOP pozostają
elementem preflightu przed zgodą wykonawczą.

## Bezpieczny wariant delty forward-only

Po zamknięciu ledgeru i backupu proponowana delta powinna:

1. zachować `private.yarn_store_versions.updated_at` i istniejące wartości;
2. dodać/uzgodnić `has_current_terms_acceptance()` oraz polityki profili i
   włóczek;
3. wyrównać versioned RPC do stagingowego kontraktu (`P0003`, legal gate,
   pusty `search_path`, `SECURITY DEFINER`);
4. w pierwszym pakiecie pozostawić oba legacy overloady `insert_yarn_with_limit`,
   a ich usunięcie wykonać dopiero jako osobną migrację po potwierdzeniu braku
   zależności klientów;
5. przeprowadzić recovery 43→64 z kontrolą liczności i hashy oraz zachować
   kompatybilność istniejących overloadów service-role;
6. dodać `claimed_at`, `claim/release/consume` oraz właściwe ACL/RLS;
7. wykonać postflight funkcji, constraintów, RLS, ACL i testów recovery.

Nie tworzyć klasycznego `down SQL`, nie wykonywać ręcznych grantów i nie
stosować tej listy bezpośrednio jako polecenia produkcyjnego. Najpierw trzeba
uzgodnić historyczne wpisy ledgeru, wykorzystać potwierdzony backup/restore i
uzyskać osobne zgody wykonawcze.

## Twarde zabezpieczenia delty

Szczegółowa inwentaryzacja operacji ryzyka i kolejności forward-only znajduje
się w [osobnym dokumencie](production-forward-delta-risk-inventory-2026-08-14.md).

Przed wykonaniem i w postflight trzeba potwierdzić:

- brak `DROP COLUMN updated_at`, `DROP TABLE private.yarn_store_versions` i
  resetu licznika;
- zachowanie najwyższego `version` per użytkownik oraz wartości `updated_at`;
- cztery versioned RPC z `auth.uid()`, `SECURITY DEFINER`, pustym
  `search_path`, `FOR UPDATE`, legal gate i ACL wyłącznie dla
  `authenticated`;
- polityki `profiles_*` i `yarns_*` wymagające własności oraz aktualnych
  warunków;
- brak bezpośredniego zapisu do `public.yarns` i użycia sekwencji; oba
  overloady `insert_yarn_with_limit` pozostają do czasu osobnego cleanupu;
- brak aktywnego legacy recovery 43-znakowego albo jawny, zweryfikowany plan
  kompatybilności przed zmianą constraintu na 64 znaki;
- `claim/release/consume`, ważność grantu, `claimed_at`, `used_at` i
  odrzucenie wygasłego grantu.

Natychmiastowy STOP następuje przy innej sygnaturze, `search_path`, trybie
bezpieczeństwa, warunku legalnym, ACL, polityce `USING/WITH CHECK`, częściowym
wykonaniu albo zmianie danych poza zatwierdzonym zakresem.

## Osobne zgody

- [x] backup i eksport produkcji (wykonane 2026-08-14; write-freeze pozostaje
  elementem przyszłego okna);
- [x] izolowany restore i porównanie (PASS warunkowo dla pustego Storage);
- [ ] migracja Supabase forward-only;
- [ ] deploy aplikacji `e691af8`;
- [ ] smoke i okno obserwacji;
- [ ] forward repair albo restore w przypadku awarii.

Do zaznaczenia każdej zgody potrzebny jest właściciel, zakres, data, kryterium
STOP i potwierdzenie wyniku. Ten dokument nie jest zgodą wykonawczą.

## Aktualna macierz bram przed zgodami — 2026-08-15

| Bramka | Stan | Warunek zamknięcia |
|---|---|---|
| Lokalny klient legacy RPC | PASS | Brak odwołań w aplikacji, workflowach, skryptach i narzędziach repozytorium |
| Zewnętrzny klient legacy RPC | PASS* | Operator potwierdził brak zewnętrznych klientów; staging ma 4 historyczne wywołania PostgREST, więc cleanup pozostaje osobną migracją z postflightem |
| Ledger migracji | OPEN | Mapa zdalny wpis → lokalny plik → hash/efekt; Production 23, Staging 27, RC 32 pliki |
| Recovery/data preflight | OPEN | Snapshot bezpośrednio przed oknem, zachowanie 2 produkcyjnych liczników i `updated_at`, kontrola 43→64 |
| Legal readiness | OPEN* | Operator potwierdził weryfikację; trzeba jeszcze przypiąć datowane źródła do manifestu, który nadal jest `unverified` |
| Cloudflare/origin/WAF | OPEN | Potwierdzenie originu Railway, WAF/rate limiting i progów STOP; właściciel oraz odbiorca alertów są już potwierdzeni |
| Migracja Supabase | NOT AUTHORIZED | Wszystkie powyższe bramki zamknięte oraz osobna zgoda wykonawcza |
| Deploy aplikacji | NOT AUTHORIZED | PASS migracji i osobna zgoda na exact SHA `e691af8` |
| Smoke/obserwacja | NOT AUTHORIZED | Operator Motka, 30-minutowe okno potwierdzone; potrzebne są kryteria STOP i osobna zgoda wykonawcza |

Świeży publiczny smoke potwierdził `200` dla readiness/release/config oraz
`Cache-Control: no-store` i `cf-cache-status: DYNAMIC`, ale nadal wykazał
anonimowe `200` dla `/api/patterns` i `404` dla `/informacje-prawne` w
Production. Nie zamyka to bram aplikacyjnego kontraktu ani legal-readiness.

Macierz porządkuje kolejność decyzji; nie stanowi zgody na migrację, deploy,
zmianę Cloudflare ani zmianę danych.

## Świeży baseline publicznych endpointów — 2026-08-15 11:11 UTC

Odczyt GET wykonany bez zapisu i bez uwierzytelnienia. Czasy są obserwacją
diagnostyczną, nie zatwierdzonymi progami SLA:

| Endpoint | Staging | Production |
|---|---:|---:|
| `/health/ready` | 200 / 0,987 s | 200 / 0,526 s |
| `/health/release` | 200 / 0,496 s | 200 / 0,517 s |
| `/api/config` | 200 / 0,248 s | 200 / 0,250 s |
| `/api/patterns` | wcześniejszy smoke: 401 | 200 / 0,714 s |

Staging nadal wskazuje exact SHA `e691af891758ebc17f6d4683dbca5d997f65dbe5`,
a Production `c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b`. Produkcyjny anonimowy
`200` dla `/api/patterns` pozostaje kryterium STOP względem decyzji „katalog
wyłącznie przez backend”. Pomiar nie jest zgodą na migrację, deploy ani zmianę
ustawień Cloudflare.

## Potwierdzenia operatora — 2026-08-15

- Operator potwierdził brak zewnętrznych klientów legacy RPC.
- Operator zadeklarował, że zakres legal dostawców został zweryfikowany; nie
  zmieniono jeszcze manifestu, ponieważ formalny wpis wymaga przypisania
  datowanych źródeł do konkretnych pól każdego dostawcy.
- Właścicielem dyżuru i odbiorcą alertów jest operator Motka; zaakceptowano
  30-minutowe okno obserwacji.
- Cloudflare pozostaje bez zmian; nie włączono WAF, rate limiting ani HSTS.
- Okno produkcyjne zostało potwierdzone. Nie jest to zgoda na wykonanie
  migracji Supabase ani deployu — te zgody pozostają niezależne.

## Próba okna produkcyjnego i blokada write-freeze — 2026-08-15

Po wyraźnej zgodzie operatora wykonano wyłącznie preflight i próbę
ustanowienia write-freeze. Aktualny snapshot przed operacją zgadzał się z
punktem odtworzenia: Production miała 2 profile, 10 włóczek, 15 wzorów, 2
liczniki wersji z maksimum 4, 0 grantów recovery oraz pusty Storage.

Write-freeze Railway nie zadziałał. Panelowe próby ustawienia
`startCommand = sleep infinity` oraz `healthcheckPath = /nonexistent` były
nadpisywane przez `railway.json` z repozytorium, którego manifest wymusza
`node server.js` i `/health/ready`. Publiczne endpointy nadal zwracały 200,
więc migracji Supabase nie rozpoczęto.

W ramach bezpiecznego wycofania przywrócono Production do poprzedniego SHA
`c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b` — deployment
`73f3c193-135c-46a8-a39f-d7ce12ed27ed`. `/health/release` ponownie zwraca 200,
środowisko `production` i ten SHA. Panelowe override'y Railway ustawiono z
powrotem na neutralne; efektywnym źródłem pozostaje `railway.json`.

Nie zmieniono repozytorium, Supabase, Cloudflare, env vars ani stagingu.
Pozostaje jedna blokada wykonawcza: tymczasowa, jawnie zatwierdzona zmiana
`railway.json` dla write-freeze albo decyzja o niewykonywaniu migracji przy
aktywnych zapisach. Druga opcja jest odradzana.

## Wykonane okno produkcyjne — wynik operacji: Production NO-GO, 2026-08-15

Status końcowy: `Production NO-GO` dla promocji nowego release’u.
Freeze skutecznie ustanowił deployment `dfec8c7e-f6d0-4cc2-89b1-e5c5e2d16c0a`
z tymczasowej gałęzi operacyjnej; poprzednia replika została usunięta, a
publiczny healthcheck zwracał 502. W tym stanie zastosowano migrację
`production_legal_versioned_recovery_delta` (`20260815115028`). Postflight
potwierdził zachowanie danych: 2 profile, 10 włóczek, 2 liczniki wersji,
maximum wersji 4, 0 grantów recovery, 0 bucketów i 0 obiektów Storage.
Obecne są legal gate, wersjonowane RPC oraz `claim/release` recovery.

Exact SHA `e691af8` nie wystartował: najpierw obraz nie kopiował katalogu
`data`, a po dodaniu `COPY data ./data` aplikacja zatrzymała się na poprawnym
bezpieczniku `Publikacja prawna nie jest gotowa`, ponieważ
`data/legal-data-providers.json` nadal ma status `draft/unverified`. Tego
bezpiecznika nie obchodzono. Produkcję przywrócono do
`c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b`, deployment
`063029eb-4ea6-415b-884d-d51823ecd359` zakończył się sukcesem. Smoke: readiness
i release 200, katalog 200, `/informacje-prawne` 404 jako cecha starszego
release’u. Cleanup legacy RPC nie został wykonany; promocja nowego release’u
pozostaje zablokowana przez legal readiness i kontrakt katalogu. Produkcja
działa na rollbacku `c4b777a`; nie jest to akceptacja pakietu recovery.
## Odczytowa rewalidacja kontraktu recovery — 2026-08-16

Wykonano wyłącznie odczyt zdalnych definicji Supabase Production i Staging;
nie wykonano SQL zmieniającego dane, migracji ani zmian ACL.

- Production ma obecnie 24 wpisy migracji, a Staging 28; najnowsze wpisy to
  odpowiednio `production_legal_versioned_recovery_delta` oraz
  `restore_recovery_grant_creator`.
- W obu środowiskach `private.auth_recovery_grants` ma `claimed_at` oraz
  constraint `char_length(jti_hash) = 64`.
- Aktywna ścieżka używana przez aplikację jest zgodna w obu środowiskach:
  `create_auth_recovery_grant()` i `consume_auth_recovery_grant(text)` oraz
  `claim_auth_recovery_grant(text)` i `release_auth_recovery_grant(text)` mają
  zgodne definicje i wykonanie dla roli `authenticated`.
- Pozostają historyczne overloady z parametrami użytkownika/hash, dlatego ich
  pełne porównanie i ewentualny cleanup nadal należy do osobnego ledgeru, a nie
  do bieżącego wdrożenia aplikacji.

Wniosek: wcześniejsza blokada „Production nie ma kontraktu claim/release/64”
jest zamknięta przez późniejszy stan zdalny. Produkcja nadal pozostaje `NO-GO`
dla pełnego release’u z powodu niezamkniętego ledgera migracji, legal-readiness,
Cloudflare/origin/WAF oraz osobnych zgód na wykonanie migracji/deployu.
