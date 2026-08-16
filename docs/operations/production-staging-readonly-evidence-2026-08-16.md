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

### Staging — odczyt początkowy

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

## Follow-up — staging legal anchors and CI — 2026-08-16

Po wykryciu, że wdrożony wcześniej staging działał na starym SHA
`3b07f6c71c32a068e12412ea30481f667bfd140c`, gałąź `staging` została
zaktualizowana do przygotowanego stanu `18c1f5c`.

Railway zakończył wdrożenie `1b0609b1-5b3e-48b3-88e8-2d6c39343c3c` statusem
`SUCCESS`. Publiczny `/health/release` zwraca `ready`, wersję
`2.0.0-alpha.39`, commit `18c1f5c530e0b26984ca2c04abecccceb36788e9` i
środowisko `staging`.

Publiczne `GET /informacje-prawne` zawiera statyczne odnośniki:
`#regulamin`, `#prywatnosc` i `#prawa-autorskie`. GitHub Actions potwierdził
zielone joby `test` i `database`, a post-deploy regression zakończyła się
sukcesem. Produkcja nie była zmieniana.

Ten follow-up nie zamyka HSTS ani legal-readiness. HSTS nadal nie jest
aktywne, a `npm run legal:check` pozostaje fail-closed z trzema
niezweryfikowanymi dostawcami.
