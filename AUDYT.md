 # Audyt bezpieczeństwa i jakości — Motek

 Data audytu: 2026-07-27
 Zakres: `README.md`, `SPEC.md`, `server.js`, `supabase.js`, `app.js`, `index.html`, migracje Supabase, skrypty importu, testy oraz konfiguracja npm.

 ## Werdykt

 **Nie rekomenduję wdrożenia produkcyjnego bez zamknięcia problemów wysokiego priorytetu.** W kodzie widać dobre podstawy: zapytania SQLite są parametryzowane, dane wyświetlane w frontendzie trafiają przez `textContent`, sekretny klucz Supabase nie jest zwracany API, a RLS tabeli `yarns` ogranicza rekordy do właściciela. Największe ryzyka wynikają jednak z trybu awaryjnego, który otwiera lokalny magazyn bez logowania, z braku ochrony przed brute force i DoS oraz z destrukcyjnego, nieatomowego zapisu całego magazynu. Dodatkowo algorytm dopasowania może odrzucać poprawne zestawy włóczek.

 ## Metoda i ograniczenia

 Wykonałem statyczny przegląd kodu i migracji, analizę ścieżek API, przegląd testów oraz lokalne kontrole:

 - `npm run check` — **16 testów przechodzi**;
 - `npm audit --omit=dev --audit-level=moderate` — **0 znanych podatności** dla aktualnego `package-lock.json`;
 - `node --check server.js` i `node --check app.js` — bez błędów.

 Nie wykonywałem testów na prawdziwym projekcie Supabase ani testów penetracyjnych z zewnętrznej sieci. Wnioski dotyczące konfiguracji wdrożenia produkcyjnego wymagają potwierdzenia w hostingu, reverse proxy i ustawieniach Supabase.

 ## Znalezione problemy

 ### AUD-01 — Tryb SQLite otwiera API bez uwierzytelnienia

 1. **Lokalizacja:** `server.js:927-929`, `server.js:938-945`, `server.js:973-984`, `server.js:1034-1039` (`handleApi`, `main`).
 2. **Kategoria:** Bezpieczeństwo — broken access control / secure configuration.
 3. **Poziom krytyczności:** **Wysoki**.
 4. **Opis problemu:** Gdy `SUPABASE_SECRET_KEY` nie jest ustawiony, serwer świadomie przełącza się na SQLite. W tym trybie `GET/POST/DELETE /api/yarns` oraz `GET /api/matches` nie wymagają sesji. Jeśli wdrożenie produkcyjne wystartuje z brakującą albo błędną konfiguracją Supabase, aplikacja nie zatrzyma się — uruchomi współdzielony magazyn bez izolacji użytkowników. To jest fail-open: błąd konfiguracji zmienia model bezpieczeństwa, a nie tylko ogranicza funkcję.
 5. **Rekomendacja:** W produkcji wymagać obu konfiguracji i kończyć start błędem, np. `if (NODE_ENV === "production" && !supabaseConnection) throw new Error(...)`. Tryb SQLite powinien być dostępny wyłącznie po jawnym `LOCAL_MODE=true`, przy domyślnym `HOST=127.0.0.1`, nigdy jako automatyczny fallback.

 ### AUD-02 — Ciasteczka sesji mogą być wysłane bez `Secure`

 1. **Lokalizacja:** `server.js:216-219` (`buildAuthCookie`).
 2. **Kategoria:** Bezpieczeństwo — ochrona tokenów / transport.
 3. **Poziom krytyczności:** **Wysoki**.
 4. **Opis problemu:** Atrybut `Secure` jest dodawany wyłącznie, gdy `process.env.NODE_ENV === "production"`. Typowe wdrożenie może mieć HTTPS na reverse proxy, ale nie mieć dokładnie takiej zmiennej. Wtedy access i refresh token mogą być wysłane po HTTP, jeśli aplikacja jest osiągalna przez niezabezpieczony adres. Kradzież refresh tokena daje długotrwały dostęp do konta.
 5. **Rekomendacja:** Wprowadzić jawny tryb transportu, np. `COOKIE_SECURE=true` wymagany poza lokalnym developmentem, oraz wymusić HTTPS na proxy. Dodać HSTS po potwierdzeniu, że cała domena działa wyłącznie po HTTPS. Test wdrożeniowy powinien sprawdzać `Secure; HttpOnly; SameSite=Lax` na obu ciasteczkach.
 6. **Stan po zmianie 2026-07-28:** Backend wymaga `COOKIE_SECURE=true` przy `NODE_ENV=production`, a testy sprawdzają konfigurację i atrybut `Secure`. Wymuszenie HTTPS i HSTS pozostaje zadaniem dla reverse proxy i hostingu.

 ### AUD-03 — Brak rate limiting i ochrony przed brute force

 1. **Lokalizacja:** `server.js:847-914` (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`), a także `getAuthenticatedSession` w `server.js:325-368`.
 2. **Kategoria:** Bezpieczeństwo — broken authentication / availability.
 3. **Poziom krytyczności:** **Wysoki**.
 4. **Opis problemu:** Endpoint logowania wykonuje próbę Supabase dla każdego żądania, bez limitu per IP, per konto, backoffu, blokady czasowej ani limitu rejestracji. Atakujący może prowadzić password spraying, enumerować dostępność usługi lub generować koszt i obciążenie Supabase. Sama walidacja złożoności hasła nie ogranicza liczby prób.
 5. **Rekomendacja:** Dodać rate limiting na reverse proxy i aplikacji (osobno login, register i reset hasła), narastające opóźnienie po błędach, monitoring oraz alerty. Limit powinien działać za poprawnie skonfigurowanym proxy i uwzględniać prawdziwy adres klienta bez zaufania do dowolnego nagłówka `X-Forwarded-For`.
 6. **Stan po zmianie 2026-07-28:** Backend ogranicza nieudane próby logowania i rejestracji osobno per adres klienta i e-mail, bez zaufania do `X-Forwarded-For`. Pozostają limity i monitoring na reverse proxy oraz ochrona rozproszona dla wielu procesów.

 ### AUD-04 — Autosave wymaga dalszego wzmocnienia atomowości

 1. **Lokalizacja:** `app.js:142-175` (`saveYarns`), `server.js:305-362, 799-811`.
 2. **Kategoria:** Logika / Edge case / niezawodność danych.
 3. **Poziom krytyczności:** **Wysoki**.
 4. **Opis problemu:** Przed zmianą zapis pobierał istniejące rekordy, usuwał je wszystkie, a następnie wykonywał osobne POST-y. Obecnie autosave zapisuje różnice per rekord, więc błąd nie kasuje całego magazynu. Nadal nie ma atomowości całej serii zmian ani wersjonowania/optimistic locking, dlatego równoległe edycje mogą nadpisać część zmian.
 5. **Rekomendacja:** Zastąpić to endpointem atomowym, np. `PUT /api/yarns` przyjmującym cały stan i wykonywanym w transakcji albo operacjami `PATCH/POST/DELETE` na pojedynczych rekordach. Dodać `updated_at`/wersję klienta, idempotency key, obsługę retry oraz test awarii między usunięciem a insertem. Nie kasować danych przed potwierdzeniem poprawnego zapisu nowej wersji.
 6. **Stan po zmianie 2026-07-28:** Autosave korzysta z operacji per rekord (`POST`, `PATCH`, `DELETE`) i nie usuwa już całego magazynu przed zapisem. Pozostają do rozważenia atomowość większych serii zmian, wersjonowanie klienta i retry.

 ### AUD-05 — Algorytm dopasowania ma potencjalnie wykładniczy koszt

 1. **Lokalizacja:** `server.js:470-535` (`allocateRequirementYarns`) oraz `server.js:575-610` (`getSupabaseMatches`).
 2. **Kategoria:** Bezpieczeństwo — denial of service / wydajność.
 3. **Poziom krytyczności:** **Wysoki**.
 4. **Opis problemu:** Przy każdym wymaganiu algorytm przegląda kombinacje włóczek rekurencyjnie. Liczba kombinacji rośnie wykładniczo, a aplikacja nie ogranicza liczby rekordów magazynu na użytkownika, liczby wariantów ani czasu wykonania. Uwierzytelniony użytkownik może dodać wiele rekordów i wywołać `/api/matches`, blokując pojedynczy proces Node.js. Dodatkowo endpoint pobiera cały katalog i cały magazyn bez paginacji.
 5. **Rekomendacja:** Ustalić limit liczby włóczek, wariantów i wymagań; odrzucać lub kolejkować zbyt duże obliczenia; dodać deadline/cancellation. Zastąpić brute force algorytmem sortowania/greedy, DP z limitem stanu albo obliczeniami w bazie/workerze. Dodać test obciążeniowy z realistycznym maksimum.
 6. **Stan po zmianie 2026-07-28:** Dodano limit 250 wariantów i 25 000 kroków wyszukiwania oraz szybkie odrzucenie oczywiście niewykonalnych wymagań. Przy większym magazynie ranking wybiera do 50 najlepiej pasujących kandydatów dla wariantu i oznacza wynik jako podzbiór; zapis magazynu nie jest ograniczony. Benchmark potwierdził szybkie odrzucanie niemożliwych przypadków. Pozostaje decyzja, czy przenieść obliczenia do workera.

 ### AUD-06 — Dopasowanie ról może odrzucać poprawny zestaw

 1. **Lokalizacja:** `server.js:518-543` (`chooseGroup`).
 2. **Kategoria:** Logika biznesowa / Edge case.
 3. **Poziom krytyczności:** **Średni**.
 4. **Opis problemu:** Rekurencja kończy wybieranie grupy natychmiast po osiągnięciu `group.length >= requirement.yarnsNeeded` (`server.js:530`). Oznacza to, że gdy wymaganie mówi „1 motek”, ale pojedynczy motek nie ma wystarczającej liczby metrów/gramów, drugi kompatybilny motek nie może zostać dołączony. Wynik może być pusty mimo spełnienia sumy materiału przez kilka motków. To wymaga potwierdzenia semantyki `yarns_needed`; jeśli oznacza minimum, jest to błąd.
 5. **Rekomendacja:** Ustalić w modelu, czy `yarns_needed` oznacza dokładnie czy co najmniej. Dla wartości minimalnej kontynuować wybór po osiągnięciu liczby minimalnej aż do spełnienia metrów/gramów; dla wartości dokładnej dodać walidację danych i test jawnie potwierdzający tę regułę.
 6. **Stan po zmianie 2026-07-28:** Przyjęto interpretację „co najmniej” i dodano test potwierdzający użycie kilku kompatybilnych motków dla jednej roli.

 ### AUD-07 — Brak limitu czasu odczytu żądania (slowloris)

 1. **Lokalizacja:** `server.js:572-615` (`readBody`) oraz `server.js:1055` (serwer HTTP).
 2. **Kategoria:** Bezpieczeństwo — availability / Edge case.
 3. **Poziom krytyczności:** **Średni**.
 4. **Opis problemu:** Jest limit rozmiaru body, ale nie ma timeoutu na rozpoczęcie i zakończenie wysyłania body. Klient może wysyłać dane bardzo wolno i długo zajmować połączenie. Przy wielu równoległych połączeniach pojedynczy proces Node.js może przestać obsługiwać prawidłowych użytkowników.
 5. **Rekomendacja:** Ustawić `requestTimeout`, `headersTimeout`, `keepAliveTimeout` i limit liczby połączeń na proxy. Dla body użyć własnego deadline oraz przerwania strumienia po timeout. Dodać test wolnego klienta.

 ### AUD-08 — Brak paginacji i limitów wyników katalogu

 1. **Lokalizacja:** `server.js:769-780` (`getCatalogPatterns`) oraz `app.js:383-450` (`renderPatternCatalog`).
 2. **Kategoria:** Architektura / Wydajność / Edge case.
 3. **Poziom krytyczności:** **Średni**.
 4. **Opis problemu:** `/api/patterns` pobiera cały katalog, a frontend tworzy kartę dla każdego rekordu w DOM. Obecne 116 rekordów jest małe, ale katalog ma rosnąć. Brak paginacji, limitu, serwerowego wyszukiwania i cache kontrolowanego przez serwer powoduje wzrost pamięci, czasu odpowiedzi i kosztu transferu. Ten sam wzorzec pełnego odczytu występuje w dopasowaniu.
 5. **Rekomendacja:** Dodać `limit/offset` lub cursor pagination, maksymalny limit serwerowy, serwerowe `q/status`, indeksy i ewentualnie endpoint podsumowania. Nie przyjmować dowolnego limitu z klienta.
6. **Stan po zmianie 2026-07-28:** Ustalono limit katalogu 300 rekordów oraz limit magazynu 500 włóczek na użytkownika. Paginacja pozostaje opcją na przyszłość, jeśli limity produktu zostaną zwiększone.

**Status po poprawce 2026-07-28:** częściowo zamknięte. `GET /api/patterns`
obsługuje `limit` i `offset`, przy czym serwer ogranicza stronę do maksymalnie
50 rekordów i zwraca `total` oraz `hasMore`. Frontend pobiera strony
sekwencyjnie, a wewnętrzny ranking zachowuje pełny odczyt katalogu do limitu
300. Serwerowe wyszukiwanie i filtrowanie pozostają opcjonalnym usprawnieniem.

 ### AUD-09 — Spójność danych `matching_requirements` jest egzekwowana głównie w kodzie aplikacji

 1. **Lokalizacja:** `supabase/migrations/20260727000002_add_pattern_matching_requirements.sql:4-6`, `server.js:679-751`, `scripts/build-pattern-import.py:57-85`.
 2. **Kategoria:** Jakość / Logika biznesowa / integralność danych.
 3. **Poziom krytyczności:** **Średni**.
 4. **Opis problemu:** Migracja wymaga tylko, aby JSONB był obiektem; nie wymusza obecności `variants` ani poprawności pól, zakresów, materiałów i klas. `normalizeMatchingRequirements` cicho odrzuca niepoprawne warianty, przez co rekord może wyglądać poprawnie w katalogu, ale zniknąć z dopasowania bez alarmu. Walidator importu nie chroni przed ręczną zmianą danych z użyciem roli serwerowej.
5. **Rekomendacja:** Wprowadzić wersjonowany schemat JSON i walidację przed zapisem/importem, raportować odrzucone warianty, odrzucać rekordy z niepoprawnymi wymaganiami zamiast je cicho pomijać oraz dodać testy negatywne dla JSONB.

**Status po poprawce 2026-07-28:** częściowo zamknięte. Importer waliduje
strukturę wariantów, dodatnie liczby całkowite, niepuste materiały/grubości i
role, a błędny rekord zatrzymuje import. Dodano migrację z triggerem Supabase,
który powtarza podstawową walidację przy bezpośrednich zapisach `service_role`.
Migracja nie została jeszcze zastosowana na zdalnej bazie; po jej wdrożeniu
trzeba wykonać kontrolę istniejących rekordów i test migracji na stagingu.

 ### AUD-10 — Zapis lokalnej bazy nie jest atomowy

 1. **Lokalizacja:** `server.js:167-171` (`persist`) oraz `server.js:1045-1053` (`main`).
 2. **Kategoria:** Edge case / Jakość / niezawodność.
 3. **Poziom krytyczności:** **Średni**.
 4. **Opis problemu:** Cała baza sql.js jest eksportowana i zapisywana bezpośrednio do docelowego pliku. Przerwanie procesu podczas `writeFileSync` może uszkodzić plik i spowodować utratę danych przy następnym starcie. Równoległe procesy używające tego samego `DATABASE_FILE` również nie mają blokady.
 5. **Rekomendacja:** Zapisywać do pliku tymczasowego w tym samym katalogu, wykonać flush/close i atomowe `rename`, zachowując kopię poprzedniej wersji. W produkcji nie używać tego fallbacku jako wieloużytkownikowej bazy; zastosować Supabase/Postgres.

 ### AUD-11 — Brak ochrony CSRF jako osobnej kontroli

 1. **Lokalizacja:** `server.js:216-219`, `server.js:896-907`, `server.js:935-966`; `app.js:152-155`.
 2. **Kategoria:** Bezpieczeństwo — CSRF.
 3. **Poziom krytyczności:** **Niski** (warunkowo **Średni**, jeśli domena ma niezaufane subdomeny lub aplikacja będzie osadzona w szerszym środowisku same-site).
 4. **Opis problemu:** Operacje zmieniające stan opierają się na ciasteczku sesji i nie mają tokena CSRF ani sprawdzania `Origin/Referer`. `SameSite=Lax` ogranicza typowe ataki cross-site, a wymaganie `application/json` utrudnia prosty formularz HTML, ale nie jest pełną kontrolą CSRF i nie chroni przed scenariuszami same-site.
 5. **Rekomendacja:** Dodać sprawdzanie dozwolonego `Origin` dla POST/DELETE oraz token CSRF (np. synchronizer token lub signed double-submit). Nie polegać wyłącznie na `SameSite`.

 ### AUD-12 — Testy są zbyt wąskie względem ryzyka produkcyjnego

 1. **Lokalizacja:** `test/auth.test.js:10-25`, `test/server.test.js:14-279`.
 2. **Kategoria:** Jakość / Bezpieczeństwo.
 3. **Poziom krytyczności:** **Średni**.
 4. **Opis problemu:** Testy sprawdzają normalizację, podstawową izolację syntetycznych użytkowników, nagłówki i walidację body, ale nie sprawdzają rzeczywistego `signUp/signIn/refresh/signOut`, atrybutów ciasteczek, wygaśnięcia access tokena, CSRF, rate limiting, konfiguracji produkcyjnej bez Supabase, atomowości autosave, korupcji pliku, wyścigów ani maksymalnego kosztu `/api/matches`. Zielone `npm run check` daje więc zbyt wysoką pewność.
 5. **Rekomendacja:** Dodać testy kontraktowe Auth z mockiem odświeżania, testy bezpieczeństwa ciasteczek i Origin, test fail-closed dla produkcji, test przerwanego autosave, testy graniczne liczb/Unicode/pustych wartości oraz benchmark/limit dla algorytmu dopasowania.

 ### AUD-13 — Zależności są zakresowe, a audyt dotyczy tylko bieżącego lockfile

 1. **Lokalizacja:** `package.json:13-16`, `package-lock.json`.
 2. **Kategoria:** Jakość / Supply chain.
 3. **Poziom krytyczności:** **Niski**.
 4. **Opis problemu:** `@supabase/supabase-js` i `sql.js` mają zakres `^`, więc przyszła instalacja może pobrać nowsze wersje niż te lokalnie zweryfikowane. Obecny `npm audit --omit=dev` nie znalazł CVE, ale wynik jest prawdziwy tylko dla obecnego lockfile i nie zastępuje ciągłego monitoringu.
5. **Rekomendacja:** Commitować i używać `npm ci`, utrzymywać automatyczny Dependabot/Renovate lub skan SCA w CI, testować aktualizacje i rozważyć przypięcie wersji w aplikacji o podwyższonych wymaganiach powtarzalności.

**Status po poprawce 2026-07-28:** częściowo zamknięte. Bezpośrednia zależność
`@supabase/supabase-js` jest przypięta do `2.110.8`, CI używa `npm ci` oraz
wykonuje `npm audit --omit=dev --audit-level=moderate`. Nadal potrzebny jest
ciągły proces aktualizacji i przeglądu zmian zależności, np. Dependabot lub
Renovate; bieżący audyt dotyczy aktualnego lockfile.

 ## Dodatkowe obserwacje pozytywne

 - SQL SQLite używa placeholderów (`server.js:831-844`), więc w przejrzanych ścieżkach nie znalazłem SQL injection.
 - Frontend renderuje wartości użytkownika przez `textContent` (`app.js:418-444`, `app.js:472-482`), a CSP nie dopuszcza inline script; nie znalazłem prostego reflected/stored XSS.
 - Backend jawnie wybiera pola katalogu (`server.js:769-774`), a sekret Supabase nie jest przekazywany do klienta Auth ani odpowiedzi API.
 - Migracje `profiles` i `yarns` mają RLS oraz warunki `auth.uid() = user_id`; test syntetyczny potwierdza izolację dwóch użytkowników, ale nie zastępuje testu na prawdziwej bazie.
 - Obsługa błędów API nie zwraca stack trace (`server.js:1083-1098`), choć szczegółowe komunikaty z usług zewnętrznych trafiają do logów i wymagają polityki redakcji.

 ## TOP 5 przed produkcją

 1. **Zablokować automatyczny fallback do SQLite w produkcji** i wymusić fail-closed przy braku Supabase (AUD-01).
 2. **Wymusić HTTPS i HSTS na reverse proxy** po potwierdzeniu konfiguracji domeny (AUD-02).
 3. **Dodać rate limiting na reverse proxy, monitoring i ochronę rozproszoną** dla logowania i rejestracji (AUD-03).
 4. **Dodać wersjonowanie i retry dla autosave** oraz rozważyć atomowość całej serii zmian (AUD-04).
 5. **Opcjonalnie skalować `/api/matches`** przez paginację, dalszą optymalizację lub workera, jeśli benchmark albo wzrost limitów pokaże taką potrzebę (AUD-05, AUD-06).

 ## Podsumowanie końcowe

 Projekt jest na dobrym etapie prototypu/wersji alpha i ma kilka świadomie wdrożonych zabezpieczeń, ale obecny zestaw testów nie daje jeszcze wystarczającej gwarancji bezpiecznego wdrożenia wieloużytkownikowego. Najważniejsze pozostałe kwestie to ochrona logowania, bezpieczna konfiguracja ciasteczek, limity kosztownych operacji, wersjonowanie autosave oraz testy awarii i obciążenia. Po ich zamknięciu można przejść do testu stagingowego z prawdziwym Supabase i przeglądu konfiguracji hostingu.

---

# Audyt iteracja 2 — wersja 2.0.0-alpha.9

Data audytu: 2026-07-28
Zakres: aktualny `server.js`, `app.js`, `supabase.js`, `README.md`, `SPEC.md`,
migracje Supabase, skrypty importu, testy i konfiguracja npm.

## Prompt audytu zastosowany w tej iteracji

Audyt został wykonany z perspektywy Senior QA Engineer / Security Reviewer.
Sprawdzono: OWASP Top 10 i AppSec, sekrety i dane wrażliwe, walidację wejścia,
autoryzację endpointów, zależności i CVE, obsługę błędów, architekturę,
logikę biznesową, współbieżność, transakcje, wartości graniczne, duże wolumeny,
błędy usług zewnętrznych, jakość kodu, utrzymywalność i pokrycie testami.
Każde ustalenie zawiera lokalizację, kategorię, krytyczność, opis i rekomendację.
Nie zakładano, że brak testu oznacza poprawność. Nie odczytywano plików sekretów.

## Metoda i wynik kontroli

- `npm run check` — **20 testów przechodzi**;
- `node --check server.js` i `node --check app.js` — bez błędów;
- `npm audit --omit=dev --audit-level=moderate` — **0 znanych podatności**
  w aktualnym lockfile;
- przegląd statyczny kodu, migracji, skryptów importu i poprzednich ustaleń;
- nie wykonano testów na prawdziwym projekcie Supabase, testów penetracyjnych,
  testów wieloprocesowych ani testów reverse proxy/hostingu.

## Status poprzednich ustaleń

- **AUD-01 SQLite fallback** — nieaktualne jako problem bieżącego kodu; SQLite
  został usunięty, a start wymaga Supabase. Historyczny opis pozostaje dla śladu
  migracji.
- **AUD-02 Secure cookies** — częściowo zamknięte przez `COOKIE_SECURE=true`
  wymagane w produkcji; HTTPS i HSTS nadal należą do reverse proxy/hostingu.
- **AUD-03 rate limiting** — częściowo zamknięte w pojedynczym procesie;
  pozostają problemy pamięci, wielu instancji i reverse proxy opisane niżej.
- **AUD-04 autosave** — częściowo zamknięte przez zapis per rekord; nadal nie
  ma atomowości całej serii, wersjonowania ani ochrony przed dwiema kartami.
- **AUD-05/AUD-06 ranking** — dodano limity, szybkie odrzucanie i obsługę wielu
  motków; wybór najlepszego podzbioru jest nadal heurystyczny.
- **AUD-07/AUD-08/AUD-09/AUD-11/AUD-12/AUD-13** — pozostają otwarte albo
  częściowo otwarte zgodnie z ustaleniami poniżej.

## Nowe i ponownie potwierdzone problemy

### AUD-14 — Status zawieszonego użytkownika nie jest egzekwowany

1. **Lokalizacja:** `server.js:293-338` (`getAuthenticatedSession`),
   `server.js:996-1045` (`handleApi`); `supabase/migrations/20260724000000_create_profiles_auth.sql`.
2. **Kategoria:** Bezpieczeństwo — kontrola dostępu / broken authorization.
3. **Poziom krytyczności:** **Wysoki**.
4. **Opis problemu:** Tabela `profiles` ma pola `status` z wartościami
   `active`, `suspended` i `banned`, ale `getAuthenticatedSession` zwraca
   sesję jako poprawną niezależnie od statusu profilu. W efekcie użytkownik
   oznaczony jako zawieszony lub zablokowany może nadal korzystać z magazynu,
   rankingu i innych endpointów wymagających sesji. Brak profilu także nie
   powoduje fail-closed — profil jest wtedy tylko ustawiany na `null`.
5. **Rekomendacja:** Po odczycie profilu odrzucać status `suspended` i `banned`
   kodem 403, a brak profilu traktować jako błąd konfiguracji lub niepełną
   sesję. Dodać testy dla wszystkich statusów oraz test bez profilu.

**Status po poprawce 2026-07-28:** naprawione w `server.js`. Tylko profil ze
statusem `active` jest uznawany za aktywną sesję; statusy `suspended`, `banned`
i inne nieaktywne kończą się kodem 403, a brak profilu lub błąd jego odczytu
kończy się unieważnieniem ciasteczek i odpowiedzią 401 na chronionych endpointach.
Dodano testy dla profilu zawieszonego i brakującego. Weryfikacja: `npm run check`
— 20/20 testów zakończonych powodzeniem.

### AUD-15 — Rate limiter jest lokalny, podatny na wzrost pamięci i błędny za proxy

1. **Lokalizacja:** `server.js:119-175` (`createAuthRateLimiter`),
   `server.js:155-160` (`getClientAddress`).
2. **Kategoria:** Bezpieczeństwo — availability / brute force / skalowanie.
3. **Poziom krytyczności:** **Wysoki**.
4. **Opis problemu:** Limiter przechowuje klucze w bezterminowej mapie procesu.
   Atakujący może generować nieudane próby z wieloma adresami e-mail, tworząc
   stale nowe wpisy i zwiększając zużycie pamięci. Przy wielu instancjach Node.js
   każda instancja ma własny limit, więc ochrona może być obchodzona. Za reverse
   proxy wszystkie żądania mogą mieć jeden adres socketu proxy, co z kolei może
   zablokować legalnych użytkowników. Kod słusznie nie ufa dowolnemu
   `X-Forwarded-For`, ale nie ma konfigurowanej listy zaufanych proxy.
5. **Rekomendacja:** Przenieść główny limiter do reverse proxy lub współdzielonego
   magazynu (np. Redis), ograniczyć liczbę wpisów przez TTL/LRU i dodać limit
   liczby prób po stronie infrastruktury. Wprowadzić jawne `TRUSTED_PROXY` oraz
   bezpieczne ustalanie prawdziwego adresu klienta. Zwracać `Retry-After` dla 429.

**Status po poprawce 2026-07-28:** częściowo zamknięte w procesie aplikacji.
Limiter usuwa wygasłe wpisy, ma limit 10 000 wpisów i zwraca `Retry-After` dla
odpowiedzi 429. Ochrona nadal nie jest współdzielona między instancjami i nie
rozwiązuje identyfikacji klienta za niezaufanym reverse proxy; te elementy
pozostają zadaniem infrastruktury przed wdrożeniem wieloinstancyjnym.

### AUD-16 — Limit 500 włóczek nie jest atomowy i nie jest egzekwowany w bazie

1. **Lokalizacja:** `server.js:393-411` (`insertSupabaseYarn`),
   `server.js:846-853` (`validateYarnStorageCapacity`), migracja `yarns`.
2. **Kategoria:** Logika / integralność danych / współbieżność.
3. **Poziom krytyczności:** **Średni**.
4. **Opis problemu:** Backend najpierw pobiera aktualną liczbę włóczek, a potem
   wykonuje osobny insert. Dwa równoczesne żądania przy stanie 499 mogą oba
   zobaczyć 499 i oba zapisać rekord, przekraczając limit 500. Limit nie jest też
   zapisany w polityce, triggerze ani funkcji bazodanowej. Bezpośredni dostęp
   przez inne zaufane ścieżki lub import może ominąć limit aplikacji.
5. **Rekomendacja:** Egzekwować limit w kontrolowanej funkcji bazodanowej z
   blokadą/advisory lock albo innym atomowym mechanizmem. Dodać test równoległych
   POST-ów i test po przekroczeniu limitu. Utrzymywać limit także w procesie
   importu/administracji, nie tylko w HTTP API.

**Status po poprawce 2026-07-28:** naprawione dla ścieżki HTTP użytkownika.
Insert korzysta z funkcji Supabase `insert_yarn_with_limit`, która blokuje
operacje dla użytkownika w transakcji, sprawdza limit i dopiero wtedy zapisuje
rekord. Kontrola aplikacyjna nie wykonuje już podatnego na wyścig odczytu count
przed insertem. Dodano test odpowiedzi po osiągnięciu limitu. Migracja została
zastosowana na zdalnym Supabase i zweryfikowana po problemie z odpowiedzią 500.

### AUD-17 — Limit katalogu 300 jest tylko kontrolą odczytu, nie regułą danych

1. **Lokalizacja:** `server.js:829-864` (`getCatalogPatterns`,
   `validatePatternCatalogSize`), `scripts/import-patterns.js:14-145`.
2. **Kategoria:** Architektura / integralność danych / operacje.
3. **Poziom krytyczności:** **Średni**.
4. **Opis problemu:** Aplikacja pobiera cały katalog, a dopiero potem zwraca
   błąd, jeśli jest więcej niż 300 rekordów. Importer nie sprawdza limitu przed
   `upsert`, więc może zapisać większy katalog i dopiero później zepsuć endpointy
   katalogu oraz rankingu. To powoduje awarię funkcji zamiast kontrolowanego
   odrzucenia importu.
5. **Rekomendacja:** Walidować limit w trybie check przed wykonaniem importu,
   sprawdzać finalny count przed zapisem i odrzucać batch, który przekroczy 300.
   Docelowo dodać administracyjną funkcję importu z kontrolą transakcyjną lub
   wersjonowaniem zestawu danych.

**Status po poprawce 2026-07-28:** naprawione dla endpointu katalogu i
importera. Endpoint sprawdza `count/head` przed pobraniem rekordów. Importer
wylicza przewidywany stan po upsertach i odrzuca przekroczenie limitu już w
trybie `patterns:check`, a po zapisie wykonuje dodatkową kontrolę finalnego
count. Dodano test walidacji pojemności importu.

### AUD-18 — Ranking na podzbiorze może zwrócić fałszywy brak dopasowania

1. **Lokalizacja:** `server.js:619-664` (`selectMatchingYarns`),
   `server.js:575-604` (`getSupabaseMatches`), `app.js:306-345`.
2. **Kategoria:** Logika biznesowa / jakość wyniku / edge case.
3. **Poziom krytyczności:** **Wysoki**.
4. **Opis problemu:** Gdy użytkownik ma więcej niż 50 kompatybilnych motków,
   ranking wybiera 50 rekordów na podstawie indywidualnego iloczynu metrów i
   gramów. Taka heurystyka może pominąć wiele mniejszych motków, które dopiero
   razem spełniają wymaganie, albo pominąć kombinację pokrywającą różne role.
   API zwraca wtedy brak wyniku, mimo że pełny magazyn mógłby spełniać wzór.
   Komunikat w UI informuje o podzbiorze, ale nie oznacza wyniku jako
   przybliżonego ani nie gwarantuje kompletności.
5. **Rekomendacja:** Rozróżnić wynik dokładny od przybliżonego w kontrakcie API.
   Dla limitu 500 użyć deterministycznego bounded knapsack/DP lub algorytmu z
   dowodem pokrycia, a przy nierozstrzygniętym wyniku pokazać „nie sprawdzono
   całego magazynu”. Dodać testy fałszywego braku dopasowania dla wielu małych
   motków i wielu ról.

**Status po poprawce 2026-07-28:** naprawione dla obecnego limitu 500 włóczek.
Usunięto heurystyczne obcinanie kwalifikujących się rekordów do 50, więc ranking
analizuje cały magazyn i nie zwraca fałszywego braku tylko z powodu liczby
włóczek. Limit złożoności wyszukiwania pozostaje ochroną przed nadmiernie
trudnymi wzorami; w takim przypadku aplikacja zwraca kontrolowany błąd 503,
zamiast udawać kompletny wynik. Zaktualizowano test wyboru kandydatów.

### AUD-19 — Autosave nadal może usuwać zmiany z innej karty

1. **Lokalizacja:** `app.js:146-177` (`saveYarns`), endpointy `PATCH/DELETE`
   w `server.js:1013-1032`.
2. **Kategoria:** Logika / integralność danych / współbieżność.
3. **Poziom krytyczności:** **Średni**.
4. **Opis problemu:** Zapis per rekord usunął najgroźniejszy scenariusz
   „skasuj wszystko i odtwórz”, ale nie ma `updated_at`/wersji klienta ani
   optimistic locking. Dwie karty mogą pobrać różne stany; późniejszy autosave
   może usunąć włóczkę dodaną w drugiej karcie, bo nie ma jej w swoim DOM.
   Seria operacji nadal nie jest atomowa i może zakończyć się częściowym stanem.
5. **Rekomendacja:** Dodać wersję magazynu lub `updated_at` do operacji zapisu,
   odrzucać konflikt kodem 409 i odświeżać stan użytkownika. Rozważyć endpoint
   synchronizacji różnic z idempotency key zamiast pełnego porównania DOM.

**Status po poprawce 2026-07-28:** częściowo zamknięte. Backend generuje
wersję magazynu jako `ETag`, wymaga jej w `If-Match` przy POST/PATCH/DELETE i
odrzuca nieaktualną kartę kodem 409. Frontend przekazuje aktualną wersję i
odbiera nową po każdej operacji. Chroni to przed cichym nadpisaniem zmian z
drugiej karty; cały autosave nadal składa się z wielu operacji i może wymagać
ponowienia po konflikcie.

### AUD-20 — Brak timeoutów żądań i ochrony przed slowloris

1. **Lokalizacja:** `server.js:666-709` (`readBody`) oraz `server.js:1099-1148`
   (serwer HTTP).
2. **Kategoria:** Bezpieczeństwo — availability / DoS.
3. **Poziom krytyczności:** **Średni**.
4. **Opis problemu:** `readBody` ogranicza rozmiar JSON, ale czeka na kolejne
   fragmenty strumienia bez własnego deadline. Serwer nie ustawia jawnie
   `requestTimeout`, `headersTimeout` ani `keepAliveTimeout`. Powolny klient
   może długo zajmować połączenie, a pojedynczy proces Node.js jest punktem
   koncentracji obsługi.
5. **Rekomendacja:** Ustawić timeouty serwera i deadline odczytu body, przerwać
   żądanie po przekroczeniu czasu, ustawić limity połączeń na proxy i dodać test
   powolnego klienta. Timeouty zewnętrznych wywołań Supabase również powinny być
   jawnie kontrolowane.

**Status po poprawce 2026-07-28:** częściowo zamknięte. Serwer ma timeout
żądania 30 s, nagłówków 10 s i keep-alive 5 s. Dodano ograniczenia żądań:
rejestracja/logowanie do 30 prób na minutę dla kluczy IP/e-mail oraz zapisy
włóczek do 600 operacji na minutę dla IP i użytkownika, z limitem pamięci i
`Retry-After`. Chroni to aplikację przed typowym zalewaniem endpointów, ale nie
jest pełną ochroną DDoS przed rozproszonym atakiem; przed produkcją potrzebny
jest reverse proxy/WAF/CDN z limitem połączeń i ruchem filtrowanym przed Node.js.

### AUD-21 — Brak osobnej ochrony CSRF i kontroli Origin

1. **Lokalizacja:** `server.js:184-203` (ciasteczka), `server.js:912-990`
   (Auth), `server.js:996-1045` (operacje zmieniające stan).
2. **Kategoria:** Bezpieczeństwo — CSRF.
3. **Poziom krytyczności:** **Średni**.
4. **Opis problemu:** Operacje POST/PATCH/DELETE uwierzytelniają użytkownika
   ciasteczkiem, ale nie sprawdzają `Origin`/`Referer` i nie używają tokena CSRF.
   `SameSite=Lax` i wymóg `application/json` ograniczają typowe ataki, lecz nie
   są pełną kontrolą, szczególnie w środowisku z zaufanymi subdomenami lub
   nietypowym reverse proxy.
5. **Rekomendacja:** Wprowadzić allowlistę `Origin` dla żądań zmieniających
   stan oraz synchronizer token albo signed double-submit cookie. Dodać testy
   żądań z obcym i brakującym Origin.

**Status po poprawce 2026-07-28:** częściowo zamknięte. Żądania POST/PATCH/DELETE
muszą mieć zgodny `Origin` albo `Referer`; brak nagłówka i obce źródło kończą się
odpowiedzią 403. W produkcji wymagane jest jawne `APP_ORIGIN`, a w środowisku
lokalnym origin jest wyliczany z hosta testowego. Ciasteczka nadal korzystają z
`SameSite=Lax`; pełny synchronizer token CSRF pozostaje opcjonalnym kolejnym
wzmocnieniem, jeśli aplikacja będzie obsługiwać złożone scenariusze subdomen.

### AUD-22 — Brak egzekwowania profilu i statusu w testach integracyjnych

1. **Lokalizacja:** `test/server.test.js`, `test/auth.test.js`,
   `server.js:293-338`.
2. **Kategoria:** Jakość / Bezpieczeństwo.
3. **Poziom krytyczności:** **Średni**.
4. **Opis problemu:** 20 testów obejmuje syntetyczny magazyn i funkcje
   konfiguracyjne, ale nie wykonuje rzeczywistych kontraktów `signUp`, `signIn`,
   refresh, logout, blokady statusu profilu, CSRF, timeoutów, równoległych
   zapisów ani testu podzbioru rankingu, który prowadzi do fałszywego braku.
   Zielone testy nie są więc dowodem gotowości produkcyjnej.
5. **Rekomendacja:** Dodać testy kontraktowe Auth z mockiem odświeżania,
   testy statusów profilu, konkurencyjnych POST/PATCH/DELETE, 429 i `Retry-After`,
   limitu katalogu/importu, timeoutów, Origin oraz property-based testy alokacji.

**Status po poprawce 2026-07-28:** częściowo zamknięte. Dodano syntetyczny
test rejestracji i logowania, testy statusu profilu, konfliktu wersji magazynu,
limitów, limiterów, Origin/CSRF i importera; pakiet obejmuje teraz 24 testy.
Pozostają testy wymagające stagingowego Supabase, rzeczywistego odświeżania
tokenów, wielu procesów, reverse proxy, awarii sieci i obciążenia produkcyjnego.

### AUD-23 — Limity produktu są niespójne z bezpośrednimi ścieżkami administracyjnymi

1. **Lokalizacja:** `scripts/import-patterns.js:93-145`, migracje `patterns` i
   `yarns`, kontrola limitów w `server.js:846-864`.
2. **Kategoria:** Architektura / operacje / integralność danych.
3. **Poziom krytyczności:** **Niski** (podwyższony do **Średniego** przy
   udostępnieniu importu osobom innym niż zaufany operator).
4. **Opis problemu:** Limity 500/300 są regułami backendu HTTP, a nie wspólnym
   kontraktem danych. Import patterns używa `service_role` i nie ma kontroli
   limitu przed `upsert`. Zmiana danych przez panel Supabase lub skrypt może
   stworzyć stan, którego aplikacja nie potrafi obsłużyć.
5. **Rekomendacja:** Umieścić limity w jednym module/konfiguracji używanej przez
   backend i importer, dodać kontrolę przed zapisem oraz procedurę operatora,
   która blokuje przekroczenie limitu i raportuje różnicę.

**Status po poprawce 2026-07-28:** częściowo zamknięte. Backend i importer
korzystają ze wspólnego modułu `limits.js`. Dodano migrację z triggerem
Supabase, który blokuje 301. nowy wzór także przy zapisie przez `service_role`,
z zachowaniem możliwości aktualizacji istniejących wzorów przy count=300.
Migracja została zastosowana na zdalnej bazie i zweryfikowana. Pozostaje
sprawdzenie uprawnień i logów importera w stagingu przed wdrożeniem produkcyjnym.

## Pozytywne elementy potwierdzone w iteracji

- brak sekretów w kodzie i brak odczytu `.env` przez audyt;
- `SUPABASE_URL` wymaga HTTPS i nie może zawierać danych logowania;
- klucz `sb_secret_` pozostaje po stronie backendu, a Auth używa klucza
  publishable;
- RLS `profiles` i `yarns` ogranicza rekordy do właściciela;
- frontend renderuje dane użytkownika przez `textContent`, a CSP blokuje inline
  skrypty;
- wejście JSON ma limit rozmiaru, a pola włóczki mają walidację typów, zakresów
  i dozwolonych wartości;
- bieżący lockfile nie ma podatności wykrytych przez `npm audit`;
- błędy API nie zwracają stack trace klientowi.

## Werdykt iteracji 2

**Nie rekomenduję wdrożenia produkcyjnego bez zamknięcia AUD-14, AUD-15,
AUD-18, AUD-20 i AUD-21.** Kod ma dobre podstawy: Supabase jest wymagany,
RLS chroni własność włóczek, sekrety nie trafiają do frontendu, a limity i
rate limiting ograniczają część ryzyk. Nadal jednak są istotne luki w egzekwowaniu
statusu użytkownika, ochronie rozproszonej, współbieżności, kompletności
rankingu i odporności serwera na powolne/masowe żądania. Brak podatności z
`npm audit` nie zastępuje testu konfiguracji Supabase, reverse proxy i hostingu.

## TOP 5 przed produkcją — iteracja 2

1. **Egzekwować `profiles.status` i brak profilu jako fail-closed** — AUD-14.
2. **Przenieść rate limiting poza pojedynczy proces i ograniczyć pamięć mapy** — AUD-15.
3. **Rozstrzygnąć, kiedy ranking jest dokładny, oraz naprawić fałszywe braki
   wyników przy podzbiorze 50 motków** — AUD-18.
4. **Dodać timeouty HTTP/body i ochronę reverse proxy przed slowloris** — AUD-20.
5. **Dodać Origin/CSRF oraz testy współbieżności i limitów** — AUD-21, AUD-16,
   AUD-22.

## Ograniczenia audytu

Nie wykonano testów na produkcyjnym Supabase, testów penetracyjnych, testów
z wielu procesów Node.js, testów z rzeczywistym reverse proxy, testów awarii
sieci podczas autosave ani testów obciążeniowych z 500 włóczkami i 300 wzorami.
Wnioski dotyczące RLS, providerów Auth, HTTPS, HSTS i limitów infrastruktury
wymagają potwierdzenia w docelowym środowisku wdrożeniowym.

## Kolejny krok rozwojowy — pełna ochrona DDoS

Zadanie odłożone do etapu konfiguracji produkcyjnej:

- wybrać CDN/WAF lub reverse proxy przed Node.js;
- skonfigurować limity połączeń i rate limiting na brzegu dla Auth, API i zasobów;
- nie udostępniać bezpośredniego adresu originu aplikacji;
- dodać monitoring ruchu, alerty i procedurę reakcji na incydent;
- wykonać testy konfiguracji z rzeczywistej sieci i sprawdzić odporność pod obciążeniem.

Limity i timeouty w aplikacji Motek pozostają warstwą dodatkową i nie zastępują
ochrony infrastrukturalnej przed atakiem rozproszonym.

## Audyt iteracja 3 — wykonany na podstawie PROMPTS.md

Data audytu: 2026-07-28. Zakres obejmował server.js, app.js, supabase.js,
limits.js, skrypt importu, migracje Supabase, testy, konfigurację npm oraz
zdalny projekt Supabase. Nie odczytywano pliku .env ani innych sekretów.

### Wyniki weryfikacji

- npm run check: 26/26 testów zaliczonych.
- npm audit --omit=dev: 0 wykrytych podatności.
- Zdalny projekt Supabase ma status ACTIVE_HEALTHY.
- Zdalna historia migracji zawiera wszystkie migracje zapisane w repozytorium,
  w tym limity 500/300 i walidację wymagań dopasowania.
- RLS jest włączone dla public.patterns, public.profiles i public.yarns.
  profiles ma 2 polityki, yarns 4 polityki, a patterns 0 polityk.

### AUD-23 — Publicznie wykonywalna funkcja SECURITY DEFINER w Supabase

1. Lokalizacja: zdalny Supabase, public.rls_auto_enable(); funkcja nie występuje
   w lokalnych migracjach projektu.
2. Kategoria: Bezpieczeństwo / kontrola dostępu.
3. Poziom krytyczności: Wysoki do czasu potwierdzenia przeznaczenia.
4. Opis problemu: Supabase Security Advisor wykrywa, że role anon i
   authenticated mogą wykonywać funkcję SECURITY DEFINER przez RPC. Taka
   funkcja działa z uprawnieniami właściciela, więc publiczna możliwość jej
   wywołania może prowadzić do obejścia RLS lub modyfikacji schematu — zależnie
   od jej ciała. Nie ma jej w kontrolowanym repozytorium.
5. Rekomendacja: Odczytać i ocenić ciało funkcji. Jeśli nie jest wymagana,
   przenieść ją poza public albo odebrać EXECUTE rolom public, anon i
   authenticated. Dodać bezpieczną zmianę jako migrację i ponownie uruchomić
   Security Advisor.

**Status po poprawce 2026-07-28:** zamknięte. Odebrano EXECUTE rolom `public`,
`anon` i `authenticated`; weryfikacja potwierdziła ACL ograniczone do właściciela
`postgres`, a Security Advisor przestał zgłaszać tę funkcję.

### AUD-24 — Ochrona przed wyciekłymi hasłami jest wyłączona

1. Lokalizacja: zdalny Supabase Auth, ustawienie leaked password protection.
2. Kategoria: Bezpieczeństwo / uwierzytelnianie.
3. Poziom krytyczności: Średni.
4. Opis problemu: Supabase Security Advisor zgłasza wyłączoną kontrolę haseł
   znajdujących się w bazach wycieków. Lokalna polityka złożoności hasła nie
   wykrywa haseł znanych z wcześniejszych incydentów.
5. Rekomendacja: Włączyć leaked password protection w konfiguracji Auth i
   wykonać test rejestracji z hasłem odrzuconym przez tę ochronę.

**Status po weryfikacji 2026-07-28:** odłożone z przyczyn planu Supabase.
Aktualny plan projektu nie pozwala włączyć tej funkcji bez zakupu płatnego
planu. Wymaganie pozostaje zapisane jako przyszłe usprawnienie bezpieczeństwa;
lokalna walidacja złożoności haseł nadal działa, ale nie zastępuje sprawdzania
hasła względem baz wycieków.

### AUD-25 — Rate limiting nie skaluje się między procesami

1. Lokalizacja: server.js:142-212, authRateLimiter,
   authRequestRateLimiter i yarnWriteRateLimiter.
2. Kategoria: Bezpieczeństwo / dostępność / architektura.
3. Poziom krytyczności: Średni.
4. Opis problemu: Limity są przechowywane w pamięci pojedynczego procesu
   Node.js. Przy kilku instancjach atakujący może rozłożyć żądania między
   procesy, a restart usuwa stan ochrony.
5. Rekomendacja: Ustawić limit połączeń i rate limiting na reverse proxy/WAF,
   a dla wielu instancji przenieść stan limitera do współdzielonego magazynu,
   np. Redis. Limiter aplikacyjny zachować jako warstwę dodatkową.

### AUD-26 — Brak osobnego deadline'u dla powolnego body żądania

1. Lokalizacja: server.js:806-849, readBody; timeouty server.js:1348-1350.
2. Kategoria: Bezpieczeństwo / dostępność / edge case.
3. Poziom krytyczności: Średni.
4. Opis problemu: Serwer ogranicza rozmiar JSON i ustawia timeouty HTTP, ale nie
   przerywa jednoznacznie powolnego przesyłania body po krótkim deadline'ie.
   Klient może utrzymywać połączenie, wysyłając małe fragmenty.
5. Rekomendacja: Dodać deadline obejmujący całe odebranie body, obsłużyć
   req.destroy() po jego przekroczeniu i ustawić limity połączeń na proxy.
   Dodać test klienta wysyłającego body fragmentami.

### AUD-27 — Autosave nie pokazuje błędu i może pozostawić UI w stanie lokalnym

1. Lokalizacja: app.js:88-108, scheduleAutosave; app.js:155-190,
   saveYarns.
2. Kategoria: Jakość / logika biznesowa / UX.
3. Poziom krytyczności: Średni.
4. Opis problemu: Asynchroniczna funkcja uruchomiona przez setTimeout nie ma
   końcowej obsługi odrzuconej obietnicy. Błąd limitu, konfliktu wersji, sieci
   lub Supabase może skończyć się bez komunikatu w interfejsie. Użytkownik widzi
   zmienione pola, choć zapis mógł się nie udać.
5. Rekomendacja: Dodać try/catch wokół pętli autosave, komunikat o błędzie i stan
   zapisano / zapisywanie / konflikt / błąd. Przy konflikcie odświeżać magazyn
   dopiero po decyzji użytkownika.

**Status po poprawce 2026-07-28:** częściowo zamknięte. Autosave przechwytuje
 błędy, pokazuje stan zapisu i pozostawia zmiany w formularzu. Pełne retry,
 atomowość serii operacji i interaktywny wybór przy konflikcie pozostają do
 dalszego usprawnienia.

### AUD-28 — Ranking nadal wykonuje pełny odczyt i wyszukiwanie magazynu

1. Lokalizacja: server.js:741-769, getSupabaseMatches; server.js:785-804,
   selectMatchingYarns; server.js:671-738, allocateRequirementYarns.
2. Kategoria: Architektura / wydajność / logika biznesowa.
3. Poziom krytyczności: Średni przy obecnych limitach, Wysoki po ich zwiększeniu.
4. Opis problemu: selectMatchingYarns wybiera wszystkie kwalifikujące się
   włóczki i zawsze zwraca limited: false. Komunikat frontendowy o podzbiorze
   jest więc nieaktywny, a trudne wymagania mogą zakończyć się 503 po przekroczeniu
   limitu 25 000 węzłów.
5. Rekomendacja: Ustalić i udokumentować, czy wynik ma być dokładny. Zastosować
   bounded search/DP, selekcję kandydatów z jawnym oznaczeniem podzbioru albo
   workera z limitem czasu i anulowaniem. Dodać benchmark dla 500 włóczek.

### AUD-29 — Walidacja JSONB w bazie jest słabsza niż walidacja importera

1. Lokalizacja: migracja 20260728000002_validate_pattern_matching_requirements.sql,
   scripts/import-patterns.js:19-54.
2. Kategoria: Integralność danych / bezpieczeństwo / utrzymywalność.
3. Poziom krytyczności: Średni.
4. Opis problemu: Trigger bazy sprawdza typy i dodatnie liczby, ale nie ogranicza
   liczby wariantów, długości tablic, liczby elementów tekstowych ani etykiet.
   Bezpośredni zapis przez service_role może zaakceptować JSON, który backend
   później częściowo pominie albo który zwiększy koszt rankingu.
5. Rekomendacja: Zdefiniować jeden kontrakt JSONB z limitami strukturalnymi i
   używać go w importerze, triggerze oraz normalizerze. Dodać testy negatywne.

### AUD-30 — Brakująca migracja daje nieinformatywny błąd 500

1. Lokalizacja: server.js:544-570, insertSupabaseYarn.
2. Kategoria: Operacje / diagnostyka / jakość API.
3. Poziom krytyczności: Niski po zastosowaniu migracji, Średni przy rozjechanym
   schemacie.
4. Opis problemu: Gdy RPC insert_yarn_with_limit nie istnieje, każdy błąd poza
   P0001 jest zamieniany na ogólny 500. W praktyce ukryło to brak migracji i
   utrudniło diagnozę zapisu włóczki.
5. Rekomendacja: Rozpoznać kody PGRST202 lub brak funkcji i zwracać 503 z
   komunikatem operacyjnym bez szczegółów bazy. W CI/CD sprawdzać zgodność
   migracji przed startem backendu.

### AUD-31 — Import katalogu nie jest atomowy

1. Lokalizacja: scripts/import-patterns.js:138-157, importRecords.
2. Kategoria: Logika / integralność danych / operacje.
3. Poziom krytyczności: Średni.
4. Opis problemu: Import wykonuje wiele osobnych upsertów po 50 rekordów. Awaria
   po kilku batchach zostawia częściowo zaktualizowany katalog. Limit 300 chroni
   pojemność, ale nie zapewnia rollbacku ani wersjonowania zestawu.
5. Rekomendacja: Importować przez staging table i transakcję po stronie bazy albo
   wersjonowany batch z możliwością wycofania. Zapisywać manifest importu.

## Podsumowanie ogólnego stanu — iteracja 3

Kod ma dobre podstawy: sekrety są rozdzielone od frontendu, dane włóczek mają
RLS i własność użytkownika, aplikacja sprawdza pochodzenie żądań, waliduje JSON,
ma limity wejścia, timeouty HTTP i przypiętą zależność Supabase. Testy lokalne są
zielone, a npm audit nie wykrywa podatności. Nie rekomenduję jednak wdrożenia
produkcyjnego przed zamknięciem publicznej funkcji SECURITY DEFINER w zdalnym
Supabase, włączeniem ochrony wyciekłych haseł, przygotowaniem rate limitingu na
brzegu oraz poprawą obsługi błędów autosave i kosztu rankingu. Ocenę zdalnej
funkcji rls_auto_enable trzeba traktować jako pilną hipotezę do weryfikacji,
ponieważ nie jest obecnie częścią repozytorium.

## TOP 5 najpilniejszych spraw przed produkcją — iteracja 3

1. Po przejściu na plan Supabase obsługujący tę funkcję włączyć leaked password
   protection i wykonać test rejestracji — AUD-24.
2. Dodać ochronę na reverse proxy/WAF i limiter współdzielony między instancjami
   — AUD-25 oraz plan ochrony DDoS.
3. Dodać deadline dla powolnego body i test slowloris — AUD-26.
4. Zdefiniować dokładność i koszt rankingu oraz wykonać benchmark maksimum 500
   włóczek / 300 wzorów — AUD-28.
5. Ujednolicić walidację JSONB i zaplanować atomowy import katalogu — AUD-29,
   AUD-31.

## Ograniczenia audytu — iteracja 3

Nie wykonano testu penetracyjnego, testu z wieloma procesami Node.js, testu
slowloris, testu rzeczywistej współbieżności na produkcyjnym Supabase ani testu
pełnego importu z rollbackiem. Ciało funkcji rls_auto_enable zostało ocenione;
niezależnym ograniczeniem pozostaje brak testu jej działania w scenariuszu
tworzenia tabeli przez operatora.

## Przyszłe usprawnienia zależne od planu Supabase

- Po przejściu na płatny plan włączyć leaked password protection w Supabase
  Auth i potwierdzić jej działanie testem rejestracji.
