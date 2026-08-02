# Audyt UX/UI Motka — 2026-07-31

## 1. Podsumowanie wykonawcze

**Ocena ogólna: 6/10.**

Motek ma wyrazisty, rozpoznawalny kierunek wizualny, dobrą podstawową architekturę nawigacji i sensowny model wartości: użytkownik przechodzi od własnego magazynu do konkretnego wzoru. Katalog ma użyteczne filtrowanie, a dopasowanie pokazuje nie tylko wynik, ale również role włóczek, rozmiar i zużycie.

Największy problem jest realnym błędem responsywności: przy szerokości 768 px i 390 px sekcja „Podsumowanie magazynu” nakłada się na „Twój zapas”. Lista włóczek przykrywa statystyki, więc użytkownik mobilny lub tabletowy traci dostęp do części informacji. To powinno być naprawione przed dalszym dopracowywaniem estetyki.

Drugie ważne ryzyko to kontrast jasnego motywu. Pomiar aktualnych tokenów wykazał, że czerwony akcent na jasnym tle ma około **3,63:1**, a biały tekst na czerwonym przycisku około **3,69:1**. Dla zwykłego tekstu nie spełnia to WCAG 2.2 AA 4,5:1. Motyw nocny wypada wyraźnie lepiej kontrastowo.

### Najważniejsze wnioski

1. Naprawić nakładanie statystyk i listy na tablet/mobile.
2. Zwiększyć kontrast czerwonych CTA, aktywnej nawigacji i czerwonych tekstów w jasnym motywie.
3. Uporządkować feedback operacji: loading, zapis, błąd sieci, retry i stan częściowy.
4. Poprawić semantykę formularzy: stabilne etykiety, komunikaty przy polach, `aria-invalid`, fokus po błędzie i większe kontrolki dotykowe.
5. Wyczyścić błędy jakości danych widoczne użytkownikowi, w szczególności tytuły z mojibake, np. „WÅÃ³czkomaniaczki”.

### Ograniczenia i założenia

- Audyt wykonano na lokalnym środowisku `http://localhost:3001/`, na koncie testowym już zalogowanym w przeglądarce.
- Nie wykonywałem nowych testów penetracyjnych, testów na produkcji, testów z realnymi użytkownikami ani analizy danych z analytics.
- Nie wylogowywałem konta, dlatego wizualny ekran logowania i rejestracji nie został przeprowadzony jako osobny, widoczny przepływ. Ich strukturę i teksty sprawdziłem statycznie w DOM i kodzie.
- Nie mogłem potwierdzić zachowania na iOS/Safari, z czytnikiem ekranu, przy powiększeniu 200% ani przy pełnym trybie klawiaturowym w sprzętowym środowisku.
- Część bezpieczeństwa wspólnego podsumowania opiera się na istniejącym `AUDYT.md`; nie jest to nowy test bezpieczeństwa.

## 2. Dowody z audytu

Zrzuty wykonano w bieżącej sesji audytowej i zapisano w katalogu [`docs/audyt-ux-ui-2026-07-31`](./audyt-ux-ui-2026-07-31/).

| Krok | Widok | Stan | Dowód |
|---:|---|---|---|
| 1 | Magazyn desktop | Dobry wizualnie, czytelny hero i hierarchia | [`02-magazyn-desktop-1440.png`](./audyt-ux-ui-2026-07-31/02-magazyn-desktop-1440.png) |
| 2 | Formularz dodawania motka | Czytelny, ale zapis i materiały wymagają dopracowania | [`03-formularz-motka-desktop.png`](./audyt-ux-ui-2026-07-31/03-formularz-motka-desktop.png) |
| 3 | Katalog | Dobry model filtrów, problem jakości tytułów | [`04-katalog-desktop.png`](./audyt-ux-ui-2026-07-31/04-katalog-desktop.png) |
| 4 | Katalog po wyszukaniu „Holly” | Dobre filtrowanie i licznik wyników | [`05-katalog-wyszukiwanie-holly.png`](./audyt-ux-ui-2026-07-31/05-katalog-wyszukiwanie-holly.png) |
| 5 | Dopasowanie | Mocna prezentacja wyniku i ról włóczek | [`06-dopasowanie-desktop.png`](./audyt-ux-ui-2026-07-31/06-dopasowanie-desktop.png) |
| 6 | Motyw nocny | Bardzo dobry kontrast i spójność wizualna | [`07-dopasowanie-dark.png`](./audyt-ux-ui-2026-07-31/07-dopasowanie-dark.png) |
| 7 | Dopasowanie mobile | Czytelne, ale dolna nawigacja zasłania fragment aktualnego widoku | [`08-dopasowanie-mobile-dark.png`](./audyt-ux-ui-2026-07-31/08-dopasowanie-mobile-dark.png) |
| 8 | Magazyn mobile | Błąd układu statystyk/listy potwierdzony | [`09-magazyn-mobile.png`](./audyt-ux-ui-2026-07-31/09-magazyn-mobile.png), [`10-magazyn-mobile-przewiniety.png`](./audyt-ux-ui-2026-07-31/10-magazyn-mobile-przewiniety.png) |
| 9 | Magazyn tablet | Ten sam błąd przy 768 px | [`11-magazyn-tablet.png`](./audyt-ux-ui-2026-07-31/11-magazyn-tablet.png) |
| 10 | Konto mobile | Dobra separacja strefy destrukcyjnej, formularz wymaga przewinięcia | [`12-konto-mobile.png`](./audyt-ux-ui-2026-07-31/12-konto-mobile.png) |

## 3. Tabela problemów

Waga: **Krytyczna** — blokuje lub może prowadzić do błędnej decyzji; **Wysoka** — silne tarcie albo ryzyko niespełnienia WCAG; **Średnia** — zauważalny problem, ale możliwe obejście; **Niska** — dopracowanie.

| Lp. | Obszar | Opis problemu | Waga | Rekomendacja | Lokalizacja/przykład |
|---:|---|---|---|---|---|
| U-01 | Responsywność | „Podsumowanie magazynu” i „Twój zapas” mają przy 768 px i 390 px ten sam obszar układu. Lista przykrywa statystyki. | Krytyczna | Na tablet/mobile ustawić jawne wiersze gridu: nagłówek → statystyki → lista. Dodać test screenshotowy dla 390, 768 i 1024 px. | `styles.css`, `.inventory-layout`; dowody 09–11 |
| U-02 | WCAG / kontrast | Czerwony akcent i biały tekst na czerwonym CTA są zbyt słabe dla zwykłego tekstu w jasnym motywie. | Wysoka | Przyciemnić czerwony token albo użyć ciemnego tekstu na koralowym tle; sprawdzić tekst, obramowanie i aktywną nawigację narzędziem kontrastu. | `--accent: #e94f4b`, przyciski CTA |
| U-03 | Feedback | Po zmianie magazynu ekran dopasowania nadal pokazuje wynik, ale komunikuje „uruchom dopasowanie ponownie”. Nie ma wystarczająco mocnego rozróżnienia: ładowanie, zapisano, aktualne, błąd, częściowe. | Wysoka | Wprowadzić stany `loading`, `saved`, `error`, `offline`, `partial`; przy autosave pokazywać stan obok konkretnego motka i umożliwić retry. | Dopasowanie, magazyn, `showMessage`, autosave |
| U-04 | Formularze / WCAG | Formularz motka jest zbudowany jako karta, nie dialog; zapis jest niewidoczny/wyłączony przy pustych polach, a błędy nie są obok pól w sposób jednoznaczny dla użytkownika. | Wysoka | Dodać czytelny komunikat pod każdym błędnym polem, `aria-invalid="true"`, `aria-describedby`, fokus na pierwsze błędne pole i jasny przycisk „Zapisz motek”. | Formularz dodawania motka, dowód 03 |
| U-05 | Jakość treści | W katalogu występują tytuły z błędnym kodowaniem znaków, np. `WÅÃ³czkomaniaczki`. | Średnia | Naprawić kodowanie źródłowych rekordów i dodać kontrolę jakości importu odrzucającą mojibake przed publikacją. | Katalog, dowód 04 |
| U-06 | Mobile / dotyk | Przycisk „Pokaż” przy haśle ma około 53 × 21 px, poniżej zalecanego obszaru dotykowego 44 × 44 px. | Średnia | Zwiększyć obszar przycisku do minimum 44 × 44 px, pozostawiając mały napis wewnątrz. | Konto, `#account-delete-password` |
| U-07 | Mobile navigation | Dolna nawigacja jest czytelna, ale przyklejona warstwa zakrywa fragment treści w bieżącym viewportcie. | Średnia | Zapewnić większy `padding-bottom` w przewijanym widoku i sprawdzić, czy focus/komunikaty nie wpadają pod pasek. | `.app-nav` przy 390 px, dowody 08–10 |
| U-08 | Architektura informacji | Nawigacja jest zrozumiała, ale główna wartość „co mogę zrobić z moich włóczek?” nie jest stale widoczna poza magazynem i dopasowaniem. | Średnia | Dodać krótki opis funkcji do pustego katalogu i jasne CTA z magazynu; utrzymać jedną główną akcję na ekran. | Katalog i Dopasowanie |
| U-09 | Katalog | Dobre filtry są w jednym poziomym rzędzie desktopu, ale na mniejszych szerokościach rosnąca liczba kontrolek może zwiększać koszt skanowania. | Średnia | Na mobile grupować filtry w „Filtry” z liczbą aktywnych kryteriów; ważne filtry pozostawić widoczne. | Katalog, dowody 04–05 |
| U-10 | Dostępność semantyczna | Nie każdy stan formularza i karta motka ma jednoznaczną relację komunikatu błędu z polem. Weryfikacja DOM wykazała dobre etykiety części pól, ale brak pełnego, widocznego dialogu i spójnych stanów błędów. | Średnia | Dodać `role="dialog"`, `aria-modal`, tytuł dialogu i zarządzanie fokusem, jeśli formularz ma pozostać overlayem; w przeciwnym razie oznaczyć go jako zwykłą sekcję. | Formularz motka, formularze Auth |
| U-11 | Onboarding | Obecny widok magazynu dobrze prowadzi użytkownika już zalogowanego, ale nie zweryfikowano wizualnie pierwszego uruchomienia bez danych. | Wysoka | Przetestować pusty magazyn jako osobny flow: „Dodaj motek” → „Dobierz wzór” → „Zobacz wynik”; nie pokazywać statystyk zero bez wyjaśnienia. | `onboarding`, stan nowego konta |
| U-12 | Perceived performance | Katalog ładuje pierwszą porcję i ma „Wczytaj więcej”, co jest dobre, ale brak widocznego pomiaru i potwierdzenia stanu ładowania w każdym widoku. | Średnia | Dodać skeleton dla pierwszego ładowania i tekst „Ładujemy wzory…”, a po błędzie „Spróbuj ponownie”; monitorować LCP/INP. | Katalog, dopasowanie, `aria-busy` |

## 4. Analiza 10 heurystyk Nielsena

| Heurystyka | Ocena | Obserwacja |
|---|---|---|
| 1. Widoczność stanu systemu | 6/10 | Licznik wyników katalogu i statusy dopasowania są dobre. Słabsze są stany zapisu/autosave oraz komunikat sugerujący ponowne uruchomienie dopasowania mimo widocznych wyników. |
| 2. Zgodność z rzeczywistością | 8/10 | Nazwy „Magazyn”, „Katalog”, „Dopasowanie” odpowiadają mentalnemu modelowi użytkownika. Dane wzoru są tłumaczone rolami i zużyciem. |
| 3. Kontrola i swoboda użytkownika | 7/10 | Użytkownik może wrócić do magazynu, edytować, usunąć, anulować dodawanie i zmienić motyw. Brakuje wygodnego undo po usunięciu oraz pewności, że zapis został zakończony. |
| 4. Spójność i standardy | 7/10 | Nazwy sekcji i styl kart są spójne. Mieszanie ikon Unicode z tekstem oraz różne formy CTA („Dobierz wzór”, „Zobacz w katalogu”) obniżają przewidywalność. |
| 5. Zapobieganie błędom | 6/10 | Są wymagane pola, limity liczbowe i fraza potwierdzająca usunięcie konta. Formularz motka powinien wcześniej i wyraźniej wyjaśniać, co blokuje zapis. |
| 6. Rozpoznawanie zamiast przypominania | 8/10 | Podsumowanie motka pokazuje kolor, materiał, grubość, metry i wagę bez otwierania karty. Filtry i liczniki również wspierają rozpoznawanie. |
| 7. Elastyczność i efektywność | 7/10 | Wyszukiwanie, filtry łączne i „Wczytaj więcej” są praktyczne. Na mobile filtry wymagają redukcji do bardziej zarządzalnego panelu. |
| 8. Estetyka i minimalizm | 7/10 | Silny charakter wizualny i dobra hierarchia hero. Duża liczba kart motków oraz długi ekran powodują koszt przewijania; statystyki na mobile są dodatkowo niewidoczne przez błąd układu. |
| 9. Pomoc w rozpoznaniu i naprawie błędów | 5/10 | Komunikaty są obecne, ale nie zawsze powiązane z konkretnym polem i nie ma spójnego retry/offline. Błędy kodowania tytułów podważają zaufanie do katalogu. |
| 10. Pomoc i dokumentacja | 6/10 | Krótkie opisy przy ekranach pomagają. Brakuje kontekstowej pomocy przy materiałach, grubości i znaczeniu „zweryfikowany” versus „do sprawdzenia”. |

## 5. Kluczowe ścieżki użytkownika

### A. Magazyn → dopasowanie → wybór wzoru

**Stan: dobry desktop, zablokowany jakościowo na mobile/tablet.**

1. Użytkownik trafia do „Magazynu włóczek”. Hero jasno pokazuje główną wartość i dwie akcje.
2. Podsumowanie szybko pokazuje liczbę motków, metry, wagę i kolory — ale tylko wtedy, gdy układ nie wchodzi w breakpoint 768/390.
3. Użytkownik przechodzi do „Dopasowania”. Wynik pokazuje ranking, rozmiar, role włóczek i źródłowe motki, co buduje zaufanie.
4. CTA „Zobacz w katalogu” tworzy dobry most do dalszego poznania wzoru.

**Punkty tarcia:** statystyki znikają na mobile/tablet; komunikat o ponownym uruchomieniu dopasowania jest niejednoznaczny; brak jasnego stanu „wynik jest aktualny / wymaga odświeżenia”.

### B. Katalog → wyszukiwanie → filtrowanie

**Stan: dobry i najbardziej dojrzały przepływ.**

1. Katalog zaczyna od „Zweryfikowane”, co ogranicza ryzyko korzystania z niepełnych danych.
2. Wyszukiwanie „Holly” natychmiast zawęziło wynik z 111 do 2 wzorów.
3. Liczniki filtrów aktualizują się względem pozostałych kryteriów, a niemożliwe opcje są wyłączane.
4. Przycisk „Wyczyść filtry” jasno pokazuje, czy filtr jest aktywny.

**Punkty tarcia:** błędne kodowanie tytułów; duża liczba filtrów w jednym rzędzie; brak jasnej informacji, czy wyszukiwanie obejmuje opis, materiał i nazwę — placeholder to sugeruje, ale warto powtórzyć to w pomocy.

### C. Dodanie motka

**Stan: funkcjonalnie obiecujący, UX formularza wymaga dopracowania.**

Formularz ma dobre pola i natywne typy danych: tekst, select, checkboxy materiałów, liczby z min/max. „Materiały” pozwalają zaznaczyć kilka wartości, co jest zgodne z modelem danych.

**Punkty tarcia:** formularz rozwija się w środku długiej listy, więc użytkownik może stracić kontekst; „Zapisz” jest niewidoczny lub wyłączony przy brakach bez dostatecznego wyjaśnienia; lista materiałów rozwijana przez `details` jest poprawna technicznie, ale wymaga lepszego opisania stanu i liczby wybranych opcji.

### D. Konto i usunięcie konta

**Stan: dobra ochrona przed przypadkowym usunięciem, ale mały przycisk hasła i długi formularz na mobile.**

Powtórne hasło oraz fraza „USUŃ KONTO” są adekwatnym zabezpieczeniem działania wysokiego ryzyka. Kolor i osobna strefa destrukcyjna komunikują konsekwencję.

**Punkty tarcia:** na mobile formularz wychodzi poza pierwszy viewport; mały przycisk „Pokaż” nie spełnia wygodnego obszaru dotykowego; brak wizualnie potwierdzonego stanu powodzenia/błędu w wykonanym flow, bo celowo nie wysyłałem formularza.

### E. Logowanie i rejestracja

**Stan: ograniczona weryfikacja wizualna.**

W DOM są zakładki „Logowanie” / „Załóż konto”, link odzyskiwania hasła, wymagania hasła i regiony statusu. Nie przeprowadzałem pełnego widocznego flow, ponieważ konto testowe było już zalogowane i wylogowanie zmieniłoby stan sesji.

Do potwierdzenia w kolejnym przebiegu: kolejność fokusu, komunikat o niepoprawnym e-mailu, komunikat o słabym haśle, stan błędu Supabase, sukces rejestracji i powrót do logowania.

## 6. Dostępność — niezgodności i ryzyka WCAG 2.2 AA

| Kryterium | Status | Dowód / ryzyko | Zalecenie |
|---|---|---|---|
| 1.3.1 Info and Relationships | Ryzyko | Część pól ma poprawne etykiety, ale formularz karty motka nie jest pełnym dialogiem ani formularzem z jednolitą strukturą komunikatów. | Ujednolicić strukturę sekcji/formularza, nazwać grupę materiałów i powiązać pomoc z polami. |
| 1.4.3 Contrast (Minimum) | Niezgodność w jasnym motywie | `#e94f4b` na `#fffdf8`: ok. 3,63:1; biały na `#e94f4b`: ok. 3,69:1. | Zmienić token lub kolor tekstu, zmierzyć wszystkie stany: default, hover, active, disabled. |
| 1.4.11 Non-text Contrast | Ryzyko | Obramowania i delikatne tła kart są lekkie; nie potwierdzono wszystkich stanów 3:1 względem sąsiednich kolorów. | Ustalić minimalny kontrast obramowań/focus ringów i testować komponentami. |
| 2.1.1 Keyboard | Do potwierdzenia | DOM ma elementy natywne, ale nie wykonano pełnego przejścia klawiaturą. | Przejść Tab/Shift+Tab/Enter/Escape przez nawigację, katalog, formularz i konto. |
| 2.4.7 Focus Visible | Częściowo spełnione / do potwierdzenia | W CSS istnieje `:focus-visible`, ale nie potwierdzono wizualnie każdego komponentu na wszystkich tłach. | Zapewnić ring minimum 2 px i widoczność także na kartach, selectach, checkboxach i dolnej nawigacji. |
| 2.4.11 Focus Not Obscured | Ryzyko | Stała dolna nawigacja może zasłonić fokus lub komunikat na mobile. | Dodać bezpieczny dolny padding i test z fokusem na ostatnim elemencie. |
| 2.5.8 Target Size | Niezgodność lokalna | „Pokaż” ma około 53 × 21 px. | Zwiększyć cały hit area do 44 × 44 px. |
| 3.3.1 Error Identification | Ryzyko | Niepotwierdzone, czy każdy błąd formularza jest opisany tekstem przy polu i ogłoszony czytnikowi. | Zastosować `aria-invalid`, `aria-describedby` i status błędu z `role="alert"` tylko dla nowych błędów. |
| 3.3.2 Labels or Instructions | Częściowo spełnione | Widoczne etykiety istnieją, ale pomoc przy materiałach i blokadzie zapisu jest zbyt mało konkretna. | Dodać „Możesz wybrać kilka”, „Zapis wymaga nazwy, koloru, długości i wagi” oraz stan wyboru. |
| 4.1.2 Name, Role, Value | Ryzyko | Formularz dodawania motka nie ma semantyki dialogu; role statusów są obecne, ale ich pełny cykl nie został sprawdzony. | Ustalić, czy to sekcja inline czy dialog, i dopasować role/focus management. |

Alt-teksty grafik są obecne i opisowe: „Kolorowe włóczki i kot w pracowni”. Nie potwierdzono jeszcze skalowania tekstu 200%, czytnika ekranu, kolejności fokusu ani redukcji animacji w pełnym flow. CSS zawiera obsługę `prefers-reduced-motion`, co jest dobrym fundamentem.

## 7. Spójność wizualna i UX writing

### Mocne strony

- Wyraźne rozróżnienie jasnego „Koloroterapia” i ciemnego „Nocny Motek”.
- Stała hierarchia: eyebrow → duży tytuł → opis → główna akcja.
- Karty magazynu, katalogu i dopasowania tworzą jeden język komponentów.
- Motyw nocny ma bardzo dobrą czytelność i bardziej premium charakter.
- Teksty „Wyniki dla Twoich włóczek”, „Najlepiej 100%” i role MC/CC pomagają zrozumieć decyzję systemu.

### Do poprawy

- Ujednolicić CTA: „Dobierz wzór” jako akcja uruchamiająca obliczenie, „Zobacz w katalogu” jako nawigacja; opisywać to konsekwentnie.
- Zastąpić same symbole Unicode w nawigacji ikonami z kontrolowanej biblioteki albo zapewnić, że symbole są `aria-hidden` i nie wpływają na nazwę.
- W komunikatach zapisu mówić wprost: „Motek zapisany”, „Nie zapisano — spróbuj ponownie”, „Wyniki są nieaktualne po zmianie magazynu”.
- Zamiast „Informacja „do sprawdzenia”...” dodać krótką pomoc przy samym badge’u, bo użytkownik może nie wiedzieć, co wolno traktować jako pewny wynik.

## 8. Quick wins vs redesign

### Quick wins — mały/średni nakład, duży wpływ

1. Naprawa gridu statystyk/listy na 390 i 768 px.
2. Korekta czerwonego tokenu i kontrastu CTA w jasnym motywie.
3. Zwiększenie hit area przycisku „Pokaż”.
4. Dodanie komunikatów błędu pod polami i fokusu na pierwsze błędne pole.
5. Poprawa kodowania tytułów katalogu i walidacja mojibake w imporcie.
6. Dodanie dolnego paddingu pod przyklejoną nawigację.
7. Ujednolicenie komunikatów `loading/saved/error/offline/retry`.

### Redesign / większy nakład

1. Przeprojektowanie mobilnego magazynu: statystyki jako poziomy summary strip albo accordion nad listą; nie jako równoległe elementy gridu o niejawnej pozycji.
2. Przeprojektowanie mobilnych filtrów katalogu w panel „Filtry” z liczbą aktywnych kryteriów.
3. Ustalenie wzorca formularzy inline versus modal/dialog i wdrożenie jednej reguły dla Auth, motków i konta.
4. Zaprojektowanie pełnego modelu feedbacku danych i autosave, w tym retry, offline i konfliktów między kartami.

## 9. Priorytety impact vs effort

| Priorytet | Rekomendacja | Impact | Effort | Typ |
|---|---|---:|---:|---|
| P0 | Naprawić overlap statystyk/listy na mobile/tablet | Bardzo wysoki | Mały | UX/UI |
| P0 | Naprawić kontrast CTA i aktywnych elementów jasnego motywu | Wysoki | Mały | WCAG |
| P1 | Wprowadzić jednoznaczny feedback zapisu i dopasowania | Wysoki | Średni | UX / dane |
| P1 | Uporządkować walidację i semantykę formularzy | Wysoki | Średni | WCAG / UX |
| P1 | Naprawić kodowanie tytułów katalogu | Średni | Mały | Treść / zaufanie |
| P1 | Dodać pełne testy keyboard + focus not obscured | Wysoki | Średni | WCAG |
| P2 | Przeprojektować mobile filtry | Średni | Średni | UX/UI |
| P2 | Zwiększyć obszary dotykowe wszystkich drugorzędnych akcji | Średni | Mały | Mobile/WCAG |
| P2 | Dodać undo po usunięciu motka | Średni | Średni | Heurystyka 3 |
| P3 | Zastąpić symbole Unicode kontrolowaną biblioteką ikon | Niski/średni | Mały | Spójność |

### Wspólna macierz z rekomendacjami bezpieczeństwa

Poniższa część bazuje na istniejącym `AUDYT.md`, nie na nowych testach penetracyjnych.

| ID | Rekomendacja bezpieczeństwa z `AUDYT.md` | Impact | Effort | Kolejność |
|---|---|---:|---:|---|
| S-01 | Zamknąć/ograniczyć publicznie wykonywalne funkcje `SECURITY DEFINER` w Supabase i wykonać retest | Bardzo wysoki | Średni | P0 przed produkcją |
| S-02 | Włączyć ochronę przed wyciekłymi hasłami i ustalić CAPTCHA/ochronę Auth | Wysoki | Średni | P0 przed publicznym ruchem |
| S-03 | Dodać deadline odczytu body, timeouty i rozproszony rate limiting na warstwie proxy | Wysoki | Średni/duży | P1 |
| S-04 | Pokazywać błąd autosave i rozwiązywać konflikt zmian z innej karty | Wysoki | Średni | P1 |
| S-05 | Jasno oznaczyć wynik rankingu jako dokładny albo podzbiór/przybliżony | Wysoki | Średni | P1 |
| S-06 | Wzmocnić walidację JSONB i atomowość importu katalogu | Średni/wysoki | Średni | P1/P2 |

## 10. Roadmapa wdrożenia

### Natychmiast / 1–3 dni

- Naprawić layout `inventoryStats` vs lista na 390/768 px.
- Zmienić jasny czerwony token i sprawdzić kontrast przycisków, linków, badge’y oraz active nav.
- Zwiększyć przycisk „Pokaż” do 44 × 44 px.
- Poprawić mojibake w katalogu i dodać walidację importu.
- Dodać test screenshotowy lub przynajmniej test DOM dla breakpointów.

### Do 1 miesiąca

- Wprowadzić pełne stany zapisu i dopasowania: loading, saved, error, offline, retry, partial.
- Przeprowadzić keyboard/focus audit z listą Tab/Shift+Tab oraz testem focus not obscured.
- Ujednolicić walidację formularzy i komunikaty błędów.
- Zweryfikować ekran pierwszego uruchomienia na pustym magazynie.
- Potwierdzić pozycje S-01/S-02 z `AUDYT.md` przed udostępnieniem publicznym.

### Kwartał

- Przeprojektować mobilne filtry katalogu.
- Dodać undo, konflikt autosave i wyraźne oznaczenie dokładności rankingu.
- Wykonać testy z 5–7 użytkownikami: pierwszy motek, filtr wzoru, interpretacja dopasowania i błąd zapisu.
- Włączyć monitoring LCP, INP, błędów API, odrzuceń formularzy i użycia filtrów.

### Długoterminowo

- Testy A/B dla CTA „Dobierz wzór” i układu statystyk.
- Test z czytnikiem ekranu, powiększeniem 200%, trybem wysokiego kontrastu i Safari/iOS.
- Rozważenie wyszukiwania/filtrowania po stronie API przy zwiększeniu katalogu ponad obecny limit.

## 11. Propozycja dalszego pomiaru

Przed i po wdrożeniu warto mierzyć:

- czas od wejścia do pierwszego zapisanego motka,
- odsetek użytkowników, którzy przechodzą z magazynu do dopasowania,
- odsetek dopasowań zakończonych kliknięciem „Zobacz w katalogu”,
- porzucenia formularza motka na konkretnym polu,
- liczbę błędów autosave i retry,
- użycie filtrów oraz czas do znalezienia pierwszego wzoru,
- udział sesji mobile/tablet, w których użytkownik dociera do statystyk magazynu.

## 12. Wspólne podsumowanie UX/UI + bezpieczeństwo

### Dla zarządu/decydentów

Motek ma dobrą, konkretną wartość produktową i mocny charakter marki. Najbliższy etap nie powinien polegać na dodawaniu kolejnych funkcji, tylko na domknięciu zaufania: użytkownik musi widzieć poprawne dane, rozumieć kiedy wynik jest aktualny, móc bezbłędnie wykonać zadanie na telefonie i otrzymać jasną informację, gdy zapis się nie uda.

Po stronie bezpieczeństwa istnieje już szereg dobrych zabezpieczeń i 92 testy przechodzą lokalnie, ale `AUDYT.md` wskazuje otwarte tematy przed produkcją. Szczególnie ważne jest potwierdzenie konfiguracji Supabase Auth, ochrony haseł, funkcji `SECURITY DEFINER`, limitów/rate limitingu oraz zachowania autosave. UX-owy błąd overlapu ma wysoki wpływ na użyteczność, a błędy bezpieczeństwa mają wysoki wpływ na ryzyko biznesowe — oba strumienie powinny być prowadzone równolegle.

### Wspólna kolejność decyzyjna

1. **Nie wypuszczać publicznie bez zamknięcia tematów bezpieczeństwa oznaczonych jako krytyczne/wysokie w `AUDYT.md`.**
2. **Przed kolejną rundą wizualną naprawić P0 UX:** overlap mobile/tablet i kontrast jasnego motywu.
3. **Przed skalowaniem katalogu i magazynu domknąć feedback, autosave i dokładność rankingu.**
4. **Po stabilizacji wykonać testy z użytkownikami i pomiar analityczny.**

## 13. Weryfikacja

- `npm run check`: **92 testy przechodzą, 0 błędów**.
- `node --check` dla plików aplikacji: bez błędów w ramach `npm run check`.
- Konsola przeglądarki po przejściu audytowanych widoków: **brak `warn` i `error`**.
- Widoki sprawdzone przy: **1440×900, 768×1024, 390×844**.
- Przetestowane interakcje: przejście Magazyn/Katalog/Dopasowanie/Konto, wyszukiwanie „Holly”, przełączanie motywów, otwarcie i anulowanie formularza motka, przewijanie mobile.
- Nie wykonano: realnej rejestracji, wylogowania, usunięcia konta, wysyłki resetu hasła, testu produkcji, testu czytnika ekranu i testów z użytkownikami.
