# Motek alpha.38, mobilny magazyn i staging — projekt

Data: 2026-08-02

## Cel

Domknąć wersję `2.0.0-alpha.38`, naprawić praktyczne problemy mobilnego
magazynu i komunikacji operacji oraz przygotować kompletną, niewdrożoną
konfigurację stagingową z reverse proxy, WAF, monitoringiem i opcjonalną
ochroną Supabase Auth przez Cloudflare Turnstile.

Prace będą wykonywane jako osobne, kolejno weryfikowane pakiety. Repozytorium
ma pozostać możliwe do uruchomienia lokalnie przez dotychczasowe `npm start`.

## Zakres

### Pakiet 1 — domknięcie `2.0.0-alpha.38`

- Ujednolicić numer wersji w `VERSION`, `package.json`, lockfile, adresach
  wersjonowanych zasobów interfejsu oraz dokumentacji.
- Zachować rejestrację przez jedno pole `Login (Twój e-mail)` i hasło.
- Potwierdzić, że aktywny kod aplikacji nie zbiera, nie odczytuje i nie zwraca
  `full_name` ani `fullName`.
- Zweryfikować lokalną migrację ustawiającą `profiles.login = profiles.email`,
  synchronizującą oba pola i usuwającą dane imienia i nazwiska.
- Nie wykonywać zdalnej migracji Supabase w ramach tego pakietu.
- Uporządkować dokumentację tak, aby odróżniała kod gotowy lokalnie od zmian,
  które nadal wymagają zastosowania lub potwierdzenia na stagingu.

### Pakiet 2 — mobilny magazyn

- Przy szerokości tabletu i telefonu stosować jeden jawny przepływ pionowy:
  nagłówek, podsumowanie magazynu, lista motków, grafika motywu.
- Statystyki i lista nie mogą zajmować tego samego obszaru układu ani wzajemnie
  się zasłaniać.
- Grafika pozostaje widoczna, lecz znajduje się po właściwej treści i nie
  wypycha pierwszego motka poza początkowy obszar ekranu.
- Desktop zachowuje zaakceptowany asymetryczny układ dwóch kolumn oraz obecne
  kadrowanie grafiki.
- Nie zmieniać w tym pakiecie palety kolorów, kontrastu ani zachowań dodawanych
  wyłącznie dla zgodności accessibility.

### Pakiet 3 — formularze i komunikaty

- Formularz nowego motka pozostaje sekcją rozwijaną w magazynie.
- Akcja zapisu pozostaje widoczna. Gdy zapis nie jest jeszcze możliwy,
  użytkownik otrzymuje krótką informację, których wymaganych danych brakuje.
- Operacje zapisu mają jawne stany: `Zapisywanie…`, `Motek zapisany` oraz
  `Nie zapisano — spróbuj ponownie`.
- Niepewny wynik zapisu nadal jest weryfikowany odczytem przed umożliwieniem
  ponownego żądania zmieniającego dane.
- Po potwierdzonej zmianie magazynu istniejące dopasowania pozostają widoczne,
  ale są oznaczone jako nieaktualne i oferują ponowne obliczenie.
- Komunikaty częściowego pobrania katalogu, braku sieci i konfliktu wersji
  magazynu pozostają rozróżnione od zwykłego błędu zapisu.

### Pakiet 4 — staging, WAF, monitoring i Auth

- Utworzyć osobny katalog `deploy/staging/` z konfiguracją kontenerów,
  reverse proxy i dokumentacją uruchomienia.
- Aplikacja Node działa za reverse proxy. Bezpośredni port aplikacji jest
  dostępny wyłącznie w wewnętrznej sieci kontenerów.
- Reverse proxy korzysta z OWASP Core Rule Set, ogranicza rozmiar żądań,
  liczbę połączeń i częstotliwość prób Auth oraz ma kontrolowane timeouty.
- Obrazy kontenerów są przypięte do konkretnych, zweryfikowanych wersji.
- Staging wymaga HTTPS, `COOKIE_SECURE=true`, poprawnego `APP_ORIGIN` oraz
  kompletu zmiennych Supabase. Brak wymaganej wartości zatrzymuje gotowość
  środowiska zamiast uruchamiać je w osłabionym trybie.
- Dodać osobny liveness check procesu oraz readiness check obejmujący
  połączenie aplikacji z Supabase. Odpowiedzi nie mogą ujawniać adresów,
  kluczy ani szczegółów bazy.
- Dodać metryki liczby żądań, błędów i czasu odpowiedzi. Metryki są dostępne
  wyłącznie w sieci wewnętrznej stagingu.
- Dodać konfigurację Prometheus i podstawowe alerty dla niedostępności,
  podwyższonego udziału błędów oraz opóźnień. Panel wizualny pozostaje
  opcjonalnym profilem, a jego brak nie blokuje aplikacji.
- Dodać opcjonalną integrację Cloudflare Turnstile z rejestracją i logowaniem.
  Lokalnie ochrona może być wyłączona. W trybie stagingowym wymagane klucze i
  włączenie ochrony są warunkiem gotowości.
- Token CAPTCHA jest krótkotrwałym polem żądania Auth. Backend przekazuje go
  do Supabase Auth i nigdy nie zapisuje ani nie loguje jego wartości.
- Repozytorium zawiera wyłącznie przykładowe nazwy zmiennych. Sekrety są
  dostarczane zewnętrznie i pozostają poza Git.
- Runbook stagingu obejmuje ręczne ustawienia Supabase: CAPTCHA, ochronę przed
  wyciekłymi hasłami, dozwolone adresy przekierowań oraz kontrolę RLS, grantów
  i Database Advisors.

## Architektura i granice odpowiedzialności

### Aplikacja Node

Backend pozostaje jedyną publiczną warstwą API Motka. Waliduje dane, zarządza
ciasteczkami sesji, przekazuje token użytkownika do klienta Supabase i chroni
prywatne operacje magazynu. Nowa warstwa metryk obserwuje wynik oraz czas
obsługi żądań, ale nie zapisuje body, ciasteczek, tokenów ani danych użytkownika.

### Reverse proxy i WAF

Proxy kończy połączenie HTTPS, stosuje limity infrastrukturalne oraz filtruje
typowe złośliwe żądania przed przekazaniem ich do Node. Limiter aplikacyjny
pozostaje drugą, pomocniczą warstwą. Reguły WAF mają jawne wyjątki tylko dla
potwierdzonych fałszywych alarmów i są opisane w runbooku.

### Monitoring

Prometheus odczytuje prywatny endpoint metryk i sprawdza liveness/readiness.
Alerty opisują stan techniczny, nie dane biznesowe użytkowników. Brak systemu
monitoringu nie może powodować awarii aplikacji, natomiast brak Supabase
powoduje negatywny readiness i blokuje kierowanie ruchu.

### Supabase Auth i Turnstile

Frontend pobiera wyłącznie publiczną informację, czy CAPTCHA jest wymagana,
oraz publiczny site key. Po wykonaniu wyzwania wysyła token razem z żądaniem
rejestracji lub logowania. Backend nie weryfikuje tokenu własnym sekretem;
przekazuje go do wspieranego mechanizmu Supabase Auth. Zdalne włączenie
provider'a CAPTCHA pozostaje osobnym krokiem operacyjnym.

## Przepływy i błędy

### Zapis motka

1. Formularz lokalnie wskazuje brakujące dane.
2. Po rozpoczęciu zapisu pokazuje stan `Zapisywanie…` i blokuje powielenie
   tej samej operacji.
3. Potwierdzona odpowiedź ustawia `Motek zapisany`, aktualizuje wersję
   magazynu i oznacza wcześniejsze dopasowanie jako nieaktualne.
4. Jednoznaczny błąd pozostawia dane w formularzu i udostępnia ponowienie.
5. Błąd o niepewnym wyniku najpierw uruchamia bezpieczny odczyt kontrolny.

### Dopasowanie po zmianie magazynu

Poprzednie wyniki nie są usuwane. Widoczna informacja wyjaśnia, że odnoszą się
do wcześniejszego stanu magazynu, oraz udostępnia jedną akcję ponownego
obliczenia. Udane obliczenie usuwa oznaczenie nieaktualności.

### Gotowość stagingu

- Awaria procesu Node: liveness `FAIL`, kontener może zostać uruchomiony
  ponownie.
- Brak połączenia z Supabase: liveness `PASS`, readiness `FAIL`, proxy nie
  powinno kierować ruchu użytkowników.
- Brak wymaganej konfiguracji transportu lub CAPTCHA: start stagingu kończy
  się kontrolowanym błędem bez podawania wartości ustawień.
- Awaria Prometheus lub panelu: aplikacja nadal obsługuje ruch, lecz powstaje
  luka obserwowalności opisana w instrukcji operacyjnej.

## Testowanie i weryfikacja

Zmiany funkcjonalne są realizowane test-first.

### `alpha.38`

- test kontraktu rejestracji `login = email`;
- test braku `fullName` w odpowiedzi;
- test kolejności i skutków migracji;
- kontrola braku aktywnych odwołań do `full_name`, starych pól formularza i
  wersji `alpha.37` w plikach publikowanych użytkownikowi;
- pełne `npm run check`.

### Mobilny magazyn i komunikaty

- test regresyjny układu przy 390, 768 i 1440 px;
- kontrola kolejności nagłówka, statystyk, listy i grafiki;
- test brakujących danych formularza;
- test stanów zapisu, retry i niepewnego zapisu;
- test oznaczenia wyników jako nieaktualne po potwierdzonej zmianie.

### Staging i Auth

- test walidacji konfiguracji stagingowej i fail-closed;
- test, że lokalny development może działać bez CAPTCHA;
- test, że staging wymaga CAPTCHA i bezpiecznych ciasteczek;
- test przekazania tokenu CAPTCHA bez zapisywania go w odpowiedzi i logach;
- walidacja plików Compose i konfiguracji proxy;
- smoke test liveness, readiness, metryk, rate limitu i wybranych reguł WAF;
- kontrola zależności i obrazów kontenerów względem aktualnej dokumentacji;
- końcowe `npm run check`, `git diff --check` i przegląd statusu Git.

Element, którego nie można uruchomić lokalnie, musi zostać opisany jako
`nieweryfikowany w tym środowisku` wraz z dokładnym krokiem kontrolnym dla
stagingu. Samo istnienie pliku konfiguracyjnego nie oznacza gotowości
produkcyjnej.

## Poza zakresem

- zmiany palety kolorów i kontrastu;
- prace wykonywane wyłącznie dla accessibility;
- wdrożenie publiczne lub uruchomienie płatnych usług;
- zdalne zastosowanie migracji Supabase;
- zmiana zdalnych ustawień Supabase Auth;
- dodawanie kolejnych wzorów i wariantów dopasowania;
- zwiększenie limitów 500 włóczek i 300 wzorów;
- wdrożenie produkcyjne, DNS, zakup domeny i certyfikatu.

## Kryteria zakończenia

- Wszystkie publikowane pliki wskazują `2.0.0-alpha.38`.
- Rejestracja używa wyłącznie e-maila jako loginu i nie korzysta z imienia ani
  nazwiska.
- Magazyn nie nakłada statystyk na listę przy 390 i 768 px, a desktop zachowuje
  dotychczasową kompozycję.
- Użytkownik widzi praktyczny stan zapisu i rozumie, kiedy wyniki dopasowania
  są nieaktualne.
- Repozytorium zawiera sprawdzalną konfigurację stagingu, proxy/WAF,
  monitoringu i opcjonalnego panelu.
- Lokalny development działa bez CAPTCHA, staging zatrzymuje gotowość bez
  wymaganej ochrony Auth.
- Testy projektu przechodzą, a nieweryfikowane elementy infrastruktury są
  jawnie wymienione.
- Nie wykonano żadnej zdalnej migracji, publikacji ani zmiany zewnętrznej
  konfiguracji.
