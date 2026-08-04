# Railway, Cloudflare i regresja po wdrożeniu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wdrożyć Motka na Railway pod `staging.rysia.org` i `www.rysia.org`, zabezpieczyć ruch Cloudflare oraz automatycznie uruchamiać bezpieczne testy regresji po każdym udanym wdrożeniu.

**Architecture:** Jedna usługa Node.js obsługuje frontend i API, a każde środowisko Railway korzysta z osobnego Supabase. GitHub Actions reaguje na zakończone wdrożenie Railway, potwierdza SHA działającej wersji i uruchamia pełną regresję na stagingu albo niedestrukcyjny profil produkcyjny. Cloudflare pozostaje publicznym punktem wejścia, obsługuje DNS, stałe przekierowanie domeny głównej i reguły ochronne.

**Tech Stack:** Node.js 24, `node:test`, natywny `fetch`, GitHub Actions, Railway Config as Code, Supabase, Cloudflare DNS/WAF/Turnstile.

> **Aktualizacja 2026-08-04:** plan został wykonany dla bieżącego środowiska. Staging działa z gałęzi `staging` i wdraża się automatycznie. Produkcja działa z `main`, ale auto-deploy jest wyłączony; deploy produkcyjny uruchamia operator ręcznie po akceptacji regresji stagingu. Bieżące polecenia i kryteria operacyjne znajdują się w [runbooku po wdrożeniu](../operations/post-deploy-regression.md).

## Global Constraints

- Produkcja działa wyłącznie pod kanonicznym originem `https://www.rysia.org`.
- Staging działa pod `https://staging.rysia.org` i nie współdzieli projektu Supabase z produkcją.
- Produkcja wdraża wyłącznie `main`; staging wdraża wyłącznie `staging`.
- `SUPABASE_SECRET_KEY`, hasła QA, cookies i tokeny sesji nigdy nie trafiają do logów ani Git.
- Produkcyjny Turnstile nie może mieć testowych kluczy ani obejścia dla CI.
- Pełna automatyczna regresja zalogowanego użytkownika działa na stagingu; produkcja wykonuje profil niedestrukcyjny po ręcznie uruchomionym deployu.
- Każdy zapis testowy używa prefiksu `regression-<run-id>` i jest usuwany po dokładnym ID w `finally`.
- Railway uruchamia jedną replikę, dopóki rate limiting aplikacji przechowuje stan w pamięci procesu.
- `PORT` pochodzi z Railway, a aplikacja nasłuchuje na `HOST=0.0.0.0`.
- Zmiany w zewnętrznych usługach, DNS, migracje i publikacja wymagają wcześniejszej zgody użytkownika.
- Commity i push są wykonywane dopiero po wyraźnej zgodzie użytkownika na checkpoint Git.

---

### Task 1: Walidacja bezpiecznej konfiguracji produkcyjnej

**Files:**
- Modify: `deployment-policy.js`
- Modify: `test/deployment-policy.test.js`

**Interfaces:**
- Consumes: `validateDeploymentConfig(env)` i `readCaptchaConfig(env)`.
- Produces: jedna walidacja fail-closed dla `DEPLOYMENT_ENV=staging` i `DEPLOYMENT_ENV=production`.

- [ ] **Step 1: Dodać test, że produkcja odrzuca niebezpieczną konfigurację**

```js
test("produkcja wymaga HTTPS, proxy, secure cookies i Turnstile", () => {
  assert.throws(() => validateDeploymentConfig({
    DEPLOYMENT_ENV: "production",
    NODE_ENV: "production",
    APP_ORIGIN: "http://www.rysia.org",
    COOKIE_SECURE: "false",
    HOST: "127.0.0.1",
    TRUST_PROXY: "false",
    CAPTCHA_ENABLED: "false",
  }), /APP_ORIGIN.*COOKIE_SECURE.*HOST.*TRUST_PROXY.*CAPTCHA_ENABLED/);
});
```

- [ ] **Step 2: Uruchomić test i potwierdzić właściwy RED**

Run: `node --test test/deployment-policy.test.js`

Expected: FAIL, ponieważ obecna funkcja pomija `DEPLOYMENT_ENV=production`.

- [ ] **Step 3: Rozszerzyć walidację na staging i production**

Implementacja ma uznawać oba środowiska za publiczne, wymagać dokładnego originu HTTPS bez ścieżki/query, `NODE_ENV=production`, `COOKIE_SECURE=true`, `HOST=0.0.0.0`, `TRUST_PROXY=true`, włączonego Turnstile oraz niepustych trzech zmiennych Supabase. Komunikat błędu może wymieniać wyłącznie nazwy zmiennych.

- [ ] **Step 4: Uruchomić test modułu oraz pełny check**

Run: `node --test test/deployment-policy.test.js`

Expected: PASS.

Run: `npm run check`

Expected: wszystkie testy PASS bez ostrzeżeń.

- [ ] **Step 5: Po zgodzie użytkownika zapisać checkpoint**

```text
git add deployment-policy.js test/deployment-policy.test.js
git commit -m "security: enforce production deployment settings"
```

---

### Task 2: Identyfikacja dokładnej wersji działającego wdrożenia

**Files:**
- Create: `release-info.js`
- Create: `test/release-info.test.js`
- Modify: `server.js`
- Modify: `test/server.test.js`

**Interfaces:**
- Produces: `readReleaseInfo(env, version)` zwracające `{version, commit, environment}`.
- Produces: `GET /health/release`, HTTP 200 tylko przy gotowym Supabase, z `{status:"ready",version,commit,environment}`.

- [ ] **Step 1: Napisać test normalizacji metadanych release**

```js
test("release używa SHA Railway i nie ujawnia innych zmiennych", () => {
  assert.deepEqual(readReleaseInfo({
    RAILWAY_GIT_COMMIT_SHA: "a".repeat(40),
    DEPLOYMENT_ENV: "staging",
    SUPABASE_SECRET_KEY: "nie-wolno-zwrócić",
  }, "2.0.0-alpha.38"), {
    version: "2.0.0-alpha.38",
    commit: "a".repeat(40),
    environment: "staging",
  });
});
```

- [ ] **Step 2: Uruchomić RED**

Run: `node --test test/release-info.test.js`

Expected: FAIL z brakiem modułu `release-info.js`.

- [ ] **Step 3: Zaimplementować moduł i endpoint**

`readReleaseInfo` akceptuje pełny SHA `[0-9a-f]{40}`; lokalnie zwraca `commit:"local"`. `server.js` czyta istniejący plik `VERSION` raz przy starcie. `/health/release` zwraca 503 ze `status:"not_ready"`, dopóki zależności nie są gotowe.

- [ ] **Step 4: Dodać kontrakt HTTP endpointu**

```js
const response = await fetch(`${baseUrl}/health/release`);
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  status: "ready",
  version: "2.0.0-alpha.38",
  commit: "local",
  environment: "local",
});
```

- [ ] **Step 5: Uruchomić weryfikację**

Run: `node --test test/release-info.test.js test/server.test.js`

Expected: PASS.

Run: `npm run check`

Expected: wszystkie testy PASS.

- [ ] **Step 6: Po zgodzie użytkownika zapisać checkpoint**

```text
git add release-info.js server.js test/release-info.test.js test/server.test.js
git commit -m "feat: expose safe deployment release metadata"
```

---

### Task 3: Konfiguracja Railway jako kod

**Files:**
- Create: `deploy/railway/Dockerfile`
- Create: `railway.json`
- Create: `test/railway-config.test.js`
- Modify: `.dockerignore`
- Modify: `package.json`

**Interfaces:**
- Produces: obraz Node.js 24 uruchamiany jako użytkownik bez uprawnień root.
- Produces: healthcheck `/health/ready`, timeout 300 sekund, restart `ON_FAILURE`.

- [ ] **Step 1: Napisać test konfiguracji Railway**

```js
test("Railway używa przypiętego obrazu, readiness i bezpiecznego startu", () => {
  const config = JSON.parse(readFileSync("railway.json", "utf8"));
  assert.equal(config.build.builder, "DOCKERFILE");
  assert.equal(config.build.dockerfilePath, "deploy/railway/Dockerfile");
  assert.equal(config.deploy.healthcheckPath, "/health/ready");
  assert.equal(config.deploy.restartPolicyType, "ON_FAILURE");
});
```

- [ ] **Step 2: Uruchomić RED**

Run: `node --test test/railway-config.test.js`

Expected: FAIL, ponieważ `railway.json` nie istnieje.

- [ ] **Step 3: Dodać `railway.json`**

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "deploy/railway/Dockerfile"
  },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/health/ready",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "drainingSeconds": "10"
  }
}
```

- [ ] **Step 4: Dodać dedykowany Dockerfile Railway**

Użyć tego samego przypiętego obrazu Node 24 co sprawdzony staging, wykonać `npm ci --omit=dev`, skopiować wyłącznie pliki potrzebne runtime, ustawić `NODE_ENV=production`, `HOST=0.0.0.0`, przełączyć na `USER node` i nie definiować stałego `PORT`.

- [ ] **Step 5: Dodać `engines.node` i komendę kontroli konfiguracji**

```json
"engines": { "node": "24.x" },
"scripts": {
  "railway:check": "node --test test/railway-config.test.js"
}
```

- [ ] **Step 6: Zweryfikować config i obraz**

Run: `npm run railway:check`

Expected: PASS.

Run: `docker build -f deploy/railway/Dockerfile -t motek-railway-check .`

Expected: obraz buduje się bez błędu; uruchomienie obrazu nastąpi w osobnym teście z kontrolowanymi zmiennymi testowymi.

- [ ] **Step 7: Po zgodzie użytkownika zapisać checkpoint**

```text
git add deploy/railway/Dockerfile railway.json test/railway-config.test.js .dockerignore package.json package-lock.json
git commit -m "config: prepare Railway deployment"
```

---

### Task 4: Testowalny klient regresji HTTP

**Files:**
- Create: `scripts/regression/http-session.js`
- Create: `test/regression-http-session.test.js`

**Interfaces:**
- Produces: `createHttpSession({baseUrl, origin, fetchImpl})`.
- Produces: metody `request(path, options)`, `json(path, options)`, `getCookies()` i automatyczne przechowywanie `Set-Cookie`.

- [ ] **Step 1: Napisać test cookie jar i Origin**

```js
test("sesja regresji zachowuje cookies i dodaje Origin do mutacji", async () => {
  const seen = [];
  const session = createHttpSession({
    baseUrl: "https://staging.rysia.org",
    origin: "https://staging.rysia.org",
    fetchImpl: async (url, options) => {
      seen.push({ url, options });
      return new Response("{}", { status: 200, headers: { "set-cookie": "motek_access_token=abc; Path=/; HttpOnly" } });
    },
  });
  await session.json("/api/auth/login", { method: "POST", body: { email: "qa@example.test" } });
  await session.json("/api/auth/session");
  assert.equal(seen[0].options.headers.Origin, "https://staging.rysia.org");
  assert.match(seen[1].options.headers.Cookie, /motek_access_token=abc/);
});
```

- [ ] **Step 2: Uruchomić RED**

Run: `node --test test/regression-http-session.test.js`

Expected: FAIL z brakiem helpera.

- [ ] **Step 3: Zaimplementować minimalny klient**

Klient ma walidować HTTPS z wyjątkiem jawnego lokalnego testu, ustawiać `Content-Type: application/json`, dodawać `Origin` wyłącznie dla mutacji i nigdy nie wypisywać body, cookies ani nagłówka Authorization.

- [ ] **Step 4: Dodać testy wielu nagłówków `Set-Cookie`, błędnego JSON i timeoutu**

Timeout realizować przez `AbortSignal.timeout(10_000)`. Błąd ma zawierać metodę, ścieżkę i status, ale nie treść sekretów.

- [ ] **Step 5: Uruchomić testy**

Run: `node --test test/regression-http-session.test.js`

Expected: PASS.

- [ ] **Step 6: Po zgodzie użytkownika zapisać checkpoint**

```text
git add scripts/regression/http-session.js test/regression-http-session.test.js
git commit -m "test: add safe deployment regression client"
```

---

### Task 5: Niedestrukcyjny profil regresji dla obu środowisk

**Files:**
- Create: `scripts/regression/public-suite.js`
- Create: `test/regression-public-suite.test.js`

**Interfaces:**
- Consumes: `createHttpSession` i `{baseUrl, expectedSha, expectedEnvironment}`.
- Produces: `runPublicRegression(options)` kończące się błędem przy pierwszym naruszeniu kontraktu.

- [ ] **Step 1: Napisać test oczekiwanej sekwencji publicznej**

Testowy serwer ma zwrócić kontrolowane odpowiedzi dla `/health/live`, `/health/ready`, `/health/release`, `/`, `/styles.css`, `/app.js`, `/api/config`, `/api/patterns?limit=1&offset=0`, `/api/yarns`, `/api/matches` oraz `/internal/metrics`.

- [ ] **Step 2: Uruchomić RED**

Run: `node --test test/regression-public-suite.test.js`

Expected: FAIL z brakiem `runPublicRegression`.

- [ ] **Step 3: Zaimplementować profil publiczny**

Sprawdzić dokładnie: statusy health, SHA i environment, obecność markerów HTML/CSS/JS, CSP, `X-Content-Type-Options=nosniff`, brak `Access-Control-Allow-Origin`, CAPTCHA enabled/provider/siteKey bez pola secret, co najmniej jeden wzór i poprawną paginację, 401 dla prywatnych odczytów, 403 dla obcego originu i brak publicznych metryk.

- [ ] **Step 4: Dodać produkcyjny test przekierowania apex**

Wywołać `https://rysia.org/regression-check?source=post-deploy` z `redirect:"manual"` i wymagać trwałego statusu 301 lub 308 oraz `Location: https://www.rysia.org/regression-check?source=post-deploy`.

- [ ] **Step 5: Uruchomić test modułu**

Run: `node --test test/regression-public-suite.test.js`

Expected: PASS.

- [ ] **Step 6: Po zgodzie użytkownika zapisać checkpoint**

```text
git add scripts/regression/public-suite.js test/regression-public-suite.test.js
git commit -m "test: cover public post-deploy regression"
```

---

### Task 6: Pełna regresja zalogowanego użytkownika na stagingu

**Files:**
- Create: `scripts/regression/authenticated-suite.js`
- Create: `test/regression-authenticated-suite.test.js`

**Interfaces:**
- Consumes: `{baseUrl,email,password,captchaToken,runId}`.
- Produces: `runAuthenticatedRegression(options)` z bezpiecznym cleanupem w `finally`.

- [ ] **Step 1: Napisać test pełnego flow i sprzątania**

Test ma wymusić kolejność: login → session → GET yarns/ETag → POST yarn → PATCH yarn → PATCH ze starym ETag i 409 → GET matches → DELETE własnego ID → logout → session unauthenticated.

Payload testowy:

```js
{
  name: `regression-${runId}`,
  color: "zielony",
  materials: ["wełna"],
  weightClass: "dk",
  length: 300,
  weight: 100,
}
```

- [ ] **Step 2: Uruchomić RED**

Run: `node --test test/regression-authenticated-suite.test.js`

Expected: FAIL z brakiem funkcji.

- [ ] **Step 3: Zaimplementować flow z ETag**

Przed każdą mutacją pobrać bieżący ETag. Zapamiętać wyłącznie dokładne ID utworzonej włóczki. Nie usuwać innych rekordów konta QA.

- [ ] **Step 4: Zaimplementować cleanup w `finally`**

Jeśli rekord nadal istnieje, pobrać świeży ETag i usunąć tylko zapamiętane ID. Błąd cleanupu ma być dołączony do raportu bez przesłaniania pierwotnej przyczyny.

- [ ] **Step 5: Uruchomić testy sukcesu i kontrolowanej awarii**

Run: `node --test test/regression-authenticated-suite.test.js`

Expected: PASS; scenariusz awarii potwierdza wykonanie cleanupu.

- [ ] **Step 6: Po zgodzie użytkownika zapisać checkpoint**

```text
git add scripts/regression/authenticated-suite.js test/regression-authenticated-suite.test.js
git commit -m "test: cover authenticated staging regression"
```

---

### Task 7: Runner, oczekiwanie na SHA i komendy npm

**Files:**
- Create: `scripts/regression/wait-for-release.js`
- Create: `scripts/run-regression.js`
- Create: `test/regression-runner.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `waitForRelease({baseUrl,expectedSha,expectedEnvironment,timeoutMs,intervalMs})`.
- Produces: `npm run regression:smoke` i `npm run regression:full`.

- [ ] **Step 1: Napisać test, że polling nie akceptuje poprzedniego SHA**

```js
test("czeka na dokładny commit zamiast testować poprzedni deploy", async () => {
  const commits = ["a".repeat(40), "b".repeat(40)];
  const result = await waitForRelease({
    baseUrl: "https://staging.rysia.org",
    expectedSha: "b".repeat(40),
    expectedEnvironment: "staging",
    intervalMs: 0,
    timeoutMs: 100,
    fetchImpl: async () => new Response(JSON.stringify({
      status: "ready",
      commit: commits.shift(),
      environment: "staging",
    }), { status: 200 }),
  });
  assert.equal(result.commit, "b".repeat(40));
});
```

- [ ] **Step 2: Uruchomić RED i zaimplementować polling**

Run: `node --test test/regression-runner.test.js`

Expected przed implementacją: FAIL. Domyślnie polling trwa maksymalnie 15 minut, odpytuje co 10 sekund i przerywa się na niepoprawnym environment.

- [ ] **Step 3: Dodać runner profili**

Runner waliduje `MOTEK_BASE_URL`, `MOTEK_EXPECTED_SHA` i `MOTEK_ENVIRONMENT`. Profil `full` dodatkowo wymaga `MOTEK_QA_EMAIL` i `MOTEK_QA_PASSWORD`, a token stagingowy ustawia na oficjalne `XXXX.DUMMY.TOKEN.XXXX`. Brak danych kończy program przed pierwszym żądaniem mutującym.

- [ ] **Step 4: Dodać skrypty npm**

```json
"regression:smoke": "node scripts/run-regression.js smoke",
"regression:full": "node scripts/run-regression.js full"
```

- [ ] **Step 5: Uruchomić testy jednostkowe i pełny check**

Run: `node --test test/regression-runner.test.js`

Expected: PASS.

Run: `npm run check`

Expected: wszystkie testy PASS.

- [ ] **Step 6: Po zgodzie użytkownika zapisać checkpoint**

```text
git add scripts/regression/wait-for-release.js scripts/run-regression.js test/regression-runner.test.js package.json package-lock.json
git commit -m "test: add post-deploy regression runner"
```

---

### Task 8: Automatyczny workflow po deployu Railway

**Files:**
- Create: `.github/workflows/post-deploy-regression.yml`
- Create: `test/post-deploy-workflow.test.js`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: GitHub `deployment_status` wysłany przez Railway.
- Consumes: GitHub Environment variable `MOTEK_BASE_URL` oraz staging secrets `MOTEK_QA_EMAIL`, `MOTEK_QA_PASSWORD`.
- Produces: jeden check regresji dla właściwego SHA i środowiska.

- [ ] **Step 1: Napisać statyczny test zabezpieczeń workflow**

Test ma potwierdzić obecność `deployment_status`, `permissions: contents: read`, stan `success`, dozwolone pary `staging/staging` oraz `production/main`, checkout dokładnego `github.event.deployment.sha`, concurrency z `cancel-in-progress: true` i brak nazw `SUPABASE_SECRET_KEY`, `RAILWAY_TOKEN`, `TURNSTILE_SECRET`.

- [ ] **Step 2: Uruchomić RED**

Run: `node --test test/post-deploy-workflow.test.js`

Expected: FAIL, ponieważ workflow nie istnieje.

- [ ] **Step 3: Dodać workflow**

Workflow ma:

```yaml
on: deployment_status
permissions:
  contents: read
concurrency:
  group: post-deploy-${{ github.event.deployment.environment }}
  cancel-in-progress: true
```

Job uruchamia się tylko, gdy status to `success`, środowisko/ref to `staging/staging` albo `production/main`, a deployment należy do bieżącego repozytorium. Checkout używa dokładnego SHA. Node 24 i `npm ci` poprzedzają runner. `staging` wybiera `regression:full`, `production` wybiera `regression:smoke`.

- [ ] **Step 4: Objąć gałąź staging podstawowym CI**

W `.github/workflows/ci.yml` ustawić `push.branches: [main, staging]`, pozostawiając PR-y do `main`.

- [ ] **Step 5: Uruchomić kontrolę workflow**

Run: `node --test test/post-deploy-workflow.test.js`

Expected: PASS.

Run: `npm run check`

Expected: wszystkie testy PASS.

- [ ] **Step 6: Po zgodzie użytkownika zapisać checkpoint**

```text
git add .github/workflows/ci.yml .github/workflows/post-deploy-regression.yml test/post-deploy-workflow.test.js
git commit -m "ci: run regression after Railway deployments"
```

---

### Task 9: Dokumentacja operatorska testów i wdrożenia

**Files:**
- Create: `docs/operations/post-deploy-regression.md`
- Modify: `docs/superpowers/specs/2026-08-03-railway-cloudflare-production-design.md`
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `CHANGELOG.txt`

**Interfaces:**
- Produces: jedna procedura konfiguracji, interpretacji wyniku, cleanupu i rollbacku.

- [ ] **Step 1: Udokumentować macierz regresji**

Tabela ma jawnie wskazać: test, staging automatycznie, produkcja po ręcznym deployu, test ręczny oraz powód ograniczenia. Rejestracja/e-mail/reset/usunięcie konta pozostają ręczne na publicznych konfiguracjach z prawdziwym Turnstile.

- [ ] **Step 2: Udokumentować GitHub Environments**

`staging`: variable `MOTEK_BASE_URL=https://staging.rysia.org`, secrets `MOTEK_QA_EMAIL` i `MOTEK_QA_PASSWORD`, branch policy tylko `staging`.

`production`: variable `MOTEK_BASE_URL=https://www.rysia.org`, bez sekretów QA dla automatycznego smoke testu, branch policy tylko `main`.

- [ ] **Step 3: Udokumentować diagnozę i rollback**

Kolejność: sprawdź SHA `/health/release` → log GitHub Action → `/health/ready` → Railway deploy logs → Cloudflare events → Supabase logs. Rollback aplikacji wskazuje poprzedni udany deployment Railway i nie cofa migracji.

- [ ] **Step 4: Udokumentować ręczny test produkcyjny**

Dedykowane konto QA: login po prawdziwym Turnstile, odczyt magazynu, utworzenie jednego oznaczonego motka, dopasowania, usunięcie dokładnego ID, logout. Nie wykonywać automatycznego usunięcia konta produkcyjnego.

- [ ] **Step 5: Sprawdzić dokumentację i pełny projekt**

Run: `rg -n "TBD|TODO|implement later" docs/operations/post-deploy-regression.md docs/superpowers/specs/2026-08-03-railway-cloudflare-production-design.md README.md SPEC.md CHANGELOG.txt`

Expected: brak placeholderów w nowej dokumentacji.

Run: `npm run check`

Expected: wszystkie testy PASS.

- [ ] **Step 6: Po zgodzie użytkownika zapisać checkpoint**

```text
git add docs/operations/post-deploy-regression.md docs/superpowers/specs/2026-08-03-railway-cloudflare-production-design.md README.md SPEC.md CHANGELOG.txt
git commit -m "docs: describe Railway deployment regression"
```

---

### Task 10: Kontrola sekretów publicznego repozytorium

**Files:**
- Inspect only: pełna historia Git i aktualne śledzone pliki
- Modify only if needed after separate review: `.gitignore`, dokumentacja bezpieczeństwa

**Interfaces:**
- Produces: raport nazw plików/commitów bez ujawniania pełnych wartości sekretów.

- [ ] **Step 1: Potwierdzić, że `.env` nie jest śledzony**

Run: `git ls-files .env "*.pem" "*.key"`

Expected: brak `.env`, prywatnych kluczy i certyfikatów.

- [ ] **Step 2: Przeskanować aktualne pliki i historię**

Użyć skanera sekretów albo kontrolowanych wzorców dla `sb_secret_`, JWT, tokenów GitHub/Railway i prywatnych kluczy. Raport redaguje wartości do pierwszych czterech znaków i lokalizacji.

- [ ] **Step 3: Ocenić każdy wynik**

Fałszywe alarmy dokumentować. Potwierdzony sekret traktować jako ujawniony: wstrzymać deployment, obrócić go w źródłowej usłudze i dopiero później usunąć z historii w osobno zatwierdzonej operacji wysokiego ryzyka.

- [ ] **Step 4: Zapisać wynik kontroli bez sekretów**

Jeżeli nie ma zmian plików, nie tworzyć pustego commita. Jeżeli potrzebna jest poprawka `.gitignore`, najpierw uruchomić test `test/gitignore.test.js`, a checkpoint zaproponować użytkownikowi osobno.

---

### Task 11: Konfiguracja zewnętrzna stagingu

**Files:**
- Reference: `docs/operations/post-deploy-regression.md`
- External state: Supabase staging, Railway staging, Cloudflare

**Interfaces:**
- Produces: działający `https://staging.rysia.org` z pełną automatyczną regresją.

- [ ] **Step 1: Po osobnej zgodzie utworzyć projekt Supabase staging**

Zastosować komplet migracji, uruchomić doradców bezpieczeństwa, ustawić Site URL i dokładny recovery redirect dla stagingu oraz utworzyć nieadministracyjne konto QA.

- [ ] **Step 2: Skonfigurować testowy Turnstile wyłącznie na stagingu**

Użyć oficjalnego site key `1x00000000000000000000AA` oraz odpowiadającego mu testowego secret key w Supabase staging. Produkcyjny projekt nie może otrzymać tych wartości.

- [ ] **Step 3: Utworzyć Railway `staging` z gałęzi `staging`**

Wprowadzić zmienne ze specyfikacji, pozostawić `PORT` Railway, ustawić jedną replikę i potwierdzić healthcheck `/health/ready`.

- [ ] **Step 4: Delegować DNS do Cloudflare i podłączyć staging**

Zmianę nameserverów oraz rekordów CNAME/TXT wykonać dokładnie według aktualnych paneli Railway i Cloudflare. Ustawić proxy, `noindex` i ochronę dostępu stagingu bez blokowania workflow QA.

- [ ] **Step 5: Skonfigurować GitHub Environment `staging`**

Dodać jedną zmienną URL, dwa sekrety QA i branch policy tylko dla `staging`. Nie dodawać klucza administracyjnego Supabase ani sekretu Railway.

- [ ] **Step 6: Wykonać pierwszy deploy i obserwować automat**

Potwierdzić zgodny SHA w `/health/release`, zielony `regression:full`, brak osieroconych danych `regression-*` i brak sekretów w logach.

---

### Task 12: Promocja produkcyjna i regresja po deployu

**Files:**
- Reference: `docs/operations/post-deploy-regression.md`
- External state: Supabase production, Railway production, Cloudflare

**Interfaces:**
- Produces: `https://www.rysia.org` z profilem `smoke` uruchamianym po ręcznym deployu.

- [ ] **Step 1: Potwierdzić bramkę stagingową**

Wymagane: zielone `npm run check`, Railway config check, pełna regresja stagingu, ręczny test prawdziwego Turnstile/WAF, Security Advisor Supabase bez nowych błędów i zakończona kontrola sekretów.

- [ ] **Step 2: Po osobnej zgodzie skonfigurować produkcyjne Supabase**

Zastosować sprawdzone migracje, dokładny Site URL `https://www.rysia.org`, recovery redirect `https://www.rysia.org/?recovery=1`, prawdziwy Turnstile i polityki bezpieczeństwa ze specyfikacji.

- [ ] **Step 3: Skonfigurować Railway production z `main`**

Wprowadzić produkcyjne zmienne bez kopiowania stagingowych sekretów, pozostawić jedną replikę i najpierw wykonać smoke test przez tymczasową domenę Railway.

- [ ] **Step 4: Podłączyć domeny przez Cloudflare**

Skierować `www.rysia.org` do produkcji, ustawić stałe przekierowanie apex z zachowaniem ścieżki/query, wyłączyć cache `/api/*`, włączyć uzgodnione reguły WAF/rate limit i dopiero po stabilnym HTTPS włączyć krótkie HSTS `max-age=86400` bez `includeSubDomains`.

- [ ] **Step 5: Potwierdzić smoke test produkcji po ręcznym deployu**

GitHub Action musi sprawdzić dokładny SHA, HTTPS, frontend, zasoby, katalog, nagłówki, brak dostępu bez sesji, CSRF, brak metryk i przekierowanie domeny.

- [ ] **Step 6: Wykonać ręczny zalogowany smoke test**

Na dedykowanym produkcyjnym koncie QA wykonać login przez prawdziwy Turnstile, utworzyć jeden oznaczony motek, sprawdzić dopasowania, usunąć dokładnie ten rekord i wylogować się.

- [ ] **Step 7: Zamknąć wdrożenie**

Potwierdzić monitoring `/health/ready`, brak błędów 5xx w Railway/Cloudflare, brak sekretów w logach i dostępność rollbacku do poprzedniego deploymentu. Dopiero wtedy ogłosić produkcję jako gotową.
