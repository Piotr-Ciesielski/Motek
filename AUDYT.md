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

 ### AUD-04 — Autosave wymaga dalszego wzmocnienia atomowości

 1. **Lokalizacja:** `app.js:142-175` (`saveYarns`), `server.js:305-362, 799-811`.
 2. **Kategoria:** Logika / Edge case / niezawodność danych.
 3. **Poziom krytyczności:** **Wysoki**.
 4. **Opis problemu:** Przed zmianą zapis pobierał istniejące rekordy, usuwał je wszystkie, a następnie wykonywał osobne POST-y. Obecnie autosave zapisuje różnice per rekord, więc błąd nie kasuje całego magazynu. Nadal nie ma atomowości całej serii zmian ani wersjonowania/optimistic locking, dlatego równoległe edycje mogą nadpisać część zmian.
 5. **Rekomendacja:** Zastąpić to endpointem atomowym, np. `PUT /api/yarns` przyjmującym cały stan i wykonywanym w transakcji albo operacjami `PATCH/POST/DELETE` na pojedynczych rekordach. Dodać `updated_at`/wersję klienta, idempotency key, obsługę retry oraz test awarii między usunięciem a insertem. Nie kasować danych przed potwierdzeniem poprawnego zapisu nowej wersji.
 6. **Stan po zmianie 2026-07-28:** Autosave korzysta z operacji per rekord (`POST`, `PATCH`, `DELETE`) i nie usuwa już całego magazynu przed zapisem. Pozostają do rozważenia atomowość większych serii zmian, wersjonowanie klienta i retry.

 ### AUD-05 — Algorytm dopasowania ma potencjalnie wykładniczy koszt

 1. **Lokalizacja:** `server.js:506-547` (`allocateRequirementYarns`) oraz `server.js:549-569` (`getSupabaseMatches`).
 2. **Kategoria:** Bezpieczeństwo — denial of service / wydajność.
 3. **Poziom krytyczności:** **Wysoki**.
 4. **Opis problemu:** Przy każdym wymaganiu algorytm przegląda kombinacje włóczek rekurencyjnie. Liczba kombinacji rośnie wykładniczo, a aplikacja nie ogranicza liczby rekordów magazynu na użytkownika, liczby wariantów ani czasu wykonania. Uwierzytelniony użytkownik może dodać wiele rekordów i wywołać `/api/matches`, blokując pojedynczy proces Node.js. Dodatkowo endpoint pobiera cały katalog i cały magazyn bez paginacji.
 5. **Rekomendacja:** Ustalić limit liczby włóczek, wariantów i wymagań; odrzucać lub kolejkować zbyt duże obliczenia; dodać deadline/cancellation. Zastąpić brute force algorytmem sortowania/greedy, DP z limitem stanu albo obliczeniami w bazie/workerze. Dodać test obciążeniowy z realistycznym maksimum.

 ### AUD-06 — Dopasowanie ról może odrzucać poprawny zestaw

 1. **Lokalizacja:** `server.js:518-543` (`chooseGroup`).
 2. **Kategoria:** Logika biznesowa / Edge case.
 3. **Poziom krytyczności:** **Średni**.
 4. **Opis problemu:** Rekurencja kończy wybieranie grupy natychmiast po osiągnięciu `group.length >= requirement.yarnsNeeded` (`server.js:530`). Oznacza to, że gdy wymaganie mówi „1 motek”, ale pojedynczy motek nie ma wystarczającej liczby metrów/gramów, drugi kompatybilny motek nie może zostać dołączony. Wynik może być pusty mimo spełnienia sumy materiału przez kilka motków. To wymaga potwierdzenia semantyki `yarns_needed`; jeśli oznacza minimum, jest to błąd.
 5. **Rekomendacja:** Ustalić w modelu, czy `yarns_needed` oznacza dokładnie czy co najmniej. Dla wartości minimalnej kontynuować wybór po osiągnięciu liczby minimalnej aż do spełnienia metrów/gramów; dla wartości dokładnej dodać walidację danych i test jawnie potwierdzający tę regułę.

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

 ### AUD-09 — Spójność danych `matching_requirements` jest egzekwowana głównie w kodzie aplikacji

 1. **Lokalizacja:** `supabase/migrations/20260727000002_add_pattern_matching_requirements.sql:4-6`, `server.js:679-751`, `scripts/build-pattern-import.py:57-85`.
 2. **Kategoria:** Jakość / Logika biznesowa / integralność danych.
 3. **Poziom krytyczności:** **Średni**.
 4. **Opis problemu:** Migracja wymaga tylko, aby JSONB był obiektem; nie wymusza obecności `variants` ani poprawności pól, zakresów, materiałów i klas. `normalizeMatchingRequirements` cicho odrzuca niepoprawne warianty, przez co rekord może wyglądać poprawnie w katalogu, ale zniknąć z dopasowania bez alarmu. Walidator importu nie chroni przed ręczną zmianą danych z użyciem roli serwerowej.
 5. **Rekomendacja:** Wprowadzić wersjonowany schemat JSON i walidację przed zapisem/importem, raportować odrzucone warianty, odrzucać rekordy z niepoprawnymi wymaganiami zamiast je cicho pomijać oraz dodać testy negatywne dla JSONB.

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

 ## Dodatkowe obserwacje pozytywne

 - SQL SQLite używa placeholderów (`server.js:831-844`), więc w przejrzanych ścieżkach nie znalazłem SQL injection.
 - Frontend renderuje wartości użytkownika przez `textContent` (`app.js:418-444`, `app.js:472-482`), a CSP nie dopuszcza inline script; nie znalazłem prostego reflected/stored XSS.
 - Backend jawnie wybiera pola katalogu (`server.js:769-774`), a sekret Supabase nie jest przekazywany do klienta Auth ani odpowiedzi API.
 - Migracje `profiles` i `yarns` mają RLS oraz warunki `auth.uid() = user_id`; test syntetyczny potwierdza izolację dwóch użytkowników, ale nie zastępuje testu na prawdziwej bazie.
 - Obsługa błędów API nie zwraca stack trace (`server.js:1083-1098`), choć szczegółowe komunikaty z usług zewnętrznych trafiają do logów i wymagają polityki redakcji.

 ## TOP 5 przed produkcją

 1. **Zablokować automatyczny fallback do SQLite w produkcji** i wymusić fail-closed przy braku Supabase (AUD-01).
 2. **Zabezpieczyć ciasteczka i wymusić HTTPS** niezależnie od przypadkowego ustawienia `NODE_ENV` (AUD-02).
 3. **Dodać rate limiting/brute-force protection** dla logowania i rejestracji (AUD-03).
 4. **Dodać wersjonowanie i retry dla autosave** oraz rozważyć atomowość całej serii zmian (AUD-04).
 5. **Ograniczyć koszt `/api/matches` i poprawić alokację włóczek** — limity, timeout/worker oraz testy poprawności dla wielu motków w jednej roli (AUD-05, AUD-06).

 ## Podsumowanie końcowe

 Projekt jest na dobrym etapie prototypu/wersji alpha i ma kilka świadomie wdrożonych zabezpieczeń, ale obecny zestaw testów nie daje jeszcze wystarczającej gwarancji bezpiecznego wdrożenia wieloużytkownikowego. Najważniejsze pozostałe kwestie to ochrona logowania, bezpieczna konfiguracja ciasteczek, limity kosztownych operacji, wersjonowanie autosave oraz testy awarii i obciążenia. Po ich zamknięciu można przejść do testu stagingowego z prawdziwym Supabase i przeglądu konfiguracji hostingu.
