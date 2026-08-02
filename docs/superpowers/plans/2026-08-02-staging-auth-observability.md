# Staging, ochrona Auth i monitoring — plan wdrożenia

> **Dla Codex:** wykonuj zadania kolejno z `superpowers:executing-plans` i test-first. Bez osobnej zgody nie wdrażaj na serwer ani nie zmieniaj zdalnej konfiguracji Supabase/Cloudflare.

**Cel:** przygotować powtarzalny staging z reverse proxy/WAF, ochroną Auth przez Cloudflare Turnstile oraz monitoringiem i alertami.

**Architektura:** aplikacja Node i Prometheus działają wyłącznie w wewnętrznej sieci kontenerów. Jedynym publicznym wejściem jest Nginx z ModSecurity i OWASP CRS. CAPTCHA jest obowiązkowa na stagingu, ale wyłączona lokalnie. Sekrety nie trafiają do repozytorium.

---

## 1. Polityka konfiguracji stagingu

**Pliki:** utwórz `deployment-policy.js`, `test/deployment-policy.test.js`; zmień `.env.example`.

1. Napisz testy wymagające, aby:
   - lokalne środowisko mogło działać bez CAPTCHA;
   - `DEPLOYMENT_ENV=staging` wymagało `NODE_ENV=production`, HTTPS w `APP_ORIGIN`, `COOKIE_SECURE=true`, `HOST=0.0.0.0`, włączonego Turnstile i publicznego site key;
   - błędy podawały tylko nazwy ustawień, nigdy sekrety;
   - publiczna konfiguracja zawierała wyłącznie `enabled`, `provider`, `siteKey`.
2. Uruchom `node --test test/deployment-policy.test.js` i potwierdź RED.
3. Zaimplementuj czyste `readCaptchaConfig(env)` i `validateDeploymentConfig(env)`.
4. Dodaj do przykładowego env: `DEPLOYMENT_ENV=local`, `CAPTCHA_ENABLED=false`, `CAPTCHA_PROVIDER=turnstile`, puste `CAPTCHA_SITE_KEY`, `METRICS_ENABLED=false`. Nie dodawaj secret key Turnstile.
5. Uruchom test ponownie i potwierdź GREEN.

## 2. CAPTCHA w backendzie

**Pliki:** zmień `server.js`, `test/server.test.js`.

1. Rozszerz atrapę Supabase i napisz testy: `GET /api/config` nie ujawnia sekretów; brak tokenu daje 400 przy włączonej CAPTCHA; lokalny tryb działa bez tokenu; poprawny token trafia do `options.captchaToken`; ponad 2048 znaków jest odrzucane; token nie trafia do odpowiedzi/logów.
2. Uruchom test serwera i potwierdź RED.
3. Podłącz politykę przy starcie, z możliwością wstrzyknięcia konfiguracji w testach.
4. Dodaj publiczny `GET /api/config` zwracający tylko konfigurację CAPTCHA.
5. Dla rejestracji przekaż `options: { data: { login }, captchaToken }`; dla logowania `options: { captchaToken }`. Przy wyłączonej CAPTCHA pomiń pustą wartość.
6. Uruchom test i potwierdź GREEN.

## 3. Turnstile w formularzach

**Pliki:** zmień `index.html`, `app.js`, `client-policy.js`, `test/client-policy.test.js`, `test/design-layout.test.js`.

1. Test-first dodaj czystą funkcję budującą payload Auth oraz test struktury HTML z osobnymi kontenerami dla logowania i rejestracji. Potwierdź RED.
2. Dodaj kontenery bez zmian kolorystycznych ani prac accessibility.
3. Po pobraniu `/api/config` ładuj `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` tylko przy włączonej CAPTCHA.
4. Renderuj osobne widgety, trzymaj token wyłącznie w pamięci, dołączaj go do żądania, resetuj po każdej próbie i pokaż prosty błąd, jeśli zabezpieczenie się nie załaduje.
5. Dodaj domenę Turnstile wyłącznie do CSP `script-src` i `frame-src`.
6. Uruchom testy klienta, layoutu i serwera; potwierdź GREEN.

## 4. Liveness, readiness i Prometheus

**Pliki:** utwórz `observability.js`, `test/observability.test.js`; zmień `server.js`, `test/server.test.js`.

1. Test-first sprawdź licznik żądań, histogram czasu, normalizację identyfikatorów do np. `/api/yarns/:id`, format Prometheus i brak danych użytkowników/sekretów.
2. Dodaj testy: `/health/live` i alias `/health` zwracają 200 bez zależności; `/health/ready` zwraca 200/503 zależnie od Supabase; `/internal/metrics` istnieje tylko po włączeniu.
3. Potwierdź RED.
4. Zaimplementuj `normalizeRouteLabel()` i mały rejestr z `observe()` oraz `renderPrometheus()`, bez nowej zależności.
5. Rejestruj wynik na zdarzeniu `finish`; nie używaj e-maili, ID użytkowników ani treści żądań jako etykiet.
6. Dodaj endpointy zdrowia i ogólną odpowiedź 503; techniczny błąd może trafić tylko do logu.
7. Uruchom testy i potwierdź GREEN.

## 5. Kontenery, reverse proxy/WAF i alerty

**Pliki:** utwórz `.dockerignore`, `deploy/staging/Dockerfile`, `compose.yaml`, `compose.dashboard.yaml`, szablon Nginx, pusty opisany plik wykluczeń CRS, konfigurację Prometheus, alerty oraz `test/staging-config.test.js`; zmień `.gitignore`.

1. Zweryfikuj w oficjalnych rejestrach dokładne dostępne wersje Node 24 LTS, OWASP CRS/Nginx, Prometheus i Grafana. Użyj nieruchomych tagów, najlepiej digestów; nigdy `latest` ani `rolling`.
2. Napisz test kontraktu konfiguracji: brak pływających tagów; aplikacja i metryki bez portów hosta; publiczny port tylko WAF; produkcyjny tryb, secure cookies i CAPTCHA; zgodne limity body; wewnętrzny scrape; brak certyfikatów/sekretów. Potwierdź RED.
3. Dockerfile: `npm ci --omit=dev`, użytkownik non-root, tylko pliki runtime, healthcheck `/health/live`.
4. Compose: wewnętrzne `app` i `prometheus`; publiczny tylko `waf`; TLS montowany read-only; limity zasobów i restart policy; sekrety z pliku poza repo.
5. Nginx/WAF: właściwe nagłówki HTTPS, timeouts/body limit zgodne z Node, publiczna blokada `/internal/metrics`, liveness/readiness, CRS w trybie blokującym. Wykluczenia tylko wąskie i udokumentowane.
6. Alerty: brak aplikacji, brak gotowości, wysoki udział 5xx, podwyższony czas odpowiedzi. Grafana tylko opcjonalnym rozszerzeniem, bez publicznego portu.
7. Uruchom `node --test test/staging-config.test.js` i `docker compose -f deploy/staging/compose.yaml config`. Jeśli Docker jest dostępny, wykonaj build/smoke test; pobieranie obrazów wymagające nowej zgody poprzedź prośbą.

## 6. Runbook, dokumentacja i końcowa kontrola

**Pliki:** utwórz `deploy/staging/README.md`, `deploy/staging/.env.staging.example`; zmień `README.md`, `SPEC.md`, `CHANGELOG.txt`, `package.json`.

1. Opisz DNS/TLS, przygotowanie env poza repo, walidację, start, liveness/readiness, alerty i rollback do poprzedniego obrazu.
2. Oznacz jako ręczne i niewykonane: widget Turnstile, site key stagingu, secret key w Supabase Bot and Abuse Protection, redirect URL, leaked-password protection (jeśli plan pozwala), przegląd RLS/advisors i odbiorcę Alertmanagera.
3. Dodaj `staging:check` uruchamiający test kontraktu bez obowiązkowego Dockera.
4. Opisz alpha.38, rozdzielając „gotowe w repo” od „wymaga operatora”.
5. Uruchom świeżo: `npm run check`, `npm run staging:check`, `npm audit --omit=dev`, `git diff --check`, `git status --short`; jeśli Docker jest dostępny, także walidację Compose i build aplikacji.
6. Zapisz osobny commit `config: prepare protected staging environment`, dodając tylko pliki tego etapu. Wypchnij zwykłym `git push`; bez wdrożenia i zmian zdalnego Supabase/Cloudflare.
