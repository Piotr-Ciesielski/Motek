# Motek Security and UX Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zamknąć najważniejsze ryzyka bezpieczeństwa Motka przed wdrożeniem publicznym oraz naprawić krytyczne problemy responsywności, kontrastu, formularzy i feedbacku wskazane w audycie UX/UI.

**Architecture:** Prace są podzielone na dwa strumienie. Strumień bezpieczeństwa obejmuje backend Node.js, konfigurację Auth, Supabase/RLS/migracje, ochronę żądań i integralność danych. Strumień UX/UI obejmuje istniejący frontend HTML/CSS/JS bez zmiany technologii, z testami DOM, testami layoutu i ponowną kontrolą w przeglądarce. Każdy task kończy się osobnym sprawdzeniem, a produkcja jest blokowana do czasu spełnienia bramki bezpieczeństwa.

**Tech Stack:** Node.js HTTP server, HTML/CSS/vanilla JavaScript, Supabase Auth/Postgres/RLS, Supabase migrations, Node test runner, npm, lokalna przeglądarka.

## Global Constraints

- Sekretny klucz Supabase pozostaje wyłącznie po stronie backendu i nie trafia do frontendu, logów ani Git.
- Produkcja wymaga HTTPS oraz `COOKIE_SECURE=true`; lokalny development może używać `COOKIE_SECURE=false` tylko na localhost.
- Dane włóczek są prywatne i ograniczone do właściciela przez sesję oraz RLS.
- Limit produktu pozostaje: maksymalnie 500 włóczek na użytkownika i 300 wzorów w katalogu.
- Brak kompletnych danych wzoru nie może być przedstawiany jako dokładne dopasowanie.
- Nie wolno wykonywać destrukcyjnych migracji, usuwać danych testowych ani wdrażać na produkcję bez osobnej zgody.
- Każda zmiana obejmująca Supabase wymaga przeglądu RLS, funkcji uprzywilejowanych, grantów i wyniku `supabase db advisors`.
- Każdy frontendowy fix musi być sprawdzony przy 1440×900, 768×1024 i 390×844.

## Stan wejściowy

- Raport UX/UI: `docs/AUDYT-UX-UI-2026-07-31.md`.
- Istniejący audyt bezpieczeństwa: `AUDYT.md`; jego ustalenia należy potwierdzić względem aktualnego kodu i konfiguracji, a nie traktować automatycznie jako bieżącego stanu produkcji.
- Frontend: `index.html`, `styles.css`, `app.js`, `theme-policy.js`.
- Backend: `server.js`, `supabase.js`, polityki w `client-policy.js`, `matching-policy.js`, `material-policy.js`.
- Testy: `test/*.test.js`, w tym `test/server.test.js`, `test/auth.test.js`, `test/design-layout.test.js`.
- Migracje: `supabase/migrations/*.sql`.

## Strumień A — bezpieczeństwo i gotowość produkcyjna

### Task 1: Zbudować aktualną macierz ryzyka i bramkę produkcyjną

**Files:**
- Modify: `AUDYT.md` — dopisać status weryfikacji tylko po wykonaniu kontroli.
- Modify: `README.md` — uzupełnić wymagania wdrożeniowe, jeśli różnią się od kodu.
- Modify: `.env.example` — utrzymać jawne nazwy konfiguracji transportu i Supabase bez wartości sekretów.
- Test: `test/server.test.js`, `test/auth.test.js`.

**Interfaces:**
- Consumes: aktualne endpointy API, konfigurację `.env`, migracje Supabase i istniejące ustalenia `AUDYT.md`.
- Produces: lista warunków PASS/FAIL dla środowiska lokalnego, stagingu i produkcji.

- [ ] Spisać dla każdego otwartego AUD-xx: lokalizację, wpływ, sposób weryfikacji i właściciela decyzji.
- [ ] Rozdzielić problemy naprawiane w kodzie od problemów wymagających ustawień Supabase, reverse proxy lub hostingu.
- [ ] Zdefiniować blokadę wdrożenia: brak `SUPABASE_URL`, publishable key, secret key, HTTPS lub `COOKIE_SECURE=true` poza lokalnym developmentem oznacza FAIL.
- [ ] Dodać test konfiguracji, który nie ujawnia wartości zmiennych, ale sprawdza obecność i poprawny tryb transportu.
- [ ] Uruchomić `npm run check` i zapisać wynik jako bazę przed zmianami.

### Task 2: Zweryfikować funkcje Supabase, RLS i granty

**Files:**
- Inspect/Modify: `supabase/migrations/*.sql` — tylko przez nową migrację utworzoną komendą Supabase, jeśli potrzebna jest zmiana.
- Test: nowy test kontraktowy w `test/supabase-security.test.js` albo rozszerzenie istniejących testów Supabase.
- Docs: `AUDYT.md` — status AUD-23, RLS i funkcji uprzywilejowanych.

**Interfaces:**
- Consumes: schemat `profiles`, `yarns`, `patterns`, istniejące policy i funkcje SQL.
- Produces: dowód, że funkcje uprzywilejowane nie są publicznym API, a tabele w schemacie `public` mają właściwe RLS/granty.

- [ ] Pobrać aktualny schemat i listę funkcji z projektu stagingowego; nie zakładać, że lokalne migracje opisują stan zdalny.
- [ ] Dla każdej funkcji `SECURITY DEFINER` sprawdzić schemat, `search_path`, kontrolę `auth.uid()`, grant `EXECUTE` oraz rolę wywołującą.
- [ ] Odebrać `EXECUTE` roli `PUBLIC` dla funkcji, które nie są przeznaczone jako publiczny endpoint; preferować `SECURITY INVOKER`, gdy nie jest potrzebne obejście RLS.
- [ ] Sprawdzić, czy `yarns` ma `SELECT`, `INSERT`, `UPDATE`, `DELETE` ograniczone do `(select auth.uid()) = user_id`; dla `UPDATE` sprawdzić jednocześnie `USING` i `WITH CHECK`.
- [ ] Uruchomić `supabase --version`, następnie właściwe `--help` i `supabase db advisors`; nie zgadywać składni CLI.
- [ ] Wygenerować migrację przez `supabase migration new <descriptive-name>` dopiero po zaakceptowaniu SQL i planu cofnięcia.
- [ ] Kryterium PASS: brak publicznie wywoływalnej uprzywilejowanej funkcji bez kontroli użytkownika, RLS na tabelach danych użytkownika, brak sekretu w kliencie.

### Task 3: Domknąć bezpieczeństwo Auth i sesji

**Files:**
- Modify: `server.js`, `supabase.js`, `.env.example`.
- Inspect/Configure: ustawienia Supabase Auth i reverse proxy/stagingu.
- Test: `test/auth.test.js`, `test/server.test.js`.

**Interfaces:**
- Consumes: endpointy rejestracji/logowania/resetu hasła/usunięcia konta oraz cookie builder.
- Produces: jawnie zabezpieczoną sesję i scenariusze Auth bez ujawniania istnienia konta.

- [ ] Potwierdzić `Secure; HttpOnly; SameSite=Lax` na access i refresh cookie w stagingu przez nagłówki odpowiedzi.
- [ ] Wymusić `COOKIE_SECURE=true` poza lokalnym developmentem i odrzucić start, jeśli produkcja ma tryb niebezpieczny.
- [ ] Sprawdzić, że wylogowanie i usunięcie konta unieważniają bieżącą sesję oraz czyszczą cookie; nie traktować samego usunięcia użytkownika jako natychmiastowego unieważnienia istniejących tokenów.
- [ ] Włączyć ochronę przed wyciekłymi hasłami w Supabase Auth i potwierdzić politykę haseł.
- [ ] Ustalić z właścicielem produktu, czy CAPTCHA jest wymagane przed publicznym ruchem; jeśli tak, wdrożyć je w Auth i przetestować rejestrację/logowanie z poprawnym oraz odrzuconym tokenem.
- [ ] Kryterium PASS: testy Auth przechodzą, odpowiedzi nie ujawniają, czy konto istnieje, a staging wymusza bezpieczny transport.

### Task 4: Wzmocnić ochronę żądań i odporność backendu

**Files:**
- Modify: `server.js` — timeouty, deadline body, rate limiting, kontrola Origin dla metod zmieniających stan.
- Modify: konfiguracja reverse proxy/hostingu — limit połączeń, timeout, rozproszony rate limit.
- Test: `test/server.test.js`.

**Interfaces:**
- Consumes: `readBody`, limiter żądań, endpointy `POST/PATCH/DELETE`.
- Produces: deterministyczne odrzucanie zbyt wolnych, zbyt dużych i zbyt częstych żądań bez zawieszania procesu.

- [ ] Dodać deadline odczytu body i timeout dla żądań Supabase; po przekroczeniu zwracać kontrolowany błąd bez sekretów.
- [ ] Sprawdzić, że limit rozmiaru body działa przed parsowaniem dużego JSON.
- [ ] Dla metod zmieniających stan przyjąć allowlistę `Origin` albo równoważną kontrolę CSRF zgodną z architekturą cookie.
- [ ] Utrzymać limiter aplikacyjny jako warstwę pomocniczą, ale dodać limit na reverse proxy, ponieważ pamięć procesu nie skaluje się między workerami.
- [ ] Dodać testy dla: powolnego body, przekroczenia limitu, braku/obcego Origin, serii błędnych logowań i równoległych procesów.
- [ ] Kryterium PASS: żądania kończą się w przewidywalnym czasie, a 429/400/403 nie zawierają danych wrażliwych.

### Task 5: Zapewnić integralność autosave, limitów i rankingu

**Files:**
- Modify: `app.js` — obsługa błędów autosave, retry i konfliktów.
- Modify: `server.js`, `matching-policy.js`, `limits.js`.
- Modify: `supabase/migrations/*.sql` — atomowe limity i wersjonowanie tylko po analizie migracji.
- Test: `test/server.test.js`, `test/matching-policy.test.js`, nowy `test/autosave.test.js`.

**Interfaces:**
- Consumes: zapis per rekord, `GET /api/matches`, limit 500/300 i ranking wariantów.
- Produces: jawny stan zapisu, brak cichego nadpisania oraz wynik oznaczony jako dokładny lub ograniczony podzbiorem.

- [ ] Dodać wersję magazynu albo `updated_at` do żądania zapisu; konflikt zwracać jako 409 z informacją wymagającą odświeżenia, nie jako cichy sukces.
- [ ] Przy błędzie autosave zachować dane lokalne w karcie, oznaczyć „Nie zapisano” i dać retry; nie udawać zapisu.
- [ ] Wymusić limit 500 włóczek i 300 wzorów również w warstwie bazy/atomowej operacji, a nie tylko w HTTP/importerze.
- [ ] W kontrakcie dopasowania zwracać `isPartial`/równoważne jawne oznaczenie, jeśli ranking użył ograniczonego podzbioru.
- [ ] Dodać testy dla dwóch kart zapisujących ten sam motek, przepełnienia limitu i fałszywego braku dopasowania.
- [ ] Kryterium PASS: żadna ścieżka błędu nie pozostawia UI w stanie sugerującym, że dane zostały zapisane.

## Strumień B — UX/UI, WCAG i responsywność

### Task 6: Naprawić układ magazynu na tablet/mobile

**Files:**
- Modify: `styles.css` — reguły `inventory-layout`, `inventory-stats`, lista magazynu i breakpointy.
- Test: `test/design-layout.test.js` — test struktury/layoutu; screenshoty z przeglądarki jako kontrola akceptacyjna.

**Interfaces:**
- Consumes: istniejący DOM `inventory-layout__content`, `inventoryStats` i sekcja `Twój zapas`.
- Produces: kolejność nagłówek → statystyki → lista przy 390/768 px oraz obecny układ kolumn przy desktopie.

- [ ] Dodać test, który przy breakpointach nie pozwala, aby `#inventoryStats` i sekcja listy miały ten sam `top` oraz ten sam obszar layoutu.
- [ ] Ustawić jawne `grid-template-areas` lub `grid-template-rows` na tablet/mobile; nie polegać na `display: contents` bez przypisania dzieci do obszarów.
- [ ] Zostawić statystyki jako cztery zwarte karty albo przeprojektować je na jeden poziomy summary strip, ale nie ukrywać danych bez alternatywy.
- [ ] Sprawdzić, że obraz hero nie wypycha pierwszej karty poza viewport i że lista pozostaje przewijalna.
- [ ] Zweryfikować 1440×900, 1024×900, 768×1024 i 390×844; zaakceptować dopiero, gdy statystyki i lista są widoczne w prawidłowej kolejności.

### Task 7: Naprawić kontrast, fokus i obszary dotykowe

**Files:**
- Modify: `styles.css`, `theme-policy.js`.
- Modify: `index.html` — jeśli potrzebne są dodatkowe etykiety lub stabilne atrybuty.
- Test: `test/design-layout.test.js`, nowy `test/accessibility-contract.test.js`.

**Interfaces:**
- Consumes: tokeny obu motywów i wspólny komponent `.button`, `.app-nav__button`, `.password-reveal`.
- Produces: kontrast WCAG AA dla normalnego tekstu i minimum 44×44 px dla interakcji dotykowych.

- [ ] Zmierzyć wszystkie pary kolorów jasnego motywu: tekst, muted, accent, danger, good, disabled, CTA, active nav, focus ring.
- [ ] Zmienić `--accent` albo `--on-accent` tak, aby tekst CTA osiągał co najmniej 4,5:1; dla obramowań i focus ringów osiągnąć minimum 3:1 względem sąsiedniego tła.
- [ ] Zachować obecny, dobrze kontrastowy motyw nocny i sprawdzić go po zmianie wspólnych komponentów.
- [ ] Ustawić `min-width: 44px; min-height: 44px` dla przycisku „Pokaż” i podobnych kontrolek.
- [ ] Sprawdzić Tab/Shift+Tab, focus visible i focus not obscured przez stałą nawigację mobile.
- [ ] Kryterium PASS: raport kontrastu bez niezgodności dla tekstów i screenshot/focus review na trzech głównych breakpointach.

### Task 8: Uporządkować formularze i komunikaty błędów

**Files:**
- Modify: `index.html`, `app.js`, `styles.css` — formularze Auth, motka i konta.
- Test: `test/auth.test.js`, nowy `test/form-accessibility.test.js`.

**Interfaces:**
- Consumes: istniejące `role=status`, `aria-describedby`, labels i walidację natywną.
- Produces: spójny wzorzec walidacji z błędem przy polu, stanem formularza i fokusem.

- [ ] Dla każdego pola ustawić stabilne `id`, powiązane `label for`, `name` oraz opis pomocniczy przez `aria-describedby`.
- [ ] Po błędzie ustawić `aria-invalid="true"`, wstawić konkretny komunikat pod polem i przenieść fokus na pierwsze błędne pole.
- [ ] Przy formularzu motka jasno pokazać, które pola są wymagane i dlaczego przycisk „Zapisz” jest nieaktywny.
- [ ] Zdecydować, czy karta dodawania motka jest sekcją inline, czy dialogiem; jeśli dialogiem, dodać `role="dialog"`, `aria-modal`, tytuł i zamykanie Escape bez utraty danych.
- [ ] Nie używać `role="alert"` do całego ekranu przy każdej zmianie; ogłaszać tylko nowe, istotne błędy.
- [ ] Kryterium PASS: brak błędu dostępności wynikającego z braku etykiety, brakujące pola są opisane, a błędy nie są tylko kolorem.

### Task 9: Ujednolicić feedback, treść i jakość katalogu

**Files:**
- Modify: `app.js`, `index.html` — stany loading/saved/error/offline/partial i teksty CTA.
- Modify: `scripts/import-patterns.js`, `data/*.json` — kontrola i naprawa mojibake.
- Test: `test/import-patterns.test.js`, `test/client-policy.test.js`.

**Interfaces:**
- Consumes: istniejące statusy, lazy loading katalogu, dane wzorów i kontrakt dopasowania.
- Produces: użytkownik zawsze wie, czy dane są zapisane, aktualne, częściowe czy wymagają ponowienia.

- [ ] Rozdzielić komunikaty: „Ładujemy…”, „Zapisano”, „Nie zapisano”, „Brak połączenia”, „Wynik częściowy”, „Spróbuj ponownie”.
- [ ] Zmienić komunikat dopasowania tak, aby jasno wskazywał, czy wynik jest aktualny po ostatniej zmianie magazynu.
- [ ] Dodać test importera wykrywający typowe mojibake i odrzucający rekord z błędnym kodowaniem przed publikacją.
- [ ] Naprawić istniejące tytuły i zachować polskie znaki w katalogu.
- [ ] Ujednolicić nazwy akcji: „Dobierz wzór” uruchamia obliczenie; „Zobacz w katalogu” otwiera opis wzoru; „Wróć do magazynu” wraca bez dodatkowej interpretacji.
- [ ] Kryterium PASS: każdy stan sieci i zapisu ma widoczny tekst, nie tylko spinner lub kolor.

### Task 10: Przeprojektować mobile filters i onboarding

**Files:**
- Modify: `index.html`, `app.js`, `styles.css` — panel filtrów i pusty magazyn.
- Test: `test/design-layout.test.js`, `test/client-policy.test.js`.

**Interfaces:**
- Consumes: istniejące selecty katalogu, dynamiczne liczniki i `onboarding`.
- Produces: krótszy skanowalny ekran mobile oraz jasny pierwszy przepływ nowego użytkownika.

- [ ] Na mobile zgrupować filtry pod przyciskiem „Filtry” z liczbą aktywnych kryteriów; pozostawić wyszukiwanie i licznik wyników widoczne.
- [ ] Dodać przycisk „Zastosuj filtry” tylko jeśli filtry będą tymczasowe; w przeciwnym razie zachować natychmiastowe filtrowanie i jasno to opisać.
- [ ] Zweryfikować pusty magazyn: jeden główny CTA „Dodaj pierwszy motek”, krótka instrukcja i następny krok „Dobierz wzór”.
- [ ] Nie ukrywać kluczowych informacji przez `display: none` bez odpowiednika dla tej samej szerokości ekranu.
- [ ] Kryterium PASS: nowy użytkownik wie, co zrobić w pierwszych 30 sekundach, a aktywne filtry są łatwe do usunięcia.

## Task 11: Weryfikacja końcowa i staging

**Files:**
- Modify: `README.md`, `AUDYT.md` — tylko po potwierdzeniu wyników.
- Test: wszystkie `test/*.test.js`, `npm audit --omit=dev --audit-level=moderate`, kontrole Supabase i browser QA.

**Interfaces:**
- Consumes: wszystkie zmiany z Task 1–10.
- Produces: podpisany raport gotowości staging/production oraz lista pozostałych ryzyk.

- [ ] Uruchomić `npm run check`.
- [ ] Uruchomić `npm audit --omit=dev --audit-level=moderate`.
- [ ] Uruchomić testy Supabase advisors i sprawdzić stan migracji przez oficjalne polecenia CLI/MCP.
- [ ] Uruchomić aplikację w trybie stagingowym z `COOKIE_SECURE=true`, HTTPS i prawdziwymi nagłówkami proxy.
- [ ] Przejść scenariusze: nowa rejestracja, błędne logowanie, reset hasła, dodanie/edycja/usunięcie motka, autosave failure, konflikt dwóch kart, dopasowanie częściowe, katalog z filtrem, usunięcie konta.
- [ ] Wykonać browser QA przy 1440×900, 1024×900, 768×1024 i 390×844 oraz keyboard QA z aktywnym focusem.
- [ ] Zaktualizować raport tylko o faktycznie potwierdzone wyniki i jawnie oznaczyć elementy nieweryfikowane.
- [ ] Produkcja może być oznaczona jako gotowa dopiero, gdy wszystkie P0 bezpieczeństwa i P0 UX mają PASS, a pozostałe ryzyka mają zaakceptowanego właściciela.

## Kolejność wdrożenia

1. **Najpierw bezpieczeństwo blokujące produkcję:** Task 1 → Task 2 → Task 3.
2. **Równolegle szybka naprawa UX:** Task 6 → Task 7.
3. **Następnie odporność danych i feedback:** Task 4 → Task 5 → Task 8 → Task 9.
4. **Dalsze usprawnienia doświadczenia:** Task 10.
5. **Bramka staging i decyzja produkcyjna:** Task 11.

## Punkty akceptacji właściciela produktu

- Akceptacja, czy CAPTCHA ma być wymagana przed publiczną rejestracją.
- Akceptacja docelowego zachowania wyniku częściowego rankingu: pokazywać z etykietą „częściowy” czy blokować wynik do pełnego obliczenia.
- Akceptacja, czy filtry mobile mają działać natychmiast, czy dopiero po „Zastosuj filtry”.
- Akceptacja zmiany czerwonego CTA w jasnym motywie; zmiana jest konieczna dla kontrastu, ale może lekko zmienić charakter wizualny.
- Osobna zgoda przed migracją produkcyjnej bazy, włączeniem ustawień Auth oraz wdrożeniem produkcyjnym.

## Checkpointy Git

- Po Task 3: `security: harden Supabase auth and session transport`.
- Po Task 6–7: `ui: fix responsive inventory and accessibility contrast`.
- Po Task 5, 8–9: `fix: make saves and matching feedback explicit`.
- Po Task 11: `chore: verify staging readiness`.

Nie tworzyć żadnego z tych commitów bez osobnej akceptacji właściciela projektu.
