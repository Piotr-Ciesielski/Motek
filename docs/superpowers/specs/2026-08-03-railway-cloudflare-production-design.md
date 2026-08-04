# Wdrożenie Motka na Railway z Cloudflare — specyfikacja

**Cel:** Publicznie udostępnić Motka pod `https://www.rysia.org`, z trwałym
środowiskiem stagingowym, szyfrowanym ruchem, ochroną Cloudflare i pełną
izolacją danych stagingowych od produkcyjnych.

**Stan wdrożony:** Railway uruchamia aplikację w środowiskach `staging` i
`production`. Domena pozostaje zarejestrowana w Railway, ale jej nameservery są
delegowane do Cloudflare. Cloudflare zarządza publicznym DNS, przekierowaniami,
WAF i ochroną brzegu. Każde środowisko korzysta z osobnego projektu Supabase.

## 1. Zakres

Wdrożenie obejmuje:

- trwały staging pod `https://staging.rysia.org`;
- produkcję pod kanonicznym adresem `https://www.rysia.org`;
- przekierowanie `https://rysia.org` do `https://www.rysia.org` z zachowaniem
  ścieżki i parametrów zapytania;
- automatyczne wdrożenia stagingu z gałęzi `staging`;
- ręcznie uruchamiane wdrożenia produkcji z gałęzi `main` (auto-deploy produkcji jest wyłączony);
- certyfikaty TLS/HTTPS na publicznej krawędzi i połączeniu do Railway;
- dwa odrębne projekty Supabase;
- Cloudflare Turnstile dla operacji Auth;
- kontrolę gotowości aplikacji i podstawowy monitoring;
- kontrolę sekretów po upublicznieniu repozytorium;
- procedurę testu, publikacji i wycofania wadliwej wersji aplikacji.

Poza zakresem pierwszego wdrożenia pozostają: skalowanie wieloregionowe,
więcej niż jedna replika aplikacji, publiczne metryki Prometheus oraz
automatyczne wykonywanie migracji bazy przy każdym wdrożeniu.

## 2. Architektura i przepływ ruchu

Ruch użytkownika przechodzi następującą drogę:

```text
Przeglądarka
  -> HTTPS / Cloudflare DNS, proxy, WAF i reguły ograniczania ruchu
  -> HTTPS / domena usługi Railway
  -> aplikacja Node.js Motek na 0.0.0.0:$PORT
  -> HTTPS / odpowiedni projekt Supabase
```

Cloudflare jest publicznym punktem wejścia. Railway pozostaje hostingiem
aplikacji i nie jest bezpośrednio promowany użytkownikom przez domenę
`*.up.railway.app`. Railway zapewnia certyfikat również dla połączenia z
Cloudflare do usługi.

Aplikacja pozostaje pojedynczą usługą Node.js: ten sam proces serwuje frontend
i API. Nie jest potrzebna osobna usługa frontendowa.

## 3. Środowiska i gałęzie

### Staging

- nazwa środowiska Railway: `staging Motek` (gałąź wdrożeniowa: `staging`);
- domena: `staging.rysia.org`;
- źródło: stała gałąź `staging`;
- Supabase: osobny projekt stagingowy;
- dane: wyłącznie testowe;
- jedna replika aplikacji.

### Produkcja

- nazwa środowiska Railway: `production`;
- domena kanoniczna: `www.rysia.org`;
- źródło: wyłącznie stabilna gałąź `main`;
- auto-deploy: wyłączony; publikację uruchamia operator po zaakceptowaniu regresji stagingu;
- Supabase: osobny projekt produkcyjny;
- jedna replika aplikacji na start.

Aktualna gałąź robocza `docs/update-project-documentation` nie może być
źródłem automatycznych wdrożeń produkcyjnych.

## 4. Konfiguracja Railway

Repozytorium nie wymaga kompilacji frontendu. Railway uruchamia serwer przez
`npm start` albo przez przygotowany i przypięty Dockerfile. Docelowa
konfiguracja jako kod ma jednoznacznie określić sposób budowania, komendę
startową, kontrolę gotowości i zasady restartu.

Wymagania wspólne:

- aplikacja nasłuchuje na `HOST=0.0.0.0`;
- aplikacja korzysta z wartości `PORT` przekazanej przez Railway;
- healthcheck Railway wskazuje `/health/ready`;
- `/health/live` służy tylko do diagnostyki działania procesu;
- wdrożenie nie staje się aktywne, dopóki `/health/ready` nie zwróci HTTP 200;
- liczba replik wynosi 1, ponieważ obecne limitery żądań przechowują stan w
  pamięci procesu;
- `METRICS_ENABLED=false`, dopóki metryki nie zostaną odizolowane od sieci
  publicznej.

Minimalne zmienne produkcyjne:

```text
NODE_ENV=production
DEPLOYMENT_ENV=production
HOST=0.0.0.0
APP_ORIGIN=https://www.rysia.org
COOKIE_SECURE=true
TRUST_PROXY=true
SUPABASE_URL=<production>
SUPABASE_SECRET_KEY=<production-secret>
SUPABASE_PUBLISHABLE_KEY=<production-publishable>
CAPTCHA_ENABLED=true
CAPTCHA_PROVIDER=turnstile
CAPTCHA_SITE_KEY=<production-site-key>
METRICS_ENABLED=false
```

Minimalne zmienne stagingowe:

```text
NODE_ENV=production
DEPLOYMENT_ENV=staging
HOST=0.0.0.0
APP_ORIGIN=https://staging.rysia.org
COOKIE_SECURE=true
TRUST_PROXY=true
SUPABASE_URL=<staging>
SUPABASE_SECRET_KEY=<staging-secret>
SUPABASE_PUBLISHABLE_KEY=<staging-publishable>
CAPTCHA_ENABLED=true
CAPTCHA_PROVIDER=turnstile
CAPTCHA_SITE_KEY=<staging-site-key>
METRICS_ENABLED=false
```

Sekrety są wpisywane wyłącznie w Railway Variables dla właściwego środowiska.
Nie trafiają do Git, pliku Dockerfile, logów ani publicznego frontendu.

## 5. Konfiguracja domeny i Cloudflare

Domena `rysia.org` pozostaje zarejestrowana i odnawiana w Railway. W panelu
domeny Railway ustawiono niestandardowe nameservery Cloudflare:
`darwin.ns.cloudflare.com` oraz `ruth.ns.cloudflare.com`. Nie jest wymagany
transfer domeny do innego rejestratora; propagacja delegacji może trwać do
czasu odświeżenia rekordów u operatorów DNS.

W Cloudflare powstaną rekordy DNS wymagane przez Railway dla:

- `www.rysia.org` -> produkcyjna usługa Railway;
- `staging.rysia.org` -> stagingowa usługa Railway;
- rekordów weryfikacyjnych TXT wskazanych przez Railway (`_railway-verify`,
  `_railway-verify.www` i `_railway-verify.staging`).

Cloudflare ma obsługiwać proxy dla publicznych rekordów aplikacji. Konfiguracja
TLS ma używać trybu `Full`, zgodnie z bieżącymi wymaganiami Railway dla domen
proxowanych przez Cloudflare. Po zakończeniu propagacji należy sprawdzić stan
certyfikatu i tryb SSL w Cloudflare; do tego czasu nie należy deklarować pełnej
aktywacji domeny jako zakończonej.

Reguła przekierowania Cloudflare:

```text
https://rysia.org/* -> https://www.rysia.org/$1
```

Przekierowanie jest stałe i zachowuje parametry zapytania. Dzięki temu aplikacja
ma jeden kanoniczny origin zgodny z `APP_ORIGIN` i ochroną CSRF.

Staging nie powinien być indeksowany przez wyszukiwarki. Preferowana jest
dodatkowa kontrola dostępu Cloudflare przed publicznym udostępnieniem stagingu;
co najmniej należy zastosować `X-Robots-Tag: noindex, nofollow` lub równoważną
regułę.

Po udanym teście domen własnych należy usunąć niepotrzebne publiczne domeny
`*.up.railway.app`, aby nie pozostawiać oczywistej drogi omijającej Cloudflare.
Wdrożenie ma także sprawdzić zachowanie dla nieprawidłowego nagłówka `Host` i
ograniczyć aplikację do domen właściwych danemu środowisku oraz hosta używanego
przez Railway healthcheck. WAF zmniejsza ryzyko, ale nie może być opisany jako
ochrona absolutna bez testu możliwości bezpośredniego dotarcia do originu.

## 6. Cloudflare WAF, limity i Turnstile

Cloudflare ma zapewnić stale aktywną, konfigurowalną warstwę ochronną. Railway
udostępnia dodatkowo interwencyjny `Under Attack Mode` na czas aktywnego ataku,
ale nie zastępuje on reguł WAF i limitów dopasowanych do endpointów Motka.

Minimalna polityka:

- blokowanie oczywiście złośliwych żądań przez zarządzane reguły WAF dostępne
  w wybranym planie Cloudflare;
- ograniczenie częstotliwości żądań do endpointów Auth;
- ostrzejsze ograniczenie resetu hasła i rejestracji niż zwykłego ruchu API;
- ochrona przed botami bez blokowania typowych przeglądarek użytkowników;
- brak cache dla `/api/*`, odpowiedzi Auth i stron zawierających dane konta;
- możliwość cache wyłącznie dla jednoznacznie publicznych zasobów statycznych.

Po potwierdzeniu stabilnego HTTPS produkcja otrzyma HSTS z początkowym
`max-age=86400`, bez `includeSubDomains`. Po co najmniej siedmiu dniach poprawnej
pracy wartość może zostać zwiększona. Chroni to użytkowników bez długotrwałego
zablokowania jeszcze niesprawdzonych subdomen w razie błędu konfiguracji.

Turnstile jest konfigurowany oddzielnie dla stagingu i produkcji albo jednym
widgetem z jawnie dozwolonymi obiema domenami. Publiczny site key trafia do
Railway jako `CAPTCHA_SITE_KEY`. Sekretny klucz Turnstile trafia do ustawień
Supabase Auth i nie jest przekazywany aplikacji ani przeglądarce.

## 7. Supabase

Oba projekty Supabase otrzymują ten sam, sprawdzony zestaw migracji z
`supabase/migrations/`, ale nie współdzielą kont ani danych użytkowników.

Konfiguracja stagingowa Supabase Auth:

```text
Site URL: https://staging.rysia.org
Redirect URL: https://staging.rysia.org/?recovery=1
```

Konfiguracja produkcyjna Supabase Auth:

```text
Site URL: https://www.rysia.org
Redirect URL: https://www.rysia.org/?recovery=1
```

Adresy produkcyjne są dokładne; nie stosuje się szerokiego wildcardu. Szablon
wiadomości odzyskiwania hasła musi honorować przekazany `RedirectTo`.

Przed produkcją należy ponownie uruchomić doradców bezpieczeństwa Supabase,
potwierdzić RLS wszystkich tabel w eksponowanym schemacie oraz zweryfikować
uprawnienia funkcji `SECURITY DEFINER`. Ochrona przed wyciekłymi hasłami ma być
włączona, jeżeli obsługuje ją aktywny plan Supabase.

Migracje i import danych nie są automatycznym krokiem startu kontenera. Są
wykonywane osobno, kontrolowane i weryfikowane przed przełączeniem ruchu.

## 8. Wymagane zmiany w repozytorium

Przed produkcją repozytorium powinno otrzymać:

- konfigurację Railway jako kod, wspólną dla obu środowisk tam, gdzie wartości
  nie są sekretne;
- jednoznaczną konfigurację obrazu/runtime Node.js 24;
- walidację `DEPLOYMENT_ENV=production`, która wymusi bezpieczny origin,
  `COOKIE_SECURE=true`, `TRUST_PROXY=true`, CAPTCHA i wymagane klucze;
- testy walidacji środowiska produkcyjnego;
- dokument operacyjny opisujący staging, publikację, kontrolę i rollback;
- ochronę stagingu przed indeksowaniem;
- kontrolę dozwolonych hostów dla produkcji, stagingu i Railway healthcheck;
- sprawdzenie całej historii publicznego repozytorium pod kątem sekretów.

Istniejący katalog `deploy/staging` jest materiałem źródłowym, ale jego Docker
Compose, Nginx, ModSecurity i Prometheus nie stanowią bezpośrednio konfiguracji
Railway. Nie wolno zakładać, że wdrożą się automatycznie jako jeden serwis.

## 9. Bezpieczeństwo publicznego repozytorium

Przed podaniem publicznego adresu:

1. Sprawdzić aktualne pliki i pełną historię Git pod kątem kluczy, tokenów,
   haseł i connection stringów.
2. Potwierdzić, że `.env` nie jest śledzony.
3. Wymienić każdy sekret, który kiedykolwiek trafił do publicznej historii —
   samo usunięcie pliku nie unieważnia ujawnionej wartości.
4. Potwierdzić, że `SUPABASE_SECRET_KEY` jest dostępny wyłącznie dla procesu
   backendu.
5. Nie kopiować produkcyjnych sekretów do stagingu ani PR environments.

## 10. Automatyczna regresja po wdrożeniu

Każde udane wdrożenie Railway zgłasza do GitHub stan `deployment_status`.
Workflow uruchamia testy dopiero dla stanu `success`, dokładnie wskazanego
środowiska i właściwej gałęzi. Przed regresją test porównuje SHA wdrożonego
commita z niesekretnym identyfikatorem wersji zwracanym przez aplikację. Chroni
to przed omyłkowym przetestowaniem poprzedniej wersji podczas przełączania
instancji.

Repozytorium otrzyma dwa automatyczne profile testów:

### Profil `smoke` — staging i produkcja

Profil jest niedestrukcyjny i nie wymaga danych logowania. Sprawdza:

- HTTPS, `/health/live` i `/health/ready`;
- zgodność SHA działającej aplikacji z wdrażanym commitem;
- stronę główną, arkusz CSS, JavaScript i kluczowe zasoby graficzne;
- nagłówki CSP, `X-Content-Type-Options`, ochronę przed osadzaniem oraz brak
  niepożądanego CORS;
- brak cache dla odpowiedzi API zawierających stan użytkownika;
- `/api/config`: CAPTCHA jest włączona, provider to `turnstile`, a sekret nie
  jest ujawniany;
- publiczny katalog wzorów, paginację i niepusty kontrakt danych;
- odpowiedź 401 dla prywatnych endpointów bez sesji;
- odpowiedź 403 dla mutacji z obcego originu;
- brak publicznego `/internal/metrics`;
- na produkcji przekierowanie `rysia.org` do `www.rysia.org` z zachowaniem
  ścieżki i query string.

### Profil `full` — automatycznie na stagingu

Profil używa osobnego, wcześniej potwierdzonego konta QA i oficjalnych kluczy
testowych Turnstile przeznaczonych wyłącznie dla stagingu. Sprawdza dodatkowo:

- logowanie i utworzenie bezpiecznych ciasteczek sesji;
- odczyt bieżącej sesji i profilu;
- odczyt magazynu wraz z ETag;
- dodanie włóczki oznaczonej unikalnym identyfikatorem przebiegu;
- odczyt utworzonego rekordu;
- aktualizację rekordu i zmianę ETag;
- odrzucenie zapisu ze starym ETag jako konfliktu;
- pobranie dopasowań do wzorów;
- usunięcie wyłącznie rekordu utworzonego przez bieżący test;
- wylogowanie i potwierdzenie braku aktywnej sesji;
- sprzątanie utworzonego rekordu w bloku `finally`, także po wcześniejszym
  niepowodzeniu testu.

Każdy rekord testowy używa prefiksu `regression-` i identyfikatora przebiegu.
Test zapamiętuje dokładne ID utworzonego rekordu. Nie wolno usuwać danych
szerokim filtrem nazwy, czyścić całego magazynu ani używać konta operatora.

Pełny cykl rejestracji, potwierdzenia e-maila, resetu hasła i usunięcia konta
pozostaje automatyczny na niższych poziomach z atrapą Supabase oraz jest
wykonywany ręcznie na stagingu przed pierwszą publikacją. Produkcyjny Turnstile
nie może być obchodzony przez automat. Po wdrożeniu produkcyjnym automatycznie
uruchamia się profil `smoke`, a zalogowany smoke test wykonuje operator na
dedykowanym koncie QA. Nie dodajemy publicznego testowego endpointu logowania i
nie przekazujemy administracyjnego klucza produkcyjnego Supabase do GitHub
Actions.

Testy są implementowane w Node.js i uruchamiane komendami:

```text
npm run regression:smoke
npm run regression:full
```

Wymagane zmienne workflow są rozdzielone przez GitHub Environments:

```text
MOTEK_BASE_URL
MOTEK_QA_EMAIL       # tylko staging full
MOTEK_QA_PASSWORD    # tylko staging full, sekret
```

Oczekiwany SHA pochodzi bezpośrednio z zaufanego zdarzenia wdrożeniowego
GitHub. Staging używa oficjalnego tokenu `XXXX.DUMMY.TOKEN.XXXX` i pary kluczy
testowych Cloudflare; wartości te nie są sekretami. Produkcyjny projekt
Supabase i produkcyjny Turnstile nigdy nie używają kluczy testowych.

Workflow nie wypisuje wartości sekretów ani ciasteczek. Ma ograniczenie czasu,
`permissions: contents: read`, warunek zgodności repozytorium, środowiska i
gałęzi oraz concurrency osobne dla stagingu i produkcji. Nie uruchamia regresji
z wdrożeń forków i PR-ów niezaufanych autorów.

Nieudana regresja blokuje uznanie wdrożenia za zaakceptowane i pozostawia
czytelny raport w GitHub Actions. Rollback nie jest wykonywany automatycznie:
operator najpierw potwierdza przyczynę, a następnie wybiera poprzednie wdrożenie
Railway. Zapobiega to wycofaniu poprawnej wersji przez chwilową awarię sieci lub
zewnętrznej usługi.

## 11. Testy akceptacyjne

Staging musi przejść przed produkcją:

- `npm run check` i testy konfiguracji stagingowej/produkcyjnej;
- udane uruchomienie oraz HTTP 200 z `/health/ready`;
- poprawne HTTPS bez ostrzeżeń certyfikatu;
- przekierowanie HTTP do HTTPS;
- poprawne przekierowanie `rysia.org` do `www.rysia.org`;
- rejestrację, potwierdzenie e-maila, logowanie, odświeżenie sesji i wylogowanie;
- reset hasła wracający do właściwej domeny;
- poprawne i odrzucone wyzwanie Turnstile;
- dodanie, edycję i usunięcie włóczki;
- dopasowanie wzorów;
- usunięcie konta;
- odrzucenie żądania mutującego z obcego originu;
- potwierdzenie, że staging i produkcja nie współdzielą danych;
- kontrolę nagłówków bezpieczeństwa i braku cache prywatnych odpowiedzi;
- kontrolę logów bez pełnych tokenów, kluczy i danych uwierzytelniających;
- próbę przekroczenia limitów Auth i potwierdzenie reakcji Cloudflare;
- podstawowy test widoku na telefonie i komputerze.

Po przejściu stagingu produkcja jest wdrażana z `main`, ale domena publiczna jest
podłączana dopiero po potwierdzeniu `/health/ready` i podstawowym smoke teście na
tymczasowej domenie Railway.

## 12. Monitoring i rollback

Railway healthcheck chroni moment przełączenia wdrożenia, ale nie jest ciągłym
monitoringiem. Produkcja wymaga zewnętrznego monitoringu dostępności
`https://www.rysia.org/health/ready` oraz alertu o błędzie.

Rollback aplikacji wykorzystuje poprzednie działające wdrożenie Railway.
Rollback kontenera nie cofa migracji Supabase. Każda migracja produkcyjna musi
mieć osobno ocenioną zgodność wsteczną i procedurę naprawczą.

W razie awarii konfiguracji Cloudflare można czasowo wyłączyć proxy dla rekordu
po wcześniejszym sprawdzeniu, że bezpośrednia domena Railway i certyfikat są
gotowe. Taka zmiana jest operacją awaryjną, a nie normalnym trybem działania.

## 13. Kryteria gotowości produkcyjnej

Motek jest gotowy do publicznego uruchomienia, gdy jednocześnie:

- staging przeszedł wszystkie testy akceptacyjne;
- oba Supabase mają aktualne migracje i pozytywną kontrolę bezpieczeństwa;
- repozytorium i historia Git zostały sprawdzone pod kątem sekretów;
- Cloudflare proxy, WAF, limity i Turnstile działają na stagingu;
- produkcyjne zmienne są kompletne i odizolowane od stagingu;
- `/health/ready` produkcji zwraca HTTP 200;
- automatyczny profil `full` stagingu oraz profil `smoke` produkcji są zielone;
- `www.rysia.org` działa po HTTPS;
- `rysia.org` przekierowuje do domeny kanonicznej;
- istnieje działający monitoring i sprawdzona procedura rollbacku;
- dopiero wtedy publiczny ruch zostaje skierowany na produkcję.
