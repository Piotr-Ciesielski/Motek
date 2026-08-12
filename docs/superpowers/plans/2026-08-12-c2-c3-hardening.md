# C2/C3 hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Domknąć lokalne testy i monitoring bezpieczeństwa C2/C3 bez zmian DNS, paneli dostawców, nowych usług ani HSTS.

**Architecture:** Aplikacja zachowuje istniejące nagłówki bezpieczeństwa. Testy serwera potwierdzą pełny kontrakt nagłówków, Prometheus dostanie jeden alert oparty o istniejącą metrykę `motek_auth_rate_limit_rejections_total`, a runbook rozdzieli czynności lokalne od operatorskich Cloudflare/Railway.

**Tech Stack:** Node.js test runner, JavaScript, Prometheus rules, Markdown, npm scripts.

## Global Constraints

- Nie zmieniać DNS, Cloudflare, Railway ani Supabase.
- Nie włączać HSTS przed potwierdzeniem wszystkich produkcyjnych domen i subdomen.
- Nie włączać Cloudflare Access bez obsługi service-tokenów w workflow.
- Nie dodawać zależności, usług, migracji ani sekretów.
- Nie dodawać nieśledzonych plików użytkownika.

---

### Task 1: Pełny kontrakt nagłówków bezpieczeństwa

**Files:**
- Modify: `test/server.test.js` w istniejącym teście `zwraca zabezpieczoną stronę`
- Test: `test/server.test.js`

**Interfaces:**
- Consumes: uruchomiony testowy serwer Motka i jego odpowiedź dla `/`.
- Produces: asercje wymagające wartości `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` oraz braku `Strict-Transport-Security` w lokalnym kontrakcie.

- [ ] **Step 1: Dopisać failing assertions**

W teście po istniejących asercjach `x-content-type-options` i `x-frame-options` dodać:

```js
assert.equal(response.headers.get("referrer-policy"), "no-referrer");
assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
assert.equal(response.headers.get("strict-transport-security"), null);
```

- [ ] **Step 2: Uruchomić test i potwierdzić RED**

Run: `node --test test/server.test.js`

Expected: FAIL wyłącznie wtedy, gdy któryś z wymaganych nagłówków nie jest obecny lub ma inną wartość. Jeśli test przejdzie od razu, potwierdza istniejący kontrakt i nie wymaga zmiany produkcyjnej.

- [ ] **Step 3: Nie zmieniać aplikacji, jeśli RED nie wystąpi**

W tym zadaniu test jest zabezpieczeniem regresji. HSTS pozostaje jawnie wyłączone lokalnie.

- [ ] **Step 4: Uruchomić GREEN**

Run: `node --test test/server.test.js`

Expected: wszystkie testy pliku PASS.

- [ ] **Step 5: Commit**

```bash
git add test/server.test.js
git commit -m "test: cover security response headers"
```

### Task 2: Alert Prometheus dla skoku odrzuceń Auth

**Files:**
- Modify: `deploy/staging/prometheus/alerts.yml`
- Modify: `test/staging-config.test.js`

**Interfaces:**
- Consumes: `motek_auth_rate_limit_rejections_total{operation=...}` z istniejącego rejestru metryk.
- Produces: alert `MotekAuthRateLimitSpike` z warunkiem `sum(rate(...[5m])) > 0.2`, czasem `for: 5m`, etykietą `severity: warning` i opisem, że należy sprawdzić Cloudflare/Nginx oraz logi aplikacji bez ujawniania danych użytkownika.

- [ ] **Step 1: Dopisać failing test kontraktu alertu**

W `test/staging-config.test.js` odczytać `prometheus/alerts.yml` i dodać:

```js
assert.match(alerts, /alert: MotekAuthRateLimitSpike/);
assert.match(alerts, /motek_auth_rate_limit_rejections_total/);
assert.match(alerts, /for: 5m/);
assert.match(alerts, /severity: warning/);
```

- [ ] **Step 2: Uruchomić test i potwierdzić RED**

Run: `node --test test/staging-config.test.js`

Expected: FAIL, bo alert nie istnieje.

- [ ] **Step 3: Dodać minimalną regułę Prometheus**

W grupie `motek-staging` dodać:

```yaml
- alert: MotekAuthRateLimitSpike
  expr: sum(rate(motek_auth_rate_limit_rejections_total[5m])) > 0.2
  for: 5m
  labels: { severity: warning }
  annotations:
    summary: "Podwyższony poziom odrzuceń Auth"
    description: "Sprawdź Cloudflare/Nginx, limity Auth i logi aplikacji; nie ujawniaj danych użytkowników."
```

Alert dotyczy tylko metryki aplikacyjnej; 429 z Nginx nie są do niej dopisywane.

- [ ] **Step 4: Uruchomić GREEN**

Run: `node --test test/staging-config.test.js`

Expected: wszystkie testy pliku PASS.

- [ ] **Step 5: Commit**

```bash
git add deploy/staging/prometheus/alerts.yml test/staging-config.test.js
git commit -m "monitor: alert on auth rate limit spikes"
```

### Task 3: Runbook C2/C3

**Files:**
- Modify: `docs/operations/post-deploy-regression.md`
- Modify: `docs/superpowers/plans/2026-08-11-production-readiness-three-tracks.md`

**Interfaces:**
- Consumes: istniejącą checklistę Cloudflare/Railway i wyniki audytu lokalnego.
- Produces: jawne kroki operatora oraz aktualny status C2/C3 bez twierdzenia, że konfiguracja zewnętrzna została zweryfikowana.

- [ ] **Step 1: Uzupełnić checklistę runbooka**

Dodać sekcję zawierającą kolejno: potwierdzenie DNS proxied dla produkcji, originu Railway nieosiągalnego z pominięciem Cloudflare, TLS Full (strict), brak cache dla `/api/*`, reguły WAF/rate limit, test publicznego `/internal/metrics` przez domenę i bezpośredni adres originu, odbiorcę alertów i test reakcji.

- [ ] **Step 2: Uzupełnić status planu**

Oznaczyć lokalne testy nagłówków i alert Auth jako wykonane, pozostawiając jako otwarte wyłącznie potwierdzenia wymagające paneli Cloudflare/Railway oraz decyzję o HSTS/Access.

- [ ] **Step 3: Sprawdzić dokumentację**

Run: `git diff --check`

Expected: brak błędów whitespace i brak sekretów.

- [ ] **Step 4: Commit**

```bash
git add docs/operations/post-deploy-regression.md docs/superpowers/plans/2026-08-11-production-readiness-three-tracks.md
git commit -m "docs: close local c2 c3 readiness checks"
```

### Final verification

- [ ] Uruchomić `npm run check`.
- [ ] Uruchomić `npm run lint`.
- [ ] Uruchomić `npm run format:check`.
- [ ] Uruchomić `git diff --check`.
- [ ] Sprawdzić `git status --short` i upewnić się, że nie dodano plików użytkownika.
