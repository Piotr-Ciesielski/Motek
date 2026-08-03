# Motek

Motek to prywatna aplikacja webowa dla osób robiących na drutach i szydełku. Zapisuje magazyn włóczek, przegląda katalog wzorów i pokazuje tylko dopasowania oparte na kompletnych, zweryfikowanych wymaganiach.

## Szybki start

Wymagane: Node.js 24, npm oraz projekt Supabase z migracjami z `supabase/migrations/`.

```bash
npm install
copy .env.example .env   # PowerShell: Copy-Item .env.example .env
npm start
```

Otwórz `http://127.0.0.1:3001`. Domyślny port aplikacji to **3001**.

Minimalna konfiguracja `.env`:

```dotenv
HOST=127.0.0.1
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://twoj-projekt.supabase.co
SUPABASE_PUBLISHABLE_KEY=uzupelnij_klucz_publiczny
SUPABASE_SECRET_KEY=uzupelnij_klucz_backendu
COOKIE_SECURE=false
APP_ORIGIN=http://127.0.0.1:3001
```

Klucz sekretny Supabase jest używany wyłącznie przez backend i nie może trafić do Git. W produkcji wymagane są HTTPS, `NODE_ENV=production`, `COOKIE_SECURE=true`, poprawny `APP_ORIGIN`, CAPTCHA oraz reverse proxy/WAF.

## Funkcje i API

- prywatny magazyn włóczek: `/api/yarns` i `/api/yarns/:id`;
- katalog wzorów: `/api/patterns`;
- dopasowania do magazynu: `/api/matches`;
- rejestracja, logowanie, sesja i odzyskiwanie hasła: `/api/auth/*`;
- usunięcie konta po ponownym potwierdzeniu: `/api/account`;
- zdrowie procesu i zależności: `/health`, `/health/live`, `/health/ready`.

Operacje prywatne wymagają sesji. RLS w Supabase izoluje dane użytkowników. Jeden motek nie może być użyty w dwóch rolach tego samego dopasowania; limity produktu to 500 włóczek na użytkownika i 300 wzorów w katalogu.

Mapa modułów, przepływy sesji i zapisów oraz granice odpowiedzialności są opisane w [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Kontrola jakości

```bash
npm run check          # składnia + pełne testy
npm run lint           # ESLint
npm run format:check   # Prettier
npm run coverage       # testy z raportem pokrycia
npm run patterns:check
```

Import katalogu do Supabase (`npm run patterns:import`) wykonuj dopiero po przejrzeniu wyniku kontroli. Testy pgTAP wymagają lokalnego Supabase CLI oraz Docker/Podman.

## Dokumentacja

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — moduły, przepływy i kontrakty;
- [SPEC.md](SPEC.md) — pełniejsza specyfikacja produktu i API;
- [docs/PATTERN-CATALOG.md](docs/PATTERN-CATALOG.md) — zasady katalogu wzorów;
- [docs/QUALITY.md](docs/QUALITY.md) — bramka jakości;
- [VERSION](VERSION) i [CHANGELOG.txt](CHANGELOG.txt) — wersja oraz historia zmian.
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
