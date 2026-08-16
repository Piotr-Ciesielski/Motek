# Odczyt produkcji i stagingu — 2026-08-16

## Zakres

To jest odczyt read-only wykonany 16 sierpnia 2026 r. Obejmuje bieżący
deployment Railway, konfigurację usługi bez wartości zmiennych oraz publiczne
statusy HTTP. Nie wykonywano migracji, deployu, zapisu danych ani zmian w
Railway, Supabase lub Cloudflare.

## Railway

Projekt: `balanced-fulfillment`, usługa: `Motek`.

### Production

- środowisko: `production`;
- branch: `main`;
- ostatni odczytany deployment: `b1d1fa03-b4e1-47f6-965e-e578a5c4658e`;
- status: `SUCCESS`;
- czas utworzenia: `2026-08-16T11:20:46.539Z`;
- commit: `0b3d43347d6b982eb86303db26650cc804ec8cd9`;
- wersja publiczna: `2.0.0-alpha.39`;
- domena: `www.rysia.org`, port `8080`;
- region: `sfo`, jedna replika;
- repozytorium: `Piotr-Ciesielski/Motek`;
- Dockerfile: `/deploy/railway/Dockerfile`;
- prywatny endpoint usługi: `motek`.

Odczyt konfiguracji usługi nie zwrócił jawnych pól `startCommand` ani
`healthcheckPath` dla produkcji, podczas gdy repozytorium i staging definiują
odpowiednio `node server.js` oraz `/health/ready`. Jest to otwarta różnica
konfiguracyjna do wyjaśnienia przed kolejnym oknem produkcyjnym; nie należy
zakładać, że konfiguracja produkcji jest identyczna ze stagingiem.

### Staging

- środowisko: `staging Motek`;
- branch: `staging`;
- ostatni odczytany deployment: `eacd99d8-c6b7-4a29-b9f5-3ce149829ab5`;
- status: `SUCCESS`;
- czas utworzenia: `2026-08-16T11:08:57.235Z`;
- domeny: `staging.rysia.org` oraz `motek-staging-motek.up.railway.app`;
- region: `sfo`, jedna replika;
- start command: `node server.js`;
- healthcheck: `/health/ready`, timeout `300 s`;
- Dockerfile: `deploy/railway/Dockerfile`.

## Publiczny smoke

| Endpoint | Production | Staging |
|---|---:|---:|
| `/health/release` | `200`, `ready`, SHA `0b3d433`, `production` | `200`, `ready`, SHA `3b07f6c`, `staging` |
| `/informacje-prawne` | `404` | `200` |
| anonimowy `/api/patterns` | `200` | `401` |

### Nagłówki wspólne

Odczytane odpowiedzi używały między innymi:

- `Cache-Control: no-store` dla `/health/release` i `/api/patterns`;
- `cf-cache-status: DYNAMIC` po stronie produkcyjnej Cloudflare;
- `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy` i `Permissions-Policy`.

To jest dowód dla tych konkretnych żądań. Nie zamyka pełnej kontroli cache dla
wszystkich endpointów ani nie dowodzi konfiguracji WAF, rate limiting, alertów
czy ukrycia każdego wariantu originu Railway.

## Wniosek

Produkcja ma obecnie identyfikowalny release, ale pozostaje `NO-GO`:

1. publiczna strona prawna nadal zwraca `404`;
2. anonimowy katalog wzorów nadal zwraca `200`;
3. produkcyjna konfiguracja Railway wymaga wyjaśnienia różnicy względem
   `railway.json` i stagingu;
4. nadal otwarte są legal-readiness, backup/restore, origin/WAF/cache oraz
   monitoring i alerty.

Nie traktować udanego deploymentu `0b3d433` jako zatwierdzenia promocji naszego
branchu recovery. Jest to osobny, odczytany stan gałęzi `main`.
