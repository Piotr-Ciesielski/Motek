# Motywy kolorystyczne Motka Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać globalny przełącznik dwóch motywów, w którym jasny wariant używa designu „Koloroterapia”, a ciemny wariantu „Nocny Motek”, z lokalnym zapisem preferencji.

**Architecture:** `theme-policy.js` będzie małym modułem bez zależności, udostępniającym czyste funkcje walidacji, odczytu, zapisu i zmiany motywu oraz wykonującym bootstrap `data-theme` przed załadowaniem CSS. `app.js` podłączy globalny przycisk w nagłówku, a `styles.css` otrzyma semantyczne tokeny CSS dla obu palet bez zmiany logiki widoków ani danych Supabase.

**Tech Stack:** Vanilla JavaScript, Node.js built-in test runner, CSS custom properties, istniejący serwer HTTP i istniejący frontend Motka.

## Global Constraints

- Dostępne są dokładnie dwa tryby: `light` i `dark`.
- Domyślny tryb to `light`.
- Preferencja jest lokalna i nie jest zapisywana w Supabase.
- Klucz localStorage to dokładnie `motek-theme-v1`.
- Przełącznik jest globalnie w nagłówku i widoczny dla gościa oraz osoby zalogowanej.
- Zmiana motywu nie przeładowuje strony i nie czyści formularzy ani aktywnego widoku.
- Jasna paleta korzysta z wartości prototypu Color: koral `#e94f4b`, lawenda `#a88be8`, kobalt `#2458d8`, morela `#f2a75f`, złamana biel `#fff8ee`.
- Ciemna paleta korzysta z wartości prototypu Night: granatowo-czarne tło `#090d18`, powierzchnia `#101524`, śliwkowa powierzchnia `#21182e`, złoto `#c39a4b`, piaskowy tekst `#f3eadc`.
- Motyw musi ustawić `color-scheme` dokumentu.
- Nie dodajemy trzeciego trybu systemowego ani nowej zależności npm.

---

### Task 1: Testowalna polityka motywów

**Files:**
- Create: `theme-policy.js`
- Create: `test/theme-policy.test.js`
- Modify: `package.json:10` — sprawdzanie składni nowego modułu

**Interfaces:**
- Produces `THEME_STORAGE_KEY`, `DEFAULT_THEME`, `normalizeTheme(value)`, `readStoredTheme(storage)`, `saveTheme(theme, storage)`, `getNextTheme(theme)`, `getThemeToggleState(theme)` oraz `applyTheme(theme, documentLike)`.
- Node używa `module.exports`, a przeglądarka używa `window.MotekThemePolicy`.

- [ ] **Step 1: Write the failing tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  normalizeTheme,
  readStoredTheme,
  saveTheme,
  getNextTheme,
  getThemeToggleState,
  applyTheme,
} = require("../theme-policy");

test("motyw domyślny jest jasny, a nieznana wartość wraca do jasnego", () => {
  assert.equal(DEFAULT_THEME, "light");
  assert.equal(normalizeTheme("unknown"), "light");
  assert.equal(normalizeTheme(null), "light");
});

test("odczytuje i zapisuje wyłącznie poprawne motywy pod wersjonowanym kluczem", () => {
  const values = new Map([[THEME_STORAGE_KEY, "dark"]]);
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  assert.equal(readStoredTheme(storage), "dark");
  assert.equal(saveTheme("light", storage), "light");
  assert.equal(values.get(THEME_STORAGE_KEY), "light");
});

test("przełącza jasny i ciemny motyw oraz buduje stan kontrolki", () => {
  assert.equal(getNextTheme("light"), "dark");
  assert.equal(getNextTheme("dark"), "light");
  assert.deepEqual(getThemeToggleState("light"), {
    nextTheme: "dark",
    label: "Włącz tryb ciemny",
    shortLabel: "Ciemny",
    pressed: false,
  });
  assert.deepEqual(getThemeToggleState("dark"), {
    nextTheme: "light",
    label: "Włącz tryb jasny",
    shortLabel: "Jasny",
    pressed: true,
  });
});

test("bezpiecznie obsługuje niedostępny localStorage", () => {
  const brokenStorage = {
    getItem() { throw new Error("storage unavailable"); },
    setItem() { throw new Error("storage unavailable"); },
  };
  assert.equal(readStoredTheme(brokenStorage), "light");
  assert.equal(saveTheme("dark", brokenStorage), "dark");
});

test("applyTheme ustawia data-theme i color-scheme na dokumencie", () => {
  const documentLike = { documentElement: { dataset: {}, style: {} } };
  assert.equal(applyTheme("dark", documentLike), "dark");
  assert.equal(documentLike.documentElement.dataset.theme, "dark");
  assert.equal(documentLike.documentElement.style.colorScheme, "dark");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test --test-isolation=none test/theme-policy.test.js`

Expected: `FAIL`, ponieważ `theme-policy.js` jeszcze nie istnieje.

- [ ] **Step 3: Write the minimal implementation**

Zaimplementować czyste funkcje z defensywnym `try/catch` dla storage. `readStoredTheme` ma przyjąć storage jako argument, a w przeglądarce domyślnie używać `window.localStorage`. `applyTheme` ma normalizować wartość przed ustawieniem `documentElement.dataset.theme` i `documentElement.style.colorScheme`. Przy ładowaniu w przeglądarce moduł ma natychmiast odczytać zapisany motyw i wykonać `applyTheme`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test --test-isolation=none test/theme-policy.test.js`

Expected: 4 testy przechodzą.

- [ ] **Step 5: Commit**

```bash
git add theme-policy.js test/theme-policy.test.js package.json
git commit -m "feat: add theme preference policy"
```

### Task 2: Bootstrap motywu i globalna kontrolka nagłówka

**Files:**
- Modify: `index.html:12-15, 22-42, 474-476` — wczesne ładowanie polityki i kontrolka
- Modify: `server.js:1470-1478` — serwowanie `/theme-policy.js`
- Modify: `test/server.test.js` — test zasobu statycznego
- Modify: `styles.css:60-180` — układ i wygląd kontrolki nagłówka

**Interfaces:**
- `index.html` ładuje `/theme-policy.js?v=2.0.0-alpha.36` przed arkuszem CSS, a `app.js` korzysta z `window.MotekThemePolicy`.
- Kontrolka ma `id="themeToggle"`, `type="button"`, `aria-pressed` i tekstowy element `#themeToggleLabel`.

- [ ] **Step 1: Write the failing server test**

W `test/server.test.js` dodać test obok istniejących testów `client-policy.js` i `material-policy.js`:

```js
test("serwuje politykę motywu przed załadowaniem aplikacji", async () => {
  const response = await fetch(`${baseUrl}/theme-policy.js`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /MotekThemePolicy/);
  assert.match(response.headers.get("content-type"), /javascript/);
});
```

- [ ] **Step 2: Run the server test to verify it fails**

Run: `node --test --test-isolation=none test/server.test.js`

Expected: `FAIL`, ponieważ serwer nie ma jeszcze trasy `/theme-policy.js`.

- [ ] **Step 3: Add the bootstrap script and header control**

W `<head>` umieścić skrypt polityki przed `styles.css`. W prawym obszarze nagłówka dodać:

```html
<div class="app-header__actions">
  <button id="themeToggle" class="theme-toggle" type="button" aria-pressed="false" aria-label="Włącz tryb ciemny">
    <span class="theme-toggle__icon" aria-hidden="true">☾</span>
    <span id="themeToggleLabel">Ciemny</span>
  </button>
  <div id="headerUser" class="header-user" hidden></div>
</div>
```

W `server.js` dodać warunek `url.pathname === "/theme-policy.js"` korzystający z istniejącego `sendFile`.

- [ ] **Step 4: Run the focused tests to verify it passes**

Run: `node --test --test-isolation=none test/server.test.js`

Expected: wszystkie testy serwera przechodzą, w tym nowy test zasobu.

- [ ] **Step 5: Commit**

```bash
git add index.html server.js styles.css test/server.test.js
git commit -m "feat: add global theme toggle"
```

### Task 3: Obsługa przełączania w aplikacji

**Files:**
- Modify: `app.js:1-55, 160-190` — referencja i handler kontrolki
- Modify: `test/theme-policy.test.js` — scenariusze stanu kontrolki i odporności storage

**Interfaces:**
- `app.js` wywołuje `applyTheme`, `saveTheme` i `getThemeToggleState` z `window.MotekThemePolicy`.
- Kliknięcie zmienia tylko `document.documentElement`, localStorage i atrybuty kontrolki; nie wywołuje `setActiveView`, odczytów API ani przeładowania.

- [ ] **Step 1: Implement the handler**

Po istniejących referencjach DOM dodać `themeToggle` i `themeToggleLabel`. Funkcja `renderThemeToggle` ma odczytać bieżący `data-theme`, pobrać stan z polityki i ustawić `aria-pressed`, `aria-label`, tekst oraz ikonę. Handler ma wykonać:

```js
const nextTheme = getThemeToggleState(document.documentElement.dataset.theme).nextTheme;
const appliedTheme = applyTheme(nextTheme);
saveTheme(appliedTheme);
renderThemeToggle();
```

Po podłączeniu handlera wywołać `renderThemeToggle()` raz, także gdy użytkownik jest gościem.

- [ ] **Step 2: Run all tests**

Run: `npm run check`

Expected: 74 istniejące testy oraz nowe testy polityki przechodzą.

- [ ] **Step 3: Commit**

```bash
git add app.js test/theme-policy.test.js
git commit -m "feat: persist theme switching"
```

### Task 4: Tokeny CSS dla Koloroterapii i Nocnego Motka

**Files:**
- Modify: `styles.css` — tokeny bazowe, selektor `[data-theme="dark"]` i kolory stanów

**Interfaces:**
- Wszystkie komponenty używają semantycznych zmiennych: `--bg`, `--bg-deep`, `--panel`, `--panel-soft`, `--text`, `--muted`, `--accent`, `--accent-2`, `--accent-3`, `--good`, `--warning`, `--danger`, `--border`, `--border-active`, `--focus`, `--shadow`, `--on-accent`.
- `:root` lub `[data-theme="light"]` definiuje paletę Color, a `[data-theme="dark"]` definiuje paletę Night. Fallbacki pozostają w jasnej palecie.

- [ ] **Step 1: Write the failing CSS contract test**

W `test/theme-policy.test.js` dodać odczyt pliku `styles.css` i asercje na obecność obu selektorów oraz kluczowych tokenów:

```js
const fs = require("node:fs");
const css = fs.readFileSync(require.resolve("../styles.css"), "utf8");
assert.match(css, /\[data-theme="dark"\]/);
assert.match(css, /--accent:\s*#e94f4b/);
assert.match(css, /--accent:\s*#c39a4b/);
assert.match(css, /--panel-soft/);
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `node --test --test-isolation=none test/theme-policy.test.js`

Expected: `FAIL`, ponieważ arkusz nie ma jeszcze selektora dark i wartości obu palet.

- [ ] **Step 3: Replace direct theme-dependent colors with tokens**

Zachować bieżące układy, promienie, typografię i animacje. Przenieść kolor tła strony, nagłówka, kart, pól, nawigacji, focusu, statusów, skeletonów, komunikatów i strefy ryzyka na tokeny. Dla obu motywów dodać osobne gradienty tła, cień i kontrastowe kolory tekstów. Kolory czysto techniczne (np. biały tekst na akcencie) zastąpić `--on-accent`.

- [ ] **Step 4: Run contract and full checks**

Run: `npm run check`

Expected: kontrakt kolorów i wszystkie testy przechodzą bez zmiany zachowania API.

- [ ] **Step 5: Commit**

```bash
git add styles.css test/theme-policy.test.js
git commit -m "ui: add light and dark theme tokens"
```

### Task 5: Dokumentacja, wersja i weryfikacja wizualna

**Files:**
- Modify: `README.md`, `SPEC.md`, `CHANGELOG.txt`, `VERSION`, `package.json`, `package-lock.json`
- Modify: `docs/superpowers/specs/2026-07-31-motywy-kolorystyczne-design.md` — status implementacji
- Modify: `docs/superpowers/plans/2026-07-31-motywy-kolorystyczne.md` — zaznaczenie wykonanych kroków

- [ ] **Step 1: Update product documentation**

Opisać globalny przełącznik, lokalny klucz `motek-theme-v1`, mapowanie Color/Night i brak synchronizacji z Supabase. Podnieść wersję z `2.0.0-alpha.36` do `2.0.0-alpha.37` we wszystkich plikach wersji oraz w query stringach zasobów w `index.html`.

- [ ] **Step 2: Run static and runtime verification**

Run: `npm run check` oraz `npm run patterns:check`.

Expected: wszystkie testy przechodzą, a kontrola katalogu wykazuje `NEW_RECORDS=0` i nie wykonuje zapisu do Supabase.

- [ ] **Step 3: Run local visual verification**

Uruchomić `npm start`, sprawdzić w przeglądarce:

1. gość widzi przełącznik w nagłówku;
2. jasny start pokazuje paletę Color;
3. klik przełącza na Night bez przeładowania i bez utraty aktywnego widoku;
4. odświeżenie zachowuje wybrany motyw;
5. błędna wartość w localStorage wraca do jasnego;
6. mobilny nagłówek nie wypycha nawigacji poza ekran;
7. formularz logowania i formularz usuwania konta zachowują wartości po zmianie motywu.

- [ ] **Step 4: Commit and publish**

```bash
git add README.md SPEC.md CHANGELOG.txt VERSION package.json package-lock.json index.html docs/superpowers/specs/2026-07-31-motywy-kolorystyczne-design.md docs/superpowers/plans/2026-07-31-motywy-kolorystyczne.md
git commit -m "feat: add light and dark Motek themes"
git push origin feat/frontend-design-refresh
```
