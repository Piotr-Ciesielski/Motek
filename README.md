# Motek

Prywatna aplikacja webowa do zarządzania włóczkami, katalogiem wzorów i ich dopasowaniem.

## Lokalny start

Wymagane: Node.js 24, npm i projekt Supabase.

```bash
npm install
copy .env.example .env   # PowerShell: Copy-Item .env.example .env
npm start
```

Aplikacja: `http://127.0.0.1:3001`.

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
```

## Najważniejsze polecenia

```bash
npm run check             # testy i kontrola kodu
npm run lint              # ESLint
npm run format:check      # Prettier
npm run railway:check     # sprawdzenie konfiguracji Railway
npm run regression:smoke  # szybki test wdrożenia
npm run regression:full   # pełna regresja stagingu
```

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
- [Historia zmian](CHANGELOG.txt)
