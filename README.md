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
