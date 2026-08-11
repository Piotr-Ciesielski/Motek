# Motek

Prywatna aplikacja webowa do zarządzania włóczkami, katalogiem wzorów i ich dopasowaniem.

Motek to prywatna aplikacja dla osób robiących na drutach i szydełku, która pomaga zamienić zapas włóczek w konkretne pomysły na projekty. Użytkownik może prowadzić własny magazyn motków, przeglądać i filtrować katalog wzorów oraz sprawdzać, które projekty da się wykonać z materiałów, które już ma — bez ręcznego porównywania wymagań wzoru z zawartością szafy. Dzięki temu łatwiej wykorzystać posiadaną włóczkę, szybciej znaleźć odpowiedni wzór i podejmować decyzje bez kupowania materiałów na zapas.

## Lokalny start

Wymagane: Node.js 24, npm i projekt Supabase.

```bash
npm install
copy .env.example .env   # PowerShell: Copy-Item .env.example .env
npm start
```

Aplikacja: `http://127.0.0.1:3001`.

Publiczne informacje prawne są dostępne bez logowania pod adresem
`http://127.0.0.1:3001/informacje-prawne`. Strona pokazuje bieżącą wersję
regulaminu, informację o prywatności oraz prawa autorskie i pozwala wrócić do
aplikacji.

Minimalne zmienne `.env`:

```dotenv
HOST=127.0.0.1
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://twoj-projekt.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
APP_ORIGIN=http://127.0.0.1:3001
COOKIE_SECURE=false
DEPLOYMENT_ENV=local
CAPTCHA_ENABLED=false
CAPTCHA_PROVIDER=turnstile
CAPTCHA_SITE_KEY=
METRICS_ENABLED=false
TRUST_PROXY=false
AUTH_IDLE_TIMEOUT_SECONDS=7200
```

## Najważniejsze polecenia

```bash
npm run check             # testy i kontrola kodu
npm run lint              # ESLint
npm run format:check      # Prettier
npm run railway:check     # sprawdzenie konfiguracji Railway
npm run regression:smoke  # szybki test wdrożenia
npm run regression:full   # pełna regresja stagingu
npm run invite -- create --email osoba@example.com --expires-at 2030-01-01T00:00:00Z
npm run invite -- revoke --id <id-zaproszenia>
npm run invite -- purge
```

### Zaproszenia operatora

Narzędzie operatora tworzy zaproszenie, odwołuje je albo uruchamia czyszczenie starych logów bezpieczeństwa. Przy tworzeniu zapisuje w bazie wyłącznie hash tokenu; pełny link jest wypisywany tylko raz i nie jest wysyłany automatycznie e-mailem. Do działania wymagane są `SUPABASE_URL`, `SUPABASE_SECRET_KEY` oraz `APP_ORIGIN` w lokalnym `.env`.

Nie uruchamiaj komendy `create` na środowisku zdalnym bez świadomej decyzji operatora. Surowego tokenu nie da się później odzyskać.

### Regulamin i dostęp do konta

Rejestracja działa wyłącznie z ważnym, jednorazowym zaproszeniem. Formularz
wymaga świadomego zaznaczenia akceptacji bieżącej wersji regulaminu; osobno
potwierdza przekazanie informacji o prywatności. Backend ponownie sprawdza
zaproszenie, wersje dokumentów i akceptację, więc samo zmodyfikowanie
formularza w przeglądarce nie wystarcza do utworzenia konta.

Jeżeli regulamin zostanie zaktualizowany, zalogowana sesja pozostaje dostępna
do wyświetlenia informacji prawnych, ponownej akceptacji, wylogowania i
usunięcia konta. Magazyn włóczek, dopasowania i katalog wzorów pozostają
zablokowane do czasu zaakceptowania bieżącej wersji.

## Środowiska i wdrożenia

| Środowisko | Domena | Branch | Test po wdrożeniu |
|---|---|---|---|
| Staging | [staging.rysia.org](https://staging.rysia.org) | `staging` | pełna regresja |
| Produkcja | [www.rysia.org](https://www.rysia.org) | `main` | smoke test |

`rysia.org` przekierowuje do `www.rysia.org`. Każde środowisko ma osobny projekt Supabase i osobne sekrety.

Railway buduje `Dockerfile`, uruchamia Node.js 24 i sprawdza gotowość przez `/health/ready`. Cloudflare obsługuje DNS, proxy, HTTPS/TLS i WAF. API nie powinno być cache'owane.

Przepływ: PR → CI → `staging` → regresja → `main` → produkcja. Wdrożenie z błędnym SHA, niesprawnym healthcheckiem lub nieudaną regresją jest blokowane.

## CI/CD i wersja

GitHub Actions uruchamiają testy, lint, formatowanie, audyt npm i testy Supabase. Po wdrożeniu workflow sprawdza właściwy commit oraz uruchamia regresję.

Numer wersji jest w pliku [`VERSION`](VERSION) (obecnie `2.0.0-alpha.38`) i musi odpowiadać wersji w `package.json`. CI kontroluje wersję i SHA; numer wydania aktualizuje się świadomie w repozytorium.

Zweryfikowany snapshot stagingu z 2026-08-07 to `2.0.0-alpha.39`, commit `62d0b84e`. Jest on opisany w [raporcie stanu stagingu](docs/operations/staging-status-2026-08-07.md) oraz w [statusie audytu bezpieczeństwa](docs/operations/security-audit-status-2026-08-07.md). Główny checkout może mieć inną wersję rozwojową, dopóki nie zostanie zsynchronizowany z branchem `staging`.

## Diagnostyka

- `/health/live` — proces działa;
- `/health/ready` — aplikacja i zależności są gotowe;
- `/health/release` — wersja, SHA i środowisko.

Przy błędzie logowania regresji sprawdź sekrety `MOTEK_QA_EMAIL` i `MOTEK_QA_PASSWORD` w GitHub Environment `staging`.

## Railway i środowiska

- staging działa z gałęzi `staging` pod `https://staging.rysia.org` i wdraża się automatycznie;
- produkcja działa z gałęzi `main` pod `https://www.rysia.org`, a auto-deploy jest wyłączony — publikację uruchamia operator ręcznie;
- Cloudflare obsługuje DNS, proxy/WAF i HTTPS, a każde środowisko korzysta z osobnego Supabase;
- po deployu stagingu uruchamia się `regression:full`, a po ręcznym deployu produkcji `regression:smoke`.

Sesja użytkownika wygasa po 2 godzinach bezczynności (`AUTH_IDLE_TIMEOUT_SECONDS=7200`).

## Dokumentacja

- [Architektura](docs/ARCHITECTURE.md)
- [Specyfikacja](SPEC.md)
- [Jakość i testy](docs/QUALITY.md)
- [Katalog wzorów](docs/PATTERN-CATALOG.md)
- [Runbook Railway/Cloudflare i regresji](docs/operations/post-deploy-regression.md)
- [Zweryfikowany stan stagingu z 2026-08-07](docs/operations/staging-status-2026-08-07.md)
- [Stan gotowości prawnej z 2026-08-11](docs/operations/legal-readiness-status-2026-08-11.md)
- [Historia zmian](CHANGELOG.txt)
# Stan utwardzenia bezpieczeństwa (2026-08-07)

Audyt restrykcyjny został wykonany z założeniem Supabase Free. Repozytorium zawiera migrację odtwarzającą ACL prywatnego licznika włóczek, wymusza podpisane cookie bezczynności, ogranicza publiczne endpointy i chroni zmianę hasła po przepływie recovery. Ochrona przed wyciekłymi hasłami pozostaje niedostępna na planie Free i nie jest zastępowana płatnym upgrade'em.

Grant recovery jest krótkotrwały, podpisany i jednorazowy: jego hash oraz
znacznik zużycia są przechowywane w prywatnej tabeli Supabase, a po zmianie
hasła backend unieważnia pozostałe sesje użytkownika. Migracja recovery nie
jest wykonywana automatycznie przy starcie aplikacji.

Przed wdrożeniem produkcyjnym należy wykonać migracje na kontrolowanym środowisku, uruchomić testy pgTAP oraz potwierdzić konfigurację proxy i limitów na Railway.
