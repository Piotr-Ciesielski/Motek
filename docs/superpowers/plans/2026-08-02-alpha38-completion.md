# Motek alpha.38 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Domknąć i jednoznacznie oznaczyć wersję `2.0.0-alpha.38` bez wykonywania zdalnej migracji Supabase.

**Architecture:** Istniejąca implementacja e-maila jako loginu pozostaje bez zmian funkcjonalnych. Pakiet dodaje regresyjny kontrakt wersji, ujednolica wszystkie publikowane identyfikatory i dokumentuje granicę między gotowym kodem a niewykonaną operacją zdalną.

**Tech Stack:** Node.js, `node:test`, npm, HTML, Markdown, Supabase migrations.

## Global Constraints

- Docelowa wersja to dokładnie `2.0.0-alpha.38`.
- Rejestracja nadal wysyła wyłącznie `login` i `password`.
- Aktywny kod nie może odczytywać ani zwracać `full_name` lub `fullName`.
- Historyczne migracje pozostają niezmienione; bieżąca migracja usuwająca dane pozostaje lokalnym artefaktem repozytorium.
- Nie wykonywać `supabase db push`, zdalnego SQL ani zmian w panelu Supabase.
- Nie stage'ować istniejących usunięć `CODEX_POMOC.txt` i `WZORY_AUDYT_DANYCH.md` w checkpointach tego pakietu.

---

### Task 1: Kontrakt numeru wersji

**Files:**
- Create: `test/version.test.js`
- Modify: `VERSION`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `index.html`

**Interfaces:**
- Consumes: `VERSION`, pola `version` npm oraz wersjonowane adresy zasobów HTML.
- Produces: jeden kontrakt `2.0.0-alpha.38` sprawdzany automatycznie.

- [ ] **Step 1: Napisać test, który wymaga spójnej wersji**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const expected = "2.0.0-alpha.38";

test("publikowane pliki wskazują jedną wersję alpha.38", () => {
  const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  const packageJson = require(path.join(root, "package.json"));
  const lock = require(path.join(root, "package-lock.json"));
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

  assert.equal(version, expected);
  assert.equal(packageJson.version, expected);
  assert.equal(lock.version, expected);
  assert.equal(lock.packages[""].version, expected);
  assert.doesNotMatch(html, /2\.0\.0-alpha\.37/);
  assert.equal((html.match(/2\.0\.0-alpha\.38/g) || []).length, 5);
});
```

- [ ] **Step 2: Uruchomić RED**

Run: `node --test test/version.test.js`

Expected: FAIL na `VERSION`, `package.json`, lockfile i `index.html`, ponieważ nadal wskazują `alpha.37`.

- [ ] **Step 3: Ustawić wersję przez npm i pliki publikowane**

Run: `npm version 2.0.0-alpha.38 --no-git-tag-version`

Następnie zmienić `VERSION` na:

```text
2.0.0-alpha.38
```

W pięciu adresach zasobów w `index.html` zastąpić `v=2.0.0-alpha.37` wartością `v=2.0.0-alpha.38`.

- [ ] **Step 4: Uruchomić GREEN**

Run: `node --test test/version.test.js`

Expected: PASS, 1 test, 0 błędów.

- [ ] **Step 5: Sprawdzić cały pakiet wersji**

Run: `npm run check`

Expected: wszystkie testy i kontrole składni PASS.

- [ ] **Step 6: Zapisać checkpoint**

```powershell
git add VERSION package.json package-lock.json index.html test/version.test.js
git commit -m "chore: release alpha.38"
git push origin docs/update-project-documentation
```

### Task 2: Kontrakt prywatności profilu i migracji

**Files:**
- Modify: `test/migration.test.js`
- Inspect: `server.js`
- Inspect: `app.js`
- Inspect: `supabase/migrations/20260731104741_email_login_and_remove_full_name.sql`

**Interfaces:**
- Consumes: końcową migrację e-mailowego loginu i aktywne pliki aplikacji.
- Produces: dowód, że `full_name` występuje tylko w historii migracji lub testach jego usunięcia.

- [ ] **Step 1: Rozszerzyć test o końcowy trigger i uprawnienia**

Dodać asercje:

```js
test("końcowa migracja utrzymuje login równy emailowi i odbiera jego edycję", () => {
  assert.match(sql, /insert into public\.profiles \(id, login, email, avatar_url\)/);
  assert.match(sql, /set email = normalized_email,[\s\S]*login = normalized_email/);
  assert.match(sql, /revoke update \(login, full_name, avatar_url\)/);
  assert.match(sql, /grant update \(avatar_url\)/);
  assert.match(sql, /profiles_login_email_check/);
});
```

- [ ] **Step 2: Uruchomić test migracji**

Run: `node --test test/migration.test.js`

Expected: PASS. To jest test charakterystyczny istniejącej, już napisanej migracji; jeśli nie przejdzie, zatrzymać pakiet i poprawić wyłącznie brakujący kontrakt migracji.

- [ ] **Step 3: Sprawdzić aktywny kod**

Run: `rg -n "full_name|fullName|register-email|register-full-name" index.html app.js server.js README.md SPEC.md`

Expected: brak trafień w aktywnym kodzie i aktualnej dokumentacji. Trafienia w historycznych migracjach i testach usunięcia są prawidłowe.

- [ ] **Step 4: Sprawdzić migracje lokalnie bez ich stosowania**

Run: `supabase --version`

Run: `supabase migration list --local`

Expected: migracja `20260731104741` jest widoczna lokalnie. Nie uruchamiać polecenia push.

- [ ] **Step 5: Zapisać checkpoint tylko jeśli test wymagał zmiany**

```powershell
git add test/migration.test.js
git commit -m "test: lock email login migration contract"
git push origin docs/update-project-documentation
```

### Task 3: Dokumentacja finalnego stanu alpha.38

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `CHANGELOG.txt`
- Modify: `docs/PATTERN-CATALOG.md` only if it contains a version status

**Interfaces:**
- Consumes: zweryfikowany kontrakt wersji i lokalną migrację.
- Produces: dokumentację rozróżniającą gotowy kod od zdalnej operacji wymagającej osobnej zgody.

- [ ] **Step 1: Ustawić aktualną wersję w README i SPEC**

Zmienić bieżącą wersję na `2.0.0-alpha.38`. W `CHANGELOG.txt` usunąć dopisek „w przygotowaniu” wyłącznie z wpisu `alpha.38`; `alpha.37` pozostawić jako wcześniejszy etap.

- [ ] **Step 2: Dopisać status migracji**

W README i SPEC dodać jednoznaczne zdanie:

```text
Migracja e-mailowego loginu znajduje się w repozytorium; jej zastosowanie i kontrola na zdalnym Supabase są osobnym krokiem operacyjnym.
```

- [ ] **Step 3: Sprawdzić dokumentację i whitespace**

Run: `rg -n "Aktualna wersja rozwojowa|bieżąca wersja rozwojowa|alpha\.37|alpha\.38" README.md SPEC.md CHANGELOG.txt`

Run: `git diff --check`

Expected: status bieżący wskazuje `alpha.38`; brak błędów whitespace.

- [ ] **Step 4: Uruchomić pełną weryfikację**

Run: `npm run check`

Expected: PASS, 0 failures.

- [ ] **Step 5: Zapisać i opublikować dokumentację**

```powershell
git add README.md SPEC.md CHANGELOG.txt
git commit -m "docs: finalize alpha.38 status"
git push origin docs/update-project-documentation
```
