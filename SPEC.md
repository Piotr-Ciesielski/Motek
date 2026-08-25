# Motek — specyfikacja bieżącego produktu

## Status

Motek używa Supabase jako jedynego źródła danych. Aplikacja nie ma trybu SQLite ani lokalnego fallbacku danych.

- źródło lokalne: `2.0.0-alpha.39`;
- staging: `https://staging.rysia.org`, release `2.0.0-alpha.39`, SHA `03b62e72308770f6d9cc591c4ef1f69016bc437e`; staging nie jest produkcją i nie jest dostępny dla użytkowników;
- produkcja: `https://www.rysia.org`, release `2.0.0-alpha.39`, SHA `cc06179bd9481a83c016a4447930ddc3e9f09cb2`;
- limit magazynu: 500 włóczek na użytkownika;
- limit katalogu: 300 wzorów.

## Cel i przepływ użytkownika

Motek pomaga znaleźć wzory możliwe do wykonania z prywatnego zapasu włóczek. Nie jest sklepem ani programem do projektowania dzianin.

1. Użytkownik podaje e-mail i hasło, akceptuje bieżący regulamin oraz przechodzi CAPTCHA.
2. Supabase Auth wysyła automatyczny e-mail potwierdzający adres.
3. Po potwierdzeniu i zalogowaniu użytkownik dodaje, zmienia i usuwa własne włóczki.
4. Przegląda wspólny katalog wzorów i łączy wyszukiwanie z filtrami statusu, języka, typu projektu i materiału.
5. Uruchamia dopasowanie. Backend zwraca wyłącznie warianty z kompletnymi, zweryfikowanymi wymaganiami.

Filtry katalogu łączą się regułą „i”. Liczniki typów i materiałów są wyliczane względem pozostałych aktywnych filtrów. Niedostępne opcje są wyłączone, a wybrana wartość pozostaje dostępna do usunięcia.

Wzory z niepełnymi wymaganiami mogą być widoczne w katalogu, ale nie są prezentowane jako potwierdzone rekomendacje. Brak metrów, gramów albo parametrów roli oznacza brak potwierdzenia, a nie zgodę na przybliżenie.

## Podział odpowiedzialności

### Frontend

`index.html`, `styles.css`, `app.js` i moduły `client/` tworzą statyczny interfejs. Frontend obsługuje cztery widoki: Konto, Magazyn, Dopasowanie i Katalog. Zarządza formularzami, lokalnym stanem, filtrowaniem, paginowanym pobieraniem katalogu i prezentacją wyników. Nie otrzymuje sekretnego klucza Supabase.

### Backend

`server.js` i moduły `server/` tworzą serwer HTTP Node.js bez frameworka. Backend jest granicą zaufania dla sesji, walidacji, limitów, legal gate, dostępu do danych, rankingu, nagłówków bezpieczeństwa i błędów API.

### Supabase

Supabase odpowiada za Auth, trwałe dane, RLS, ACL i uprzywilejowane RPC. Migracje w `supabase/migrations/` są źródłem prawdy dla schematu. Backend używa tokenu użytkownika tam, gdzie RLS ma egzekwować własność, a klucza sekretnego tylko w kontrolowanych operacjach serwerowych.

## Model danych

### `public.profiles`

Profil jest powiązany 1:1 z `auth.users`. `login` i `email` zawierają ten sam znormalizowany adres e-mail. Profil nie przechowuje imienia ani nazwiska.

### `public.yarns`

Prywatna włóczka zawiera `id`, `user_id`, nazwę, kolor, listę materiałów, klasę grubości, długość, wagę oraz znaczniki czasu. `materials` korzysta ze wspólnej kontrolowanej listy. Długość i waga są dodatnimi liczbami całkowitymi od 1 do 1 000 000. Wartość „mieszanka” oznacza nieokreślony skład: nie daje potwierdzonego dopasowania do konkretnego materiału, ale może zostać pokazana w diagnostyce jako możliwa zgodność. Klasy grubości to `lace`, `fingering`, `sport`, `dk`, `worsted` i `bulky`.

### `public.patterns`

Wspólny wzór zawiera opis katalogowy, materiały, parametry włóczki, źródło, język, stan weryfikacji oraz `matching_requirements`. Wersja 2 wymaga jawnych wariantów, ról włóczek, zużycia, rozmiarów, reguł kolorów i liczby nitek.

### Dane prywatne i operacyjne

Prywatne tabele przechowują wersję magazynu, granty recovery, wersje dokumentów prawnych, zaproszenia i próby rejestracji. Dane projektu są przechowywane w `public.projects` i `public.project_yarns`; aktywny projekt zawiera także `progress_unit`, `progress_count`, `note`, `tool_size_mm` i `gauge`. Bezpośredni dostęp ról `anon` i `authenticated` do zapisów jest odbierany; odczyt projektów podlega RLS, a zapisy odbywają się przez ograniczone RPC.

## Dopasowanie

Wariant może trafić do potwierdzonych wyników tylko wtedy, gdy:

- wzór nie wymaga dodatkowej weryfikacji;
- wariant ma kompletne wymagania;
- dostępne włóczki spełniają zużycie, materiały, klasę grubości, role, kolory i liczbę nitek;
- jeden motek nie zostaje przypisany do dwóch różnych ról.

Jeżeli jedyną przeszkodą jest materiał `mieszanka` o nieokreślonym składzie, aplikacja może zwrócić diagnostykę `possible_unknown_material` z możliwą alokacją. Taki wynik pomaga ocenić wzór, ale nie jest prezentowany jako potwierdzenie wykonalności.

Jedna rola może używać kilku zgodnych motków. Wzór wielomateriałowy jest wyszukiwalny pod każdym swoim materiałem, ale pojawia się raz w wynikach. Alternatywne włóczki i elastyczne warianty pozostają rozdzielone zamiast jednej uśrednionej wartości.

Ranking ma bezpieczne limity złożoności: do 250 wariantów na wzór, 8 ról w wariancie i 25 000 odwiedzonych węzłów wyszukiwania. Gdy kombinacji jest więcej, algorytm wybiera najlepszy dostępny podzbiór bez zwiększania limitu 500 zapisanych włóczek.

## API

| Metoda i ścieżka | Zachowanie |
| --- | --- |
| `GET /informacje-prawne` | Publiczna strona regulaminu, prywatności i praw autorskich |
| `GET /health`, `GET /health/live` | Stan procesu |
| `GET /health/ready` | Gotowość aplikacji i zależności |
| `GET /health/release` | Wersja, SHA i środowisko |
| `GET /api/config` | Publiczna konfiguracja klienta, bez sekretów |
| `GET /api/auth/session` | Stan sesji i dostępu prawnego |
| `POST /api/auth/register` | Rejestracja na ważne zaproszenie |
| `POST /api/auth/login` | Logowanie |
| `POST /api/auth/activity` | Odświeżenie podpisanej aktywności sesji |
| `POST /api/auth/password-reset-request` | Żądanie wiadomości recovery bez ujawniania istnienia konta |
| `POST /api/auth/recovery` | Wymiana jednorazowego kodu lub tokenów na grant recovery |
| `POST /api/auth/password` | Ustawienie hasła z aktywnym grantem recovery |
| `POST /api/auth/password/change` | Zmiana hasła po podaniu bieżącego hasła |
| `POST /api/auth/logout` | Wylogowanie i usunięcie cookies |
| `POST /api/legal/acceptance` | Akceptacja bieżącej wersji regulaminu |
| `DELETE /api/account` | Usunięcie konta po haśle i dokładnej frazie potwierdzającej |
| `GET /api/yarns` | Własny magazyn |
| `POST /api/yarns` | Dodanie włóczki |
| `PATCH /api/yarns/:id` | Zmiana własnej włóczki z kontrolą wersji |
| `DELETE /api/yarns/:id` | Usunięcie własnej włóczki z kontrolą wersji |
| `GET /api/patterns` | Uwierzytelniona, stronicowana lista katalogu |
| `POST /api/patterns` | Ręczne zgłoszenie wzoru do katalogu jako `pending_review`, nigdy bezpośrednio `published` |
| `GET /api/projects/active` | Aktywny projekt właścicielki z `ETag: "project-vN"` albo `204` bez ETag |
| `POST /api/projects` | Rozpoczęcie projektu wyłącznie z `patternId`, `variantId` i `If-Match: "yarn-vM"` |
| `PATCH /api/projects/active` | Aktualizacja bieżącego postępu aktywnego projektu walidowanym payloadem; wymaga `If-Match: "project-vN"` i zwraca nowy ETag |
| `GET /api/matches` | Potwierdzone dopasowania dla własnego magazynu |

Odpowiedzi błędów mają stabilny kształt `{ "error": "komunikat" }`. Prywatne endpointy wymagają aktywnej sesji i bieżącej akceptacji regulaminu. Wyjątkiem są wylogowanie i usunięcie konta, aby użytkownik zawsze miał drogę wyjścia.

## Katalog i import

Źródłowy katalog przechodzi walidację pól, limitu 300 rekordów, dozwolonych materiałów, bezpiecznych adresów HTTPS i kompletności wymagań dopasowania. Publiczne DTO nie ujawnia nazw plików źródłowych ani notatek audytowych.

### Ręczne zgłaszanie wzorów

Zalogowana użytkowniczka z bieżącą akceptacją regulaminu może zgłosić wzór formularzem w widoku Katalogu: nazwa, typ projektu, technika, materiały, opcjonalny metraż i opis faktograficzny oraz jeden wariant zapotrzebowania (1–8 ról z jednostką, zakresem ilości, grubościami, trybem materiałów i koloru). Zgłoszenie powstaje wyłącznie jako `pending_review` z `needs_review=true`, syntetycznym `source_filename` (`manual:<uuid>`) i bez audytu treści, więc nigdy samo nie staje się `published`; publikacja pozostaje ścieżką operatora zgodną z kontraktem poniżej. Limit 300 rekordów egzekwuje trigger w bazie, a jego naruszenie zwraca czytelny komunikat. Zgłoszenia nie mają osobnej listy „moje propozycje”; katalog nadal pokazuje wyłącznie rekordy opublikowane.

### Kontrakt publikacji treści katalogu

Każdy publikowany rekord musi mieć wiarygodne źródło. Katalog zawiera wyłącznie krótki, własny opis faktograficzny. Nie publikujemy instrukcji, tłumaczeń, diagramów, zdjęć PDF ani długich cytatów. Braków nie uzupełniamy domysłami; niepewne rekordy pozostają ukryte.

`npm run patterns:check` sprawdza dane bez importu. `npm run patterns:import -- --execute` zapisuje do Supabase wskazanego przez lokalną konfigurację, dlatego wymaga jawnego wyboru środowiska, kopii bezpieczeństwa i osobnej zgody na zewnętrzny zapis.

## Konto, sesja i prawo

Rejestracja działa automatycznie przez Supabase Auth. Użytkownik podaje e-mail, hasło, CAPTCHA, akceptację regulaminu i potwierdzenie zapoznania się z informacją o prywatności. Supabase wysyła automatyczny e-mail potwierdzający adres. Narzędzie operatora nadal obsługuje jednorazowe zaproszenia dla scenariuszy administracyjnych, ale zaproszenie nie jest wymagane przy zwykłej rejestracji.

Sesja używa cookies `HttpOnly`, `SameSite=Lax`; środowiska publiczne wymagają `Secure`. Podpisana aktywność wygasa domyślnie po 2 godzinach bezczynności. Nieaktualna akceptacja regulaminu blokuje profil, magazyn, dopasowania i katalog, ale pozostawia stronę prawa, ponowną akceptację, wylogowanie i usunięcie konta.

Hasło ma od 8 do 256 znaków i wymaga małej litery, wielkiej litery, cyfry oraz znaku specjalnego. Recovery używa krótkotrwałego, podpisanego i jednorazowego grantu. Po zmianie hasła pozostałe sesje są unieważniane, a użytkownik loguje się ponownie.

Usunięcie konta wymaga aktywnej sesji, poprawnego hasła i dokładnej frazy `USUŃ KONTO`. Usuwa konto Auth, profil, akceptacje i dane prywatne. Ograniczone logi bezpieczeństwa oraz wykorzystane zaproszenie mogą pozostać bez identyfikatora użytkownika zgodnie z polityką retencji.

## Bieżąca praca produktowa

- wyrównanie lokalnego kandydata i wdrożonych SHA przed kolejną promocją;
- domknięcie callbacku potwierdzenia e-mailu między frontendem i backendem;
- rozszerzanie kompletnych, zweryfikowanych wymagań na kolejne wzory;
- benchmark przed decyzją o dalszej paginacji, workerze lub kolejce;
- każdorazowe uzgodnienie ledgera migracji, pełny backup i izolowany restore przed zmianą produkcyjnego Supabase;
- utrzymanie jawnej zgody operatora jako warunku migracji, importu z zapisem i deployu produkcji.

## Plan rozwoju — kolejne etapy

Ten plan opisuje zatwierdzony kierunek: katalog szydełkowy → aktywny projekt → codzienny postęp → resztki. Nie zmienia bieżących kontraktów, danych ani zachowania, dopóki dany etap nie zostanie osobno wdrożony i zweryfikowany.

Stan realizacji: etap 1 (technika i katalog szydełkowy) jest zaimplementowany w kodzie, danych katalogu, migracji i testach — 13 rekordów `published` ma sklasyfikowaną technikę (3 `knitting`, 10 `crochet` ze zweryfikowanym źródłem HTTPS). Etap 2 (jeden aktywny projekt) jest zaimplementowany w kodzie backendu, frontendu, migracji i testach; jego migracja bazy na środowisku zdalnym pozostaje do osobnego wykonania po zgodzie operatora. Etap 3 (codzienny postęp) jest zaimplementowany w kodzie backendu, frontendu panelu Dopasowania, migracji i testach; jego migracja bazy na środowisku zdalnym również wymaga zgody operatora. Migracja i import z zapisem etapu 1 oraz etap 4 pozostają niewdrożone. Warunek rolloutu etapu 1: dopóki migracja i kontrolowany import z zapisem nie zostaną wykonane na środowisku zdalnym po zgodzie operatora, staging pokazuje wyłącznie dotychczasowy katalog — trzy rekordy `knitting` z techniką, bez 10 rekordów `crochet`, które istnieją tylko w lokalnych danych importu.

### Cel, rezultat i granice

Użytkowniczka ma znaleźć zweryfikowany wzór szydełkowy, rozpocząć z pełnego dopasowania jeden aktywny projekt, codziennie zapisywać prosty postęp, a po zakończeniu świadomie rozliczyć użyte włóczki jako resztki albo je usunąć.

- Nie dochodzi nowa zależność ani runtime; pozostają Node.js, statyczny frontend i obecny Supabase.
- Pozostają cztery widoki: Konto, Magazyn, Dopasowanie i Katalog. Aktywny projekt jest panelem w Dopasowaniu, nie piątym widokiem.
- Limity 500 włóczek i 300 wzorów obowiązują nadal. Żaden etap nie zwiększa limitów ani nie obchodzi istniejącego limitu magazynu.
- Prywatne dane pozostają chronione przez sesję, bieżący legal gate, RLS, ACL i sprawdzenie właściciela po stronie serwera. Wzory pozostają wspólnym katalogiem.
- Import z zapisem, migracja na zdalnym środowisku, regresja stagingu i deploy wymagają każdorazowo osobnej zgody operatora.

### Decyzje i funkcje świadomie odłożone

- Jeden użytkownik może mieć tylko jeden aktywny projekt; projekty `completed` i `frogged` są zachowywane technicznie, ale bez widoku historii w interfejsie.
- Projekt powstaje wyłącznie z aktualnego pełnego dopasowania wybranego wzoru i wariantu; ręczne wybieranie dowolnych włóczek nie jest ścieżką tworzenia projektu.
- Postęp jest bieżącą wartością bez historii kroków, bez timera i bez dziennika zdarzeń.
- Nie obejmuje to zdjęć, PDF, AI, powiadomień, sklepu, społeczności, wielu aktywnych projektów, historii kroków, kolejki ani workera.

### Etap 1 — technika i katalog szydełkowy

**Zależności.** Nie wymaga projektu, postępu ani zmian stanu włóczek. Wykorzystuje obecne publikowanie katalogu, walidację `matching_requirements`, importer i matcher.

**Kontrakt danych i publikacji.** `public.patterns.technique` jest nullable i ma dwa jawne ograniczenia SQL: `CHECK (technique IS NULL OR technique IN ('knitting', 'crochet'))` oraz `CHECK (publication_status <> 'published' OR technique IS NOT NULL)`. Bezpieczna migracja dodaje kolumnę i oba ograniczenia jako `NOT VALID`, bez defaultu; następnie klasyfikuje na podstawie źródeł dokładnie trzy bieżące rekordy `published`, ponownie zapisuje `content_audit_version` i `content_audited_at`, i dopiero wtedy wykonuje `VALIDATE CONSTRAINT`. Nie wolno zgadywać ani masowo backfillować wszystkich 106 rekordów. Nowy rekord `published` i importowany rekord do publikacji wymagają `technique`, `content_audit_version` oraz `content_audited_at`. Rekord `hidden` lub `pending_review` może mieć `NULL`. Katalog ma zawierać co najmniej 10 rekordów `published` typu `crochet`, każdy z HTTPS URL oraz kompletnym `matching_requirements`.

**API i interfejs.** `GET /api/patterns` rozszerza publiczne DTO o `technique`. Katalog i Dopasowanie otrzymują filtr techniki. Parametr `technique` jest opcjonalny: jego brak zachowuje obecny wynik wszystkich rekordów `published`, a pusty lub nieznany parametr zwraca stabilny błąd 400. `GET /api/matches?technique=` oraz ścieżka diagnostyczna `GET /api/matches?diagnostics=1&technique=` używają tej samej walidacji i filtrują wzory przed wywołaniem istniejącego matchera; matcher nie zmienia się. Pełne dopasowanie otrzymuje wyłącznie dodatkowe, jawne `patternId` i `variantId`, aby kolejny etap nie opierał wyboru na nazwie ani indeksie.

**Pliki.** Utworzyć wspólny dla Node i przeglądarki asset `technique-policy.js`, ładowany w `index.html` przed `client-policy.js`, wraz z `test/technique-policy.test.js`, `supabase/migrations/*_add_pattern_technique.sql` i `supabase/tests/database/pattern_technique.test.sql`. Zmodyfikować `server.js`, `server/pattern-routes.js`, `server/static-files.js`, `test/static-files.test.js`, `client-policy.js`, `test/client-policy.test.js`, `pattern-content-policy.js`, `test/pattern-content-policy.test.js`, `app.js`, `index.html`, `styles.css`, `data/patterns-import.json`, `data/pattern-content-audit.json`, `data/pattern-manual-overrides.json`, `scripts/build-pattern-import.py`, `scripts/import-patterns.js`, `test/server.test.js`, `test/pattern-routes.test.js`, `test/pattern-catalog-data.test.js`, `test/import-patterns.test.js`, `test/design-layout.test.js`, `test/design-regression.test.js`, `test/catalog-pagination-dom.test.js`, `supabase/tests/database/pattern_publication.test.sql` i `docs/DESIGN-QA.md`.

**Kolejność TDD.** Najpierw test polityki i test bazy wymagają obu ograniczeń, `NOT VALID`/`VALIDATE`, braku defaultu oraz odrzucenia `published` bez `technique` lub audytu. Następnie testy audytu, ręcznych override'ów i importera wymagają HTTPS, kompletnych wymagań i 10 opublikowanych wzorów szydełkowych. Test routera obejmuje brak, pustą i nieznaną technikę oraz oba warianty dopasowania — zwykły i `diagnostics=1` — z filtrowaniem przed matcherem i jawnymi identyfikatorami. Testy assetu, klienta i regresji sprawdzają kolejność ładowania, oba filtry oraz cztery widoki. Dopiero potem minimalnie wdrożyć politykę, migrację, dane, import, router i kontrolki UI.

**Kryteria odbioru i weryfikacja.** Opublikowany rekord nie przejdzie bez techniki i audytu; ukryty lub oczekujący może mieć `NULL`; tylko trzy bieżące rekordy `published` zostaną źródłowo sklasyfikowane; brak filtra zwraca wszystkie opublikowane rekordy, a oba warianty dopasowania filtrują obie techniki; pełne dopasowanie jednoznacznie wskazuje wzór oraz wariant. Uruchomić `node --test test/technique-policy.test.js test/static-files.test.js test/client-policy.test.js test/pattern-content-policy.test.js test/pattern-routes.test.js test/server.test.js test/pattern-catalog-data.test.js test/import-patterns.test.js test/design-layout.test.js test/design-regression.test.js test/catalog-pagination-dom.test.js`, `npm run patterns:check` i `npm run test:db`.

### Etap 2 — jeden aktywny projekt

**Zależności.** Wymaga etapu 1: `technique`, pełnego dopasowania z `patternId` i `variantId` oraz aktualnego kontraktu wersji magazynu.

**Model danych.** Dodać `public.projects` z `id`, `user_id`, nullable `pattern_id`, `variant_id`, `status`, `version`, `created_at`, `updated_at` i `ended_at`. `user_id` jest kluczem obcym do `auth.users` z `ON DELETE CASCADE`, a `pattern_id` jest kluczem obcym do `public.patterns` z `ON DELETE SET NULL`; wtedy panel aktywnego projektu pokazuje „wzór niedostępny”. `status` ma `CHECK (status IN ('active', 'completed', 'frogged'))`, `version` ma `CHECK (version >= 1)`, a ograniczenie spójności wymaga `ended_at IS NULL` tylko dla `active` i `ended_at IS NOT NULL` tylko dla statusów terminalnych. Dodać `public.project_yarns` o kluczu głównym `(project_id, yarn_id)` oraz polach `role`, `initial_length_meters` i `initial_weight_grams`; obie wartości początkowe są dodatnie. `project_id` jest kluczem obcym z `ON DELETE CASCADE`, a `yarn_id` kluczem obcym z `ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED`; pojedyncze usunięcie przypisanego motka nadal jest blokowane, a odroczenie pozwala na kaskadę usuwania konta. Indeks częściowo unikalny na `projects(user_id)` dla `status = 'active'` jest jedyną regułą jednego aktywnego projektu.

**Autoryzacja i zapis.** RLS pokazuje wyłącznie własne projekty i przypisania, a anonim nie ma dostępu. Bezpośrednie mutacje tabel są odebrane. `create_active_project` ma grant wyłącznie `service_role`, działa jako `SECURITY DEFINER` z pustym `search_path` i przyjmuje jawny identyfikator właścicielki; backend wywołuje je serwerowym klientem po ponownym wyliczeniu dopasowania. `update_active_project_progress` ma grant `authenticated`, korzysta z `auth.uid()` i klienta sesyjnego oraz także działa jako `SECURITY DEFINER` z pustym `search_path`. RPC walidują własność, odpowiednie wersje i nie udają, że wykonują matcher SQL.

**API i interfejs.** `GET /api/projects/active` zwraca `200` z aktywnym projektem i `ETag: "project-vN"`, a przy jego braku `204` bez ETag. `POST /api/projects` przyjmuje tylko `patternId` i `variantId` oraz wymaga `If-Match: "yarn-vM"`; odpowiedź projektu także zawiera jego ETag. Brakujący lub źle sformatowany nagłówek startu zwraca 428 `Precondition Required`, a poprawny, lecz nieaktualny nagłówek wersji magazynu zwraca 409 `Conflict`, bez ukrytego retry. Konflikt wersji projektu dotyczy osobnego `PATCH /api/projects/active` z etapu 3. `server/project-routes.js` rejestruje te ścieżki w `server.js`; `project-policy.js` waliduje payload i nagłówki. `app.js`, `index.html`, `styles.css` i `client-policy.js` dodają mały panel aktywnego projektu w Dopasowaniu, z komunikatem konfliktu oraz odświeżeniem tylko po decyzji użytkowniczki.

**Prywatność.** Etap wymaga świadomej aktualizacji `legal-document.js` i treści strony prawa, tak aby obejmowały dane projektu i przypisania włóczek, przed ich udostępnieniem użytkowniczkom.

**Pliki.** Utworzyć `project-policy.js`, `server/project-routes.js`, `test/project-policy.test.js`, `test/project-routes.test.js`, `supabase/migrations/*_create_projects.sql` i `supabase/tests/database/projects.test.sql`. Zmodyfikować `server.js`, `app.js`, `index.html`, `styles.css`, `client-policy.js`, `test/client-policy.test.js`, `test/server.test.js`, `test/yarn-routes.test.js`, `supabase/tests/database/yarn_store_versions.test.sql`, `legal-document.js`, `client/legal-page.js`, `test/legal-document.test.js` i `test/legal-page.test.js`.

**Kolejność TDD.** Najpierw testy polityki i routera wymagają legal gate, poprawnych identyfikatorów, `If-Match: "yarn-vM"`, `200` i ETag dla aktywnego projektu, `204` bez ETag przy jego braku, 428 dla braku lub złego formatu nagłówka oraz 409 dla nieaktualnej wersji magazynu. Następnie testy bazy wymagają częściowego indeksu, RLS/ACL, własności, FK `project_yarns.yarn_id` z `ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED`, `ON DELETE SET NULL`, kaskady konta, serwerowego wyznaczenia przypisań i odrzucenia drugiego aktywnego projektu. Potem zmienić dokument prawa i jego testy, a po minimalnej migracji i RPC dodać router oraz panel.

**Kryteria odbioru i weryfikacja.** Dwa równoległe żądania nie tworzą dwóch aktywnych projektów; brak precondition zwraca 428, a zmieniony magazyn 409; cudzy projekt i cudza włóczka są niewidoczne oraz niemodyfikowalne; wzór usunięty z katalogu jest przedstawiony jako niedostępny. Uruchomić `node --test test/project-policy.test.js test/project-routes.test.js test/client-policy.test.js test/server.test.js test/yarn-routes.test.js test/legal-document.test.js test/legal-page.test.js`, `npm run legal:check`, `npm run test:db` i `npm run check`.

### Etap 3 — codzienny postęp

**Zależności.** Wymaga aktywnego projektu z etapu 2 i jego ETag. Nie zmienia przypisań włóczek ani nie tworzy historii.

**Kontrakt.** Aktywny projekt przechowuje `progress_unit` równe `row` albo `round`, `progress_count` całkowite `>= 0`, `note` jako zwykły tekst do 500 znaków, `tool_size_mm` od 0,5 do 50,0 oraz `gauge` jako zwykły tekst do 120 znaków. Akcje `+1` i `-1` tylko zwiększają albo zmniejszają bieżącą wartość, nigdy poniżej zera i bez zapisu historii.

**API i interfejs.** `PATCH /api/projects/active` wymaga `If-Match: "project-vN"`, aktualizuje wyłącznie aktywny projekt właścicielki, a RPC atomowo zwiększa `project.version` do `N+1`; odpowiedź zwraca `ETag: "project-v(N+1)"`. Brakujący lub źle sformatowany nagłówek zwraca 428 `Precondition Required`, a poprawny, lecz nieaktualny 409 `Conflict`, bez auto retry. UI pokazuje stan konfliktu oraz kontrolkę świadomego odświeżenia. Panel Dopasowania zapewnia widoczne etykiety, dostępne przyciski `+1` i `-1`, status zapisu oraz obsługę klawiatury bez utraty fokusu.

**Prywatność.** Przed dodaniem `note`, `tool_size_mm` i `gauge` świadomie sprawdzić, czy bieżący dokument prawa obejmuje te dane. Jeżeli nie, zaktualizować `legal-document.js`, `client/legal-page.js`, `test/legal-document.test.js` i `test/legal-page.test.js`, a następnie uruchomić `npm run legal:check`.

**Pliki.** Utworzyć `supabase/migrations/*_add_project_progress.sql`. Zmodyfikować `project-policy.js`, `server/project-routes.js`, `client-policy.js`, `app.js`, `index.html`, `styles.css`, `test/project-policy.test.js`, `test/project-routes.test.js`, `test/client-policy.test.js` i `supabase/tests/database/projects.test.sql` oraz — tylko gdy wymaga tego dokument prawa — pliki wymienione w akapicie prywatności.

**Kolejność TDD.** Najpierw testy walidacji obejmują oba enumy, granice liczb i długości oraz odrzucenie `-1` od zera. Test routera wymaga `If-Match: "project-vN"`, atomowego zwiększenia wartości z `N` do `N+1` i ETag `project-v(N+1)`, 428 dla braku lub złego formatu nagłówka oraz 409 dla nieaktualnego nagłówka bez retry. Test bazy sprawdza RLS oraz konflikt dwóch kart przeglądarki. Potem dodać minimalne kolumny, RPC, endpoint i kontrolki.

**Kryteria odbioru i weryfikacja.** Użytkowniczka aktualizuje tylko własny aktywny projekt; brak precondition zwraca 428, nieaktualna wersja 409, a sukces zwiększa wersję dokładnie o 1; nigdy nie zapisze wartości ujemnej ani niedozwolonego tekstu; druga karta nie nadpisze postępu. Uruchomić `node --test test/project-policy.test.js test/project-routes.test.js test/client-policy.test.js`, `npm run legal:check`, `npm run test:db` i `npm run check`.

### Etap 4 — zakończenie i resztki

**Zależności.** Wymaga przypisań z etapu 2, początkowych metrów i gramów oraz wersji projektu i magazynu.

**Atomowe rozliczenie.** RPC w jednej transakcji najpierw blokuje aktywny projekt i rekord wersji magazynu właścicielki, waliduje oba kontrakty i rozliczenia wyłącznie dla przypisanych włóczek, ustawia terminalny `status` oraz `ended_at`, usuwa `project_yarns`, a dopiero potem aktualizuje albo usuwa włóczki. To zachowuje blokadę pojedynczego usunięcia przypisanego motka przy FK `ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED`, ale pozwala na kaskadę usuwania konta. `outcome` przyjmuje tylko `completed` albo `frogged`; dla każdej włóczki akcja jest `update` z obiema dodatnimi wartościami metrów i gramów albo `remove`, bez możliwości zwiększenia stanu względem bieżącego magazynu. Błąd, konflikt, cudza włóczka, brak przypisania lub niepoprawne wartości wycofują całą transakcję: status projektu, przypisania, magazyn i oba liczniki wersji pozostają bez zmian. Terminalny projekt zostaje bez historii przypisań, zgodnie z odłożeniem historii UI.

**Propozycja dla użytkowniczki.** Helper w `client-policy.js` proporcjonalnie proponuje metry po wpisaniu rzeczywiście pozostałej wagi, według początkowej relacji metrów do gramów; jego przypadki graniczne sprawdza `test/client-policy.test.js`. UI pokazuje wzór oraz obie liczby i wymaga ich zatwierdzenia albo edycji. Backend tylko waliduje świadomie zatwierdzone dodatnie metry i gramy przy `update`, albo jawną akcję `remove`; nie ma cichego automatycznego zgadywania. Usunięcie motka wymaga wyraźnego potwierdzenia w UI.

**API i interfejs.** `POST /api/projects/active/finish` wymaga dokładnie `If-Match: "project-vN"` oraz `X-Motek-Yarn-Version: "yarn-vM"`; po sukcesie zwraca oba nagłówki z nowymi wersjami. Brakujący lub źle sformatowany którykolwiek nagłówek zwraca 428 `Precondition Required`, a poprawny, lecz nieaktualny nagłówek zwraca 409 `Conflict`, osobno dla projektu i magazynu, bez auto retry. Panel Dopasowania pokazuje formularz końcowy tylko dla aktywnego projektu i po sukcesie usuwa go z aktywnego panelu.

**Pliki.** Utworzyć `supabase/migrations/*_add_project_finish_rpc.sql`. Zmodyfikować `project-policy.js`, `server/project-routes.js`, `client-policy.js`, `app.js`, `index.html`, `styles.css`, `test/project-policy.test.js`, `test/project-routes.test.js`, `test/client-policy.test.js`, `test/yarn-routes.test.js`, `supabase/tests/database/projects.test.sql` i `supabase/tests/database/yarn_store_versions.test.sql`.

**Kolejność TDD.** Najpierw test klienta polityki wylicza wyłącznie propozycję metrów i nigdy nie zmienia danych. Testy routera wymagają obu wersji w dokładnych nagłówkach, zatwierdzenia usunięcia, 428 dla braku lub złego formatu każdego nagłówka oraz 409 dla każdego niezależnego nieaktualnego kontraktu. Testy bazy symulują dwie karty, cudzą włóczkę, błąd po częściowej zmianie, usunięcie przypisań przed włóczkami i oba wyniki; dopiero potem dodać RPC, endpoint i minimalny formularz.

**Kryteria odbioru i weryfikacja.** Zakończenie aktualizuje albo usuwa wyłącznie przypisane włóczki, nie zwiększa stanu, zwraca 428 dla braku precondition i 409 dla obu niezależnych konfliktów, oznacza projekt jako terminalny bez historii przypisań i pozostaje całkowicie atomowe. Uruchomić `node --test test/project-policy.test.js test/project-routes.test.js test/client-policy.test.js test/yarn-routes.test.js`, `npm run test:db` i `npm run check`.

### Końcowa bramka implementacji

W każdym etapie aktualizować wraz z kodem odpowiedni opis w `SPEC.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` i `docs/DESIGN-QA.md`. Przed przekazaniem uruchomić `npm run check`, `npm run test:db`, `npm run lint`, `npm run format:check` oraz `git diff --check`. Import z `--execute`, regresja stagingu i deploy pozostają poza tą bramką i wymagają osobnych zgód.

### Pilotaż moderowany

Pilotaż obejmuje pięć świadomie zaproszonych osób. Kryteriami produktu są: każda osoba potrafi znaleźć co najmniej jeden wzór swojej techniki, rozpocząć pełne dopasowanie, zapisać postęp i zakończyć projekt bez ręcznej korekty danych technicznych przez operatora; żaden konflikt dwóch kart nie powoduje utraty stanu; żadna osoba nie widzi cudzych włóczek ani projektów.

Pilotaż jest moderowany, a jego wyniki są ręcznie podsumowywane agregatowo poza aplikacją. Aplikacja nie gromadzi dodatkowych danych analitycznych o identyfikatorach ani treściach prywatnych.
