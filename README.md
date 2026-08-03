# Motek

Motek to prywatna aplikacja webowa dla osób robiących na drutach i szydełku. Pomaga odpowiedzieć na praktyczne pytanie: **który wzór mogę wykonać z włóczek, które już mam?**

Użytkownik zapisuje własny magazyn motków, przegląda katalog wzorów i otrzymuje tylko dopasowania oparte na potwierdzonych wymaganiach. Motek nie zgaduje zużycia włóczki, gdy dane wzoru są niepełne.

## Najważniejsze funkcje

- rejestracja i logowanie adresem e-mail, bez zbierania imienia i nazwiska;
- prywatny magazyn włóczek z nazwą, kolorem, materiałami, grubością, długością i wagą;
- edycja, automatyczny zapis i usuwanie motków;
- katalog wzorów z wyszukiwaniem oraz łączonymi filtrami statusu, języka, typu projektu i materiału;
- dokładne dopasowanie motków do ról i wariantów wzoru, z uwzględnieniem metrów lub gramów, materiału, grubości, kolorów i liczby nitek;
- dwa zapamiętywane lokalnie motywy interfejsu: jasny i ciemny;
- odzyskiwanie hasła i trwałe usunięcie konta wraz z prywatnymi danymi.

Jeden motek nie może zostać przypisany jednocześnie do dwóch różnych ról we wzorze. Rekordy bez kompletnych, zweryfikowanych wymagań pozostają widoczne w katalogu, ale nie są przedstawiane jako pewne dopasowania.

Obowiązujące limity produktu to 500 włóczek na użytkownika i 300 wzorów w katalogu.

## Szybki start

Wymagane są Node.js 24 (wersja używana w CI), npm oraz projekt Supabase z zastosowanymi migracjami z katalogu `supabase/migrations/`.

1. Zainstaluj zależności:

   ```bash
   npm install
   ```

2. Skopiuj `.env.example` do lokalnego pliku `.env` i uzupełnij dane projektu Supabase. Plik `.env` zawiera sekrety i nie może trafić do Git.

3. Uruchom aplikację:

   ```bash
   npm start
   ```

4. Otwórz **adres wypisany w logu serwera**. Przy wartościach z `.env.example` będzie to:

   ```text
   http://127.0.0.1:3001
   ```

Serwer wymaga połączenia z Supabase — aplikacja nie ma lokalnego zapasowego źródła danych.

## Konfiguracja środowiska

Przykładowy plik `.env`:

```dotenv
# Lokalny adres i port serwera
HOST=127.0.0.1
PORT=3001

# Środowisko: development lokalnie, production na wdrożeniu
NODE_ENV=development

# Dane projektu Supabase
SUPABASE_URL=https://twoj-projekt.supabase.co
SUPABASE_PUBLISHABLE_KEY=uzupelnij_klucz_publiczny
SUPABASE_SECRET_KEY=uzupelnij_klucz_backendu

# Lokalnie false; w produkcji true i wyłącznie HTTPS
COOKIE_SECURE=false

# Publiczny origin aplikacji; bez ścieżki i końcowego ukośnika
APP_ORIGIN=http://127.0.0.1:3001
```

Znaczenie ustawień:

- `HOST` i `PORT` określają interfejs sieciowy oraz port nasłuchu. Domyślne wartości serwera bez konfiguracji to odpowiednio `127.0.0.1` i `3001`;
- `NODE_ENV=production` wymaga jawnego `APP_ORIGIN`; HTTPS pozostaje obowiązkowym wymaganiem publicznego wdrożenia;
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` i `SUPABASE_SECRET_KEY` są wymagane przy starcie. Klucz sekretny służy wyłącznie backendowi;
- `COOKIE_SECURE=true` pozwala wysyłać ciasteczka sesji tylko przez HTTPS i powinno być ustawione w produkcji;
- `APP_ORIGIN` definiuje dozwolone źródło żądań zmieniających dane i chroni przed żądaniami z obcych stron. Lokalnie powinien odpowiadać adresowi wypisanemu przez serwer.

W Supabase Auth trzeba również dodać adres aplikacji z `/?recovery=1` do listy dozwolonych adresów przekierowania, aby działało odzyskiwanie hasła.

## Architektura w skrócie

- `index.html`, `styles.css` i `app.js` tworzą interfejs użytkownika;
- `server.js` serwuje frontend, waliduje żądania i udostępnia API HTTP bez dodatkowego frameworka;
- `material-policy.js`, `matching-policy.js`, `client-policy.js` i `theme-policy.js` zawierają współdzielone reguły produktu;
- Supabase przechowuje konta (`auth.users`), profile, prywatne włóczki i wspólny katalog wzorów;
- `supabase/migrations/` zawiera wersjonowany schemat i zabezpieczenia bazy;
- `scripts/` oraz `data/` służą do przygotowania i kontroli danych katalogu;
- `test/` zawiera automatyczne testy backendu, polityk, migracji, importu i danych katalogu.

Frontend komunikuje się wyłącznie z API Motka i nigdy nie otrzymuje sekretnego klucza Supabase. Backend przekazuje token zalogowanego użytkownika do Supabase, aby reguły Row Level Security mogły egzekwować własność danych.

## API

API jest podzielone na kilka grup:

- `/api/auth/*` — rejestracja, logowanie, sesja, wylogowanie i odzyskiwanie hasła;
- `/api/yarns` oraz `/api/yarns/:id` — odczyt i dodawanie motków, a także aktualizacja przez `PATCH` i usuwanie przez `DELETE`;
- `/api/patterns` — wspólny katalog wzorów;
- `/api/matches` — wykonalne dopasowania z prywatnego magazynu użytkownika;
- `/api/account` — trwałe usunięcie konta po ponownym potwierdzeniu hasłem;
- `/health` — kontrola stanu serwera.

Operacje na magazynie, dopasowaniach i koncie wymagają właściwej sesji. Szerszy opis API i modelu danych znajduje się w [SPEC.md](SPEC.md).

## Bezpieczeństwo i prywatność

- sekretny klucz Supabase pozostaje wyłącznie po stronie backendu;
- sesja jest przechowywana w ciasteczkach `HttpOnly`, a w produkcji także `Secure`;
- Row Level Security oraz `user_id` izolują magazyny użytkowników;
- właściciel rekordu wynika z uwierzytelnionej sesji, a nie z danych formularza;
- backend waliduje format i rozmiar danych oraz jawnie wybiera pola odpowiedzi;
- rejestracja i logowanie mają limity nieudanych prób;
- kontrola originu chroni operacje zmieniające dane przed żądaniami z obcych stron;
- błędy nie powinny ujawniać tokenów ani sekretów;
- źródłowe PDF-y w katalogu `Wzory` i lokalny `.env` nie są publicznie serwowane ani wersjonowane.

Przed publicznym ruchem należy użyć HTTPS, ustawić `NODE_ENV=production`, `COOKIE_SECURE=true` i poprawny `APP_ORIGIN`, włączyć ochronę CAPTCHA dla Auth oraz zapewnić HSTS, monitoring i limity ruchu na poziomie reverse proxy lub WAF.

## Testy i kontrola importu

Pełna podstawowa kontrola projektu sprawdza składnię backendu i frontendu oraz uruchamia testy automatyczne:

```bash
npm run check
```

Sam zestaw testów:

```bash
npm test
```

Kontrola przygotowanego katalogu wzorów bez zapisu do Supabase:

```bash
npm run patterns:check
```

Import wykonawczy zmienia dane w skonfigurowanym Supabase i powinien być uruchamiany dopiero po przejrzeniu wyniku kontroli oraz świadomym potwierdzeniu:

```bash
npm run patterns:import
```

Proces katalogu nie publikuje instrukcji z PDF-ów ani długich cytatów. Zachowuje tylko własny opis, źródło i parametry potrzebne do filtrowania lub dopasowania. Aktualny stan danych i zasady katalogu opisuje [docs/PATTERN-CATALOG.md](docs/PATTERN-CATALOG.md).

## Staging

Gotowy stos w `deploy/staging` uruchamia aplikację za reverse proxy i WAF z OWASP CRS. Logowanie i rejestracja mogą wymagać Cloudflare Turnstile, którego publiczną konfigurację frontend pobiera z `/api/config`.

Endpointy `/health/live` i `/health/ready` rozdzielają stan procesu od gotowości połączenia z Supabase. Metryki Prometheus pod `/internal/metrics` pozostają dostępne tylko w prywatnej sieci stagingu. Zasady bezpiecznej konfiguracji skupia `deployment-policy.js`, a metryki implementuje `observability.js`. Instrukcja wdrożenia i ręcznych ustawień operatora znajduje się w `deploy/staging/README.md`.

## Railway, Cloudflare i regresja po wdrożeniu

Repozytorium zawiera lokalną konfigurację Railway, obraz runtime, endpoint
`/health/release`, komendy `npm run railway:check`,
`npm run regression:smoke` i `npm run regression:full` oraz workflow po
wdrożeniu. Nie oznacza to, że usługi zewnętrzne są już skonfigurowane.
Kolejność stagingu, promocji, produkcji, diagnozy i rollbacku opisuje
[runbook wdrożenia i regresji](docs/operations/post-deploy-regression.md).

## Dokumentacja i wersja

- [SPEC.md](SPEC.md) — pełniejsza specyfikacja produktu, API i danych;
- [docs/PATTERN-CATALOG.md](docs/PATTERN-CATALOG.md) — stan, jakość i zasady katalogu wzorów;
- [docs/operations/post-deploy-regression.md](docs/operations/post-deploy-regression.md) — bezpieczne wdrożenie Railway/Cloudflare i regresja;
- [VERSION](VERSION) — bieżąca wersja projektu;
- [CHANGELOG.txt](CHANGELOG.txt) — historia zmian między wersjami.

README celowo nie powiela numeru bieżącej wersji ani historii wydań. Źródłami prawdy są pliki `VERSION` i `CHANGELOG.txt`.
