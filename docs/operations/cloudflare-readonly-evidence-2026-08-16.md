# Cloudflare — dowody odczytu dla `rysia.org` — 2026-08-16

## Zakres

To jest wyłącznie zapis obserwacji z panelu Cloudflare dla strefy
`rysia.org`. Nie zmieniano DNS, TLS, HSTS, WAF, rate limiting, cache ani
żadnych reguł. Odczyt wykonano 16 sierpnia 2026 r. w zalogowanej sesji
operatora.

Ten dokument jest nowszym dowodem technicznym i zastępuje starsze obserwacje
Cloudflare, jeżeli opisują inny stan. Sam odczyt nie ustala, kto wykonał
wcześniejszą zmianę ani nie jest dowodem legalnej weryfikacji dostawcy.

## Potwierdzone ustawienia

- tryb szyfrowania między Cloudflare a originem: **Full (strict)**;
- **Always Use HTTPS**: włączone;
- minimalna wersja TLS: **TLS 1.2**;
- **TLS 1.3**: włączony;
- certyfikat Universal SSL dla `*.rysia.org` i `rysia.org`: aktywny,
  zarządzany przez Cloudflare, ważny do 2 listopada 2026 r.;
- HSTS: **nie jest włączony** — panel pokazuje akcję `Enable HSTS`.

## DNS i reguły ochrony — odczyt

- `rysia.org` → Railway: **Proxied**;
- `www.rysia.org` → Railway: **Proxied**;
- `staging.rysia.org` → Railway: **DNS only**;
- rekordy TXT `_railway-verify` dla domeny głównej, `staging` i `www` są
  obecne i mają status **DNS only**; ich wartości nie są powielane w tej
  dokumentacji;
- Cloudflare pokazuje **0/5 własnych reguł bezpieczeństwa**;
- Cloudflare pokazuje **0/1 reguł rate limiting**;
- reguły zarządzane nie są skonfigurowane w bieżącym planie — panel pokazuje
  opcję przejścia na plan Pro;
- w sekcji Cache Rules i Cache Response Rules nie odczytano aktywnych wpisów;
  tabela była w stanie ładowania, dlatego nie traktuję tego jako mocnego
  dowodu konfiguracji cache.

## Pozostaje do potwierdzenia

- pełna konfiguracja WAF/reguł zarządzanych i rate limiting poza widokiem
  własnych reguł;
- ustawienia ukrycia originu oraz dostarczania alertów/monitoringu;
- dowód operatora Cloudflare wymagany przez lokalny check legal readiness.

## Wniosek operacyjny

Warstwa TLS ma potwierdzony bezpieczny stan bazowy, ale ten odczyt nie zamyka
gotowości produkcyjnej. Nie włączam HSTS ani nie zmieniam innych ustawień bez
osobnej decyzji i okna produkcyjnego. Brak potwierdzenia legalnego operatora
pozostaje niezależną blokadą: `npm run legal:check` ma nadal działać
fail-closed, dopóki nie pojawi się rzeczywisty dowód weryfikacji.
