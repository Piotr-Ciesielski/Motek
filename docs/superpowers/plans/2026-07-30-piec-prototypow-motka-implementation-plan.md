# Motek — Five Design Directions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować pięć pełnych, klikalnych i responsywnych mini-prototypów przepływu Magazyn → Dopasowanie → Katalog, każdy z odrębnym systemem wizualnym oraz grafikami włóczek i kotów.

**Architecture:** Izolowany prototyp React/Vite powstaje w `prototypes/motek-five-directions` z oficjalnego szablonu Product Design `prototype`. Wspólne dane demonstracyjne, reducer i komponenty funkcjonalne obsługują pięć wariantów wybieranych parametrem `?variant=atelier|nordic|forest|color|night`; konfiguracja wariantu i osobny arkusz CSS zmieniają kompozycję oraz system wizualny bez duplikowania logiki.

**Tech Stack:** React 19.2, Vite 6.4, JavaScript ES modules, CSS, Lucide React, Node test runner, Chrome sterowany przez skill `chrome:control-chrome`, ImageGen.

## Global Constraints

- Prototypy nie modyfikują produkcyjnych `index.html`, `styles.css`, `app.js`, backendu, Supabase ani danych użytkowników.
- Wszystkie dane pozostają w pamięci bieżącej karty; odświeżenie przywraca stan demonstracyjny.
- Każdy wariant zawiera pełne widoki Magazyn, Dopasowanie i Katalog oraz działający przepływ między nimi.
- Każdy wariant ma własną paletę, kontrast, kompozycję, typografię i niezależnie wygenerowaną grafikę.
- Nie używać emoji, rysunków CSS, placeholderów, ręcznie tworzonych SVG ani tekstowych symboli jako widocznych grafik.
- Ikony interfejsu pochodzą z `lucide-react`.
- Weryfikować desktop 1440 × 1024 i telefon 390 × 844 bez poziomego przewijania.
- Kontrast tekstu i głównych akcji ma spełniać co najmniej WCAG AA; fokus klawiatury musi być widoczny.
- Nie wywoływać API Motka; wszystkie formularze, filtry i stany używają realistycznych danych demonstracyjnych.
- Używać wyłącznie Chrome, zgodnie z preferencją użytkownika.
- Nie publikować i nie wdrażać prototypu bez osobnej prośby użytkownika.

---

## File Map

- `prototypes/motek-five-directions/` — samodzielny projekt z szablonu Product Design.
- `prototypes/motek-five-directions/src/App.jsx` — wybór wariantu, stan aplikacji i przełączanie widoków.
- `prototypes/motek-five-directions/src/model/demo-data.mjs` — osiem motków, dwanaście wzorów, opcje filtrów i rekomendacje.
- `prototypes/motek-five-directions/src/model/prototype-state.mjs` — czysty reducer, selektory katalogu i walidacja formularza.
- `prototypes/motek-five-directions/src/variants/variants.mjs` — nazwy, numeracja, teksty i cechy kompozycyjne pięciu kierunków.
- `prototypes/motek-five-directions/src/components/AppShell.jsx` — marka, nawigacja desktopowa i mobilna, nagłówek widoku.
- `prototypes/motek-five-directions/src/components/InventoryView.jsx` — podsumowanie, lista oraz formularz dodawania i edycji motka.
- `prototypes/motek-five-directions/src/components/MatchingView.jsx` — rekomendacje, wyniki procentowe, rozmiary i przejście do katalogu.
- `prototypes/motek-five-directions/src/components/CatalogView.jsx` — wyszukiwanie, filtry, karty wzorów i stan pusty.
- `prototypes/motek-five-directions/src/components/YarnDialog.jsx` — dostępny formularz modalny.
- `prototypes/motek-five-directions/src/components/PatternCard.jsx` — wspólna anatomia karty wzoru.
- `prototypes/motek-five-directions/src/styles/base.css` — reset, typografia użytkowa, fokus, układ współdzielony i responsywność.
- `prototypes/motek-five-directions/src/styles/atelier.css` — redakcyjna kompozycja kremowo-bordowa.
- `prototypes/motek-five-directions/src/styles/nordic.css` — chłodna siatka skandynawska.
- `prototypes/motek-five-directions/src/styles/forest.css` — boczna nawigacja i naturalne warstwy.
- `prototypes/motek-five-directions/src/styles/color.css` — asymetryczne, barwne moduły.
- `prototypes/motek-five-directions/src/styles/night.css` — ciemny, wysoko kontrastowy wariant premium.
- `prototypes/motek-five-directions/public/assets/*.webp` — pięć docelowych grafik wygenerowanych w ImageGen.
- `prototypes/motek-five-directions/design-references/*.png` — źródłowe zrzuty Motka i pięć zaakceptowanych mocków.
- `prototypes/motek-five-directions/tests/prototype-state.test.mjs` — testy reduktora, formularza i filtrów.
- `prototypes/motek-five-directions/tests/project-contract.test.mjs` — kontrola pięciu wariantów, grafik i adresów.
- `prototypes/motek-five-directions/QA.md` — wyniki kontroli widoków, interakcji, konsoli i dostępności.

### Task 1: Capture Source and Generate Five Visual Targets

**Files:**
- Create: `prototypes/motek-five-directions/design-references/current-magazyn.png`
- Create: `prototypes/motek-five-directions/design-references/current-dopasowanie.png`
- Create: `prototypes/motek-five-directions/design-references/current-katalog.png`
- Create: `prototypes/motek-five-directions/design-references/01-atelier.png`
- Create: `prototypes/motek-five-directions/design-references/02-nordic.png`
- Create: `prototypes/motek-five-directions/design-references/03-forest.png`
- Create: `prototypes/motek-five-directions/design-references/04-color.png`
- Create: `prototypes/motek-five-directions/design-references/05-night.png`
- Create: `prototypes/motek-five-directions/public/assets/atelier-yarn-cat.webp`
- Create: `prototypes/motek-five-directions/public/assets/nordic-yarn-cat.webp`
- Create: `prototypes/motek-five-directions/public/assets/forest-yarn-cat.webp`
- Create: `prototypes/motek-five-directions/public/assets/color-yarn-cat.webp`
- Create: `prototypes/motek-five-directions/public/assets/night-yarn-cat.webp`

**Interfaces:**
- Consumes: działający lokalnie Motek i zatwierdzoną specyfikację.
- Produces: pięć mocków jako źródła prawdy dla layoutu oraz pięć obrazów gotowych do osadzenia w interfejsie.

- [ ] **Step 1: Capture the three existing source screens**

W Chrome otwórz aktualny Motek i zapisz zrzuty Magazynu, Dopasowania i Katalogu przy viewportcie 1440 × 1024. Każdy zrzut musi pokazywać pełny nagłówek, nawigację i główną zawartość widoku.

- [ ] **Step 2: Generate the Atelier target and asset**

Wykonaj osobne wywołanie ImageGen z dołączonymi trzema zrzutami źródłowymi:

```text
Redesign the attached Motek knitting inventory app as a complete desktop web-app screen.
Direction 1/5: Atelier. Warm ivory and cream canvas, deep burgundy, dusty rose, editorial
serif headlines, precise neutral sans-serif data, generous margins, textile-catalog
composition. Show the Magazyn view with realistic yarn rows, summary, clear “Dobierz wzór”
CTA and navigation to Dopasowanie and Katalog. Include an elegant photographic composition
of premium yarn, knitted texture and a subtle light-colored cat, but keep data dominant.
Polish copy, 1440x1024, sophisticated and adult, accessible contrast, no mockup frame.
```

W drugim wywołaniu wygeneruj sam obraz do slotu 4:3: jasny kot odpoczywający obok kremowych i bordowych motków na stole w atelier, miękkie naturalne światło, bez tekstu i bez elementów interfejsu.

- [ ] **Step 3: Generate the Nordic target and asset**

Użyj dołączonych zrzutów i promptu:

```text
Direction 2/5: Nordic redesign of the attached Motek app. Snow white, graphite, cool blue
and one restrained red accent; modular Scandinavian grid; geometric sans-serif; crisp
numbers and separators. Show the full Magazyn view and visible navigation to matching and
catalog. Add a studio photograph of yarn and a minimalist calm cat on a pale background.
Polish copy, 1440x1024, refined, quiet, highly legible, no mockup frame.
```

Osobno wygeneruj obraz 4:3: minimalistyczna studyjna scena z grafitowym kotem, błękitnymi i białymi motkami, miękkimi cieniami, bez tekstu.

- [ ] **Step 4: Generate the Forest target and asset**

Użyj dołączonych zrzutów i promptu:

```text
Direction 3/5: Leśna Pracownia redesign of the attached Motek app. Deep forest green,
linen, copper, moss and amber; left sidebar navigation; layered natural surfaces; soft
serif titles and practical sans-serif data. Show a complete yarn inventory and a prominent
matching recommendation entry point. Use a sophisticated storybook-like illustration of a
cat among yarn, leaves and knitted swatches. Polish copy, 1440x1024, artisanal but precise,
accessible contrast, no mockup frame.
```

Osobno wygeneruj ilustrację 4:3 z rudym kotem, motkami, paprocią i próbkami dzianiny, bez tekstu.

- [ ] **Step 5: Generate the Color target and asset**

Użyj dołączonych zrzutów i promptu:

```text
Direction 4/5: Koloroterapia redesign of the attached Motek app. Coral, lavender, cobalt,
apricot and off-white; bold asymmetric modules; contemporary strong typography; joyful
without childishness. Show complete inventory data, an obvious “Dobierz wzór” CTA and
navigation. Include a playful photographic color composition of yarn and a curious cat.
Polish copy, 1440x1024, creative high-end craft brand, accessible text contrast, no frame.
```

Osobno wygeneruj obraz 4:3 z figlarnym kotem pośród koralowych, lawendowych, kobaltowych i morelowych motków, bez tekstu.

- [ ] **Step 6: Generate the Night target and asset**

Użyj dołączonych zrzutów i promptu:

```text
Direction 5/5: Nocny Motek redesign of the attached Motek app. Near-black navy background,
plum, muted gold and sand text; premium high contrast; elegant serif names and precise
sans-serif parameters; dramatic fiber macro photography. Show the complete Magazyn view,
navigation and a luminous matching CTA. Include a black cat visible through rim lighting.
Polish copy, 1440x1024, luxurious and usable, no mockup frame.
```

Osobno wygeneruj obraz 4:3 z czarnym kotem i makrofakturą śliwkowej oraz złotej włóczki w dramatycznym świetle, bez tekstu.

- [ ] **Step 7: Visually review all ten generated files**

Otwórz każdy plik w podglądzie obrazu. Odrzuć wersje z nieczytelnym tekstem, przypadkowymi kończynami kota, widocznym mockupem urządzenia, logotypami innych marek lub kompozycją, której nie da się bezpiecznie wykadrować do 4:3.

- [ ] **Step 8: Commit the visual targets**

```bash
git add prototypes/motek-five-directions/design-references prototypes/motek-five-directions/public/assets
git commit -m "design: add five Motek visual directions"
```

### Task 2: Bootstrap the Product Design Prototype and Lock Its Contract

**Files:**
- Create: `prototypes/motek-five-directions/package.json`
- Create: `prototypes/motek-five-directions/package-lock.json`
- Create: `prototypes/motek-five-directions/index.html`
- Create: `prototypes/motek-five-directions/vite.config.mjs`
- Create: `prototypes/motek-five-directions/worker/index.js`
- Create: `prototypes/motek-five-directions/scripts/prepare-sites-build.mjs`
- Create: `prototypes/motek-five-directions/tests/sites-worker.test.mjs`
- Create: `prototypes/motek-five-directions/tests/project-contract.test.mjs`

**Interfaces:**
- Consumes: oficjalny szablon Product Design `prototype`.
- Produces: projekt uruchamiany przez `npm run dev`, budowany przez `npm run build`, testowany przez `npm test` i `npm run test:sites`.

- [ ] **Step 1: Bootstrap the official template into an otherwise empty directory**

Run:

```powershell
node 'C:\Users\Kisiel\.codex\plugins\cache\openai-curated-remote\product-design\0.1.52\scripts\bootstrap-prototype.mjs' --dest 'D:\Projekty\Motek\.worktrees\motek-five-directions\prototypes\motek-five-directions'
```

Expected: JSON with `"status": "created"` and `"template": "prototype"`.

- [ ] **Step 2: Install template dependencies and Lucide icons**

Run:

```powershell
npm install --prefer-offline --no-audit --no-fund
npm install lucide-react@0.468.0 --save-exact --prefer-offline --no-audit --no-fund
```

Expected: installation completes without changing dependencies outside the prototype directory.

- [ ] **Step 3: Write the failing project contract test**

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("contains five numbered variants and five real assets", () => {
  const variants = readFileSync(new URL("src/variants/variants.mjs", root), "utf8");
  for (const id of ["atelier", "nordic", "forest", "color", "night"]) {
    assert.match(variants, new RegExp(`id: [\"']${id}[\"']`));
    assert.equal(existsSync(new URL(`public/assets/${id}-yarn-cat.webp`, root)), true);
  }
});
```

- [ ] **Step 4: Run the contract test to verify it fails**

Run: `node --test tests/project-contract.test.mjs`

Expected: FAIL because `src/variants/variants.mjs` does not exist.

- [ ] **Step 5: Add the local test script**

Add to `package.json`:

```json
"test": "node --test tests/*.test.mjs"
```

- [ ] **Step 6: Verify the untouched starter still builds**

Run:

```powershell
npm run build
npm run test:sites
```

Expected: both commands pass and `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json` exist.

- [ ] **Step 7: Commit the scaffold**

```bash
git add prototypes/motek-five-directions
git commit -m "build: scaffold Motek design lab"
```

### Task 3: Implement Demo Data and the Pure State Model

**Files:**
- Create: `prototypes/motek-five-directions/src/model/demo-data.mjs`
- Create: `prototypes/motek-five-directions/src/model/prototype-state.mjs`
- Create: `prototypes/motek-five-directions/src/variants/variants.mjs`
- Create: `prototypes/motek-five-directions/tests/prototype-state.test.mjs`
- Modify: `prototypes/motek-five-directions/tests/project-contract.test.mjs`

**Interfaces:**
- Produces: `createInitialState(variantId)`, `prototypeReducer(state, action)`, `selectFilteredPatterns(state)`, `validateYarnDraft(draft)`, `VARIANTS`, `getVariant(id)`.
- State shape: `{ variantId, screen, inventory, patterns, search, filters, dialog, selectedPatternId }`.

- [ ] **Step 1: Write failing reducer and selector tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialState,
  prototypeReducer,
  selectFilteredPatterns,
  validateYarnDraft,
} from "../src/model/prototype-state.mjs";

test("starts with eight yarns and resets on refresh-created state", () => {
  assert.equal(createInitialState("atelier").inventory.length, 8);
});

test("adds and edits yarn only in the current state", () => {
  const initial = createInitialState("nordic");
  const added = prototypeReducer(initial, {
    type: "SAVE_YARN",
    draft: { name: "Malabrigo Rios", color: "Azules", material: "merino", weight: 100, length: 192 },
  });
  assert.equal(added.inventory.length, 9);
  const edited = prototypeReducer(added, {
    type: "SAVE_YARN",
    draft: { ...added.inventory[0], color: "Leśny mech" },
  });
  assert.equal(edited.inventory[0].color, "Leśny mech");
  assert.equal(initial.inventory[0].color === "Leśny mech", false);
});

test("filters catalog and can produce an explainable empty state", () => {
  let state = createInitialState("forest");
  state = prototypeReducer(state, { type: "SET_FILTER", name: "type", value: "skarpetki" });
  state = prototypeReducer(state, { type: "SET_FILTER", name: "thickness", value: "bulky" });
  assert.deepEqual(selectFilteredPatterns(state), []);
  state = prototypeReducer(state, { type: "RESET_FILTERS" });
  assert.equal(selectFilteredPatterns(state).length, 12);
});

test("reports exact missing yarn fields", () => {
  assert.deepEqual(validateYarnDraft({ name: "", weight: 0, length: 0 }), {
    name: "Podaj nazwę włóczki",
    color: "Podaj kolor",
    material: "Wybierz skład",
    weight: "Podaj wagę większą od 0",
    length: "Podaj długość większą od 0",
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because both model modules are missing.

- [ ] **Step 3: Implement exact demo data**

Export `DEMO_YARNS` with eight entries, `DEMO_PATTERNS` with twelve entries, and `MATCHES` with three entries. Each yarn must contain `id`, `name`, `brand`, `color`, `material`, `weight`, `length`, and `thickness`. Each pattern must contain `id`, `name`, `designer`, `type`, `thickness`, `sizes`, `meters`, `match`, and `yarnIds`.

- [ ] **Step 4: Implement the pure state model**

Support these action signatures:

```js
{ type: "NAVIGATE", screen: "inventory" | "matching" | "catalog" }
{ type: "OPEN_YARN_DIALOG", yarnId?: string }
{ type: "CLOSE_YARN_DIALOG" }
{ type: "SAVE_YARN", draft: YarnDraft }
{ type: "SET_SEARCH", value: string }
{ type: "SET_FILTER", name: "type" | "thickness", value: string }
{ type: "RESET_FILTERS" }
{ type: "OPEN_PATTERN", patternId: string }
```

`selectFilteredPatterns` performs case-insensitive search over `name` and `designer`, then applies both filters. `SAVE_YARN` assigns `crypto.randomUUID()` only for a new item.

- [ ] **Step 5: Define five numbered variant records**

```js
export const VARIANTS = [
  { id: "atelier", number: 1, name: "Atelier", layout: "editorial", asset: "/assets/atelier-yarn-cat.webp" },
  { id: "nordic", number: 2, name: "Nordic", layout: "grid", asset: "/assets/nordic-yarn-cat.webp" },
  { id: "forest", number: 3, name: "Leśna Pracownia", layout: "sidebar", asset: "/assets/forest-yarn-cat.webp" },
  { id: "color", number: 4, name: "Koloroterapia", layout: "asymmetric", asset: "/assets/color-yarn-cat.webp" },
  { id: "night", number: 5, name: "Nocny Motek", layout: "dark", asset: "/assets/night-yarn-cat.webp" },
];
```

`getVariant(id)` returns the matching record and falls back to Atelier.

- [ ] **Step 6: Run tests and verify the contract passes**

Run: `npm test`

Expected: PASS for reducer, validation, filtering and all five asset references.

- [ ] **Step 7: Commit the model**

```bash
git add prototypes/motek-five-directions/src/model prototypes/motek-five-directions/src/variants prototypes/motek-five-directions/tests
git commit -m "feat: add shared Motek prototype data model"
```

### Task 4: Build the Shared Shell and Navigation

**Files:**
- Modify: `prototypes/motek-five-directions/src/App.jsx`
- Modify: `prototypes/motek-five-directions/src/main.jsx`
- Create: `prototypes/motek-five-directions/src/components/AppShell.jsx`
- Create: `prototypes/motek-five-directions/src/styles/base.css`
- Modify: `prototypes/motek-five-directions/src/styles.css`
- Modify: `prototypes/motek-five-directions/tests/project-contract.test.mjs`

**Interfaces:**
- Consumes: `createInitialState`, `prototypeReducer`, `getVariant`.
- Produces: `AppShell({ variant, screen, onNavigate, children })` and URLs `?variant=<id>`.

- [ ] **Step 1: Extend the contract test for URLs and titles**

Add assertions that `App.jsx` reads `new URLSearchParams(window.location.search).get("variant")` and sets:

```js
document.title = `${variant.number} — ${variant.name} — Motek`;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `App.jsx` does not yet contain the variant contract.

- [ ] **Step 3: Implement variant selection and state ownership**

`App` must create state exactly once with:

```js
const variantId = new URLSearchParams(window.location.search).get("variant") || "atelier";
const variant = getVariant(variantId);
const [state, dispatch] = useReducer(prototypeReducer, variant.id, createInitialState);
```

Render `InventoryView`, `MatchingView` or `CatalogView` according to `state.screen`.

- [ ] **Step 4: Implement accessible shared navigation**

Use `nav aria-label="Główna nawigacja"` with three buttons: `Magazyn`, `Dopasowanie`, `Katalog`. Active button receives `aria-current="page"`. Mobile navigation uses the same labels and Lucide icons `PackageOpen`, `Sparkles`, `BookOpen`.

- [ ] **Step 5: Add the shared base CSS**

Define shared tokens for type scale, spacing, focus ring, 44px minimum interactive height, content width and breakpoint `760px`. Add:

```css
:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
img { display: block; max-width: 100%; }
button, input, select { font: inherit; }
@media (max-width: 760px) { .desktop-nav { display: none; } .mobile-nav { display: grid; } }
```

- [ ] **Step 6: Run tests and build**

Run:

```powershell
npm test
npm run build
```

Expected: PASS; opening each of the five query URLs produces a correctly numbered browser title.

- [ ] **Step 7: Commit the shell**

```bash
git add prototypes/motek-five-directions/src prototypes/motek-five-directions/tests
git commit -m "feat: add shared navigation for Motek prototypes"
```

### Task 5: Implement Inventory and Yarn Editing

**Files:**
- Create: `prototypes/motek-five-directions/src/components/InventoryView.jsx`
- Create: `prototypes/motek-five-directions/src/components/YarnDialog.jsx`
- Modify: `prototypes/motek-five-directions/src/App.jsx`
- Modify: `prototypes/motek-five-directions/src/styles/base.css`

**Interfaces:**
- Consumes: `state.inventory`, `validateYarnDraft`, reducer actions `OPEN_YARN_DIALOG`, `CLOSE_YARN_DIALOG`, `SAVE_YARN`, `NAVIGATE`.
- Produces: working add/edit flow and “Dobierz wzór” navigation.

- [ ] **Step 1: Add a failing reducer regression for closing after save**

Test that successful `SAVE_YARN` returns `dialog: { open: false, yarnId: null }` and invalid drafts are rejected by `validateYarnDraft`.

- [ ] **Step 2: Run the regression test to verify it fails**

Run: `npm test`

Expected: FAIL until reducer closes the dialog after successful save.

- [ ] **Step 3: Implement the inventory summary and list**

Show eight yarn entries with name, brand, color, material, thickness, grams and meters. Summary displays total skeins, total grams and number of colors. Each row has an `Edytuj` button with `Pencil` icon.

- [ ] **Step 4: Implement the accessible yarn dialog**

Use `<dialog>` with heading `Dodaj włóczkę` or `Edytuj włóczkę`, labelled inputs, inline errors from `validateYarnDraft`, `Anuluj` and `Zapisz`. On open, focus the first input; Escape and `Anuluj` close without saving.

- [ ] **Step 5: Wire the primary action**

`Dobierz wzór` dispatches `{ type: "NAVIGATE", screen: "matching" }`. A successful add increases summary values immediately; editing replaces the matching record without changing list length.

- [ ] **Step 6: Verify tests and keyboard behavior**

Run: `npm test`. In Chrome verify Tab order, visible focus, Escape closing, one validation error, successful add and successful edit.

- [ ] **Step 7: Commit inventory interactions**

```bash
git add prototypes/motek-five-directions/src prototypes/motek-five-directions/tests
git commit -m "feat: add interactive yarn inventory prototype"
```

### Task 6: Implement Matching and Catalog Flows

**Files:**
- Create: `prototypes/motek-five-directions/src/components/MatchingView.jsx`
- Create: `prototypes/motek-five-directions/src/components/CatalogView.jsx`
- Create: `prototypes/motek-five-directions/src/components/PatternCard.jsx`
- Modify: `prototypes/motek-five-directions/src/App.jsx`
- Modify: `prototypes/motek-five-directions/src/styles/base.css`
- Modify: `prototypes/motek-five-directions/tests/prototype-state.test.mjs`

**Interfaces:**
- Consumes: `MATCHES`, `selectFilteredPatterns`, search/filter reducer actions.
- Produces: recommendation cards, catalog search, type/thickness filters, pattern details and empty-state reset.

- [ ] **Step 1: Add failing tests for catalog navigation**

Test that `OPEN_PATTERN` sets `screen: "catalog"` and `selectedPatternId`, and `RESET_FILTERS` clears `search`, `type` and `thickness`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL on the two missing state transitions.

- [ ] **Step 3: Implement the matching view**

Render three recommendations sorted by `match` descending. Each card shows `100%`, `92%` or `84%`, required meters, usable yarns, size chips and `Zobacz w katalogu`. Add an explicit no-match block that appears when inventory is empty and links back to Magazyn.

- [ ] **Step 4: Implement catalog filters**

Search input label: `Szukaj po nazwie lub projektantce`. Selects: `Typ projektu` and `Grubość włóczki`. Show a live result count. Filtering `skarpetki` plus `bulky` must render zero cards.

- [ ] **Step 5: Implement the empty state and pattern focus**

Empty state text: `Te filtry nie pasują do żadnego wzoru.` Button `Wyczyść filtry` dispatches `RESET_FILTERS`. `OPEN_PATTERN` scrolls the selected card into view and applies a temporary highlight class without opening a new route.

- [ ] **Step 6: Run tests and inspect the complete flow**

Run: `npm test`. In Chrome verify Magazyn → Dopasowanie → selected Katalog card, search, two-filter empty state and filter reset.

- [ ] **Step 7: Commit the complete flow**

```bash
git add prototypes/motek-five-directions/src prototypes/motek-five-directions/tests
git commit -m "feat: complete Motek matching and catalog flows"
```

### Task 7: Implement Atelier and Nordic Visual Systems

**Files:**
- Create: `prototypes/motek-five-directions/src/styles/atelier.css`
- Create: `prototypes/motek-five-directions/src/styles/nordic.css`
- Modify: `prototypes/motek-five-directions/src/styles.css`
- Modify: `prototypes/motek-five-directions/src/components/AppShell.jsx`
- Modify: `prototypes/motek-five-directions/src/components/InventoryView.jsx`

**Interfaces:**
- Consumes: variant class `theme-atelier` or `theme-nordic` and their generated target/asset.
- Produces: two visibly distinct layouts using the same components and interactions.

- [ ] **Step 1: Import both theme sheets**

`src/styles.css` imports `base.css`, then both new theme sheets. `AppShell` root class is `app theme-${variant.id} layout-${variant.layout}`.

- [ ] **Step 2: Match Atelier to its target**

Use palette `#F6F0E6`, `#FFFDFC`, `#6B1834`, `#B66A7C`, `#241A1D`; serif headings via `"Fraunces", Georgia, serif`; 4:3 hero crop; wide editorial whitespace; fine burgundy rules. Inventory reads like a textile catalog rather than a dashboard.

- [ ] **Step 3: Match Nordic to its target**

Use palette `#F8FAFB`, `#FFFFFF`, `#20252B`, `#C9DDEA`, `#C8463A`; sans-serif stack `Inter, ui-sans-serif, system-ui`; strict 12-column grid; square corners except 8px controls; crisp 1px separators and compact metadata.

- [ ] **Step 4: Compare target and implementation at 1440 × 1024**

For each variant capture a Chrome screenshot and compare it side-by-side with `01-atelier.png` or `02-nordic.png`. Fix visible differences in hierarchy, crop, spacing, font weight, border and radius before continuing.

- [ ] **Step 5: Verify shared interactions remain intact**

Run `npm test` and manually add a yarn, navigate to a match, force the catalog empty state, and reset filters in both themes.

- [ ] **Step 6: Commit both themes**

```bash
git add prototypes/motek-five-directions/src
git commit -m "ui: add Atelier and Nordic Motek themes"
```

### Task 8: Implement Forest, Color and Night Visual Systems

**Files:**
- Create: `prototypes/motek-five-directions/src/styles/forest.css`
- Create: `prototypes/motek-five-directions/src/styles/color.css`
- Create: `prototypes/motek-five-directions/src/styles/night.css`
- Modify: `prototypes/motek-five-directions/src/styles.css`
- Modify: `prototypes/motek-five-directions/src/components/AppShell.jsx`
- Modify: `prototypes/motek-five-directions/src/components/PatternCard.jsx`

**Interfaces:**
- Consumes: variant classes and generated targets/assets.
- Produces: three additional distinct, complete visual systems.

- [ ] **Step 1: Implement Leśna Pracownia**

Use palette `#173F35`, `#F1E8D6`, `#A95838`, `#74885E`, `#D99A3D`; persistent desktop sidebar; layered linen-colored panels; serif headings; illustrated asset integrated beside summary. Keep data panels on solid backgrounds.

- [ ] **Step 2: Implement Koloroterapia**

Use palette `#F36F62`, `#A88BE8`, `#2458D8`, `#F5B36A`, `#FFF8EE`; asymmetric grid with varied card spans; bold sans-serif headings; deliberately offset asset panel. Never place body text directly on coral or lavender unless contrast passes AA.

- [ ] **Step 3: Implement Nocny Motek**

Use palette `#0B1020`, `#21142E`, `#C59A4A`, `#E9DCC8`, `#F7F0E5`; subtle borders rather than shadows; serif pattern names; luminous gold match score; dark asset with visible rim-lit cat. Inputs remain light enough to be immediately identifiable.

- [ ] **Step 4: Compare all three implementations with their targets**

Capture at 1440 × 1024 and compare each screenshot side-by-side with `03-forest.png`, `04-color.png` or `05-night.png`. Fix image crop, layout balance, typography and contrast mismatches.

- [ ] **Step 5: Re-run the core interaction path in all three themes**

Verify add/edit yarn, navigation, matching-to-catalog transition, filters, empty state and reset. Check the Chrome console after each variant; expected: no errors or warnings caused by the prototype.

- [ ] **Step 6: Commit the remaining themes**

```bash
git add prototypes/motek-five-directions/src
git commit -m "ui: add Forest Color and Night Motek themes"
```

### Task 9: Responsive and Accessibility Pass

**Files:**
- Modify: `prototypes/motek-five-directions/src/styles/base.css`
- Modify: `prototypes/motek-five-directions/src/styles/atelier.css`
- Modify: `prototypes/motek-five-directions/src/styles/nordic.css`
- Modify: `prototypes/motek-five-directions/src/styles/forest.css`
- Modify: `prototypes/motek-five-directions/src/styles/color.css`
- Modify: `prototypes/motek-five-directions/src/styles/night.css`
- Modify: `prototypes/motek-five-directions/src/components/YarnDialog.jsx`
- Create: `prototypes/motek-five-directions/QA.md`

**Interfaces:**
- Consumes: all five completed themes and core interactions.
- Produces: five usable desktop/mobile variants and a written verification record.

- [ ] **Step 1: Test each variant at 390 × 844**

Check five URLs in Chrome device viewport. Record overflow with:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Expected: `true` for every view and variant.

- [ ] **Step 2: Fix mobile composition**

At `max-width: 760px`, convert all content to one column, use fixed bottom navigation, preserve at least 16px side padding, stack filters, make dialogs fit inside the viewport and give content enough bottom padding to clear navigation.

- [ ] **Step 3: Check keyboard and semantics**

Verify one logical H1 per view, labelled form fields, `aria-current`, dialog labelling, image alt text, visible focus, Escape behavior and 44px minimum targets.

- [ ] **Step 4: Check contrast**

Measure text/background and primary action pairs in every theme. Record ratios in `QA.md`; each normal text pair must be at least 4.5:1 and each large text pair at least 3:1. Change theme tokens when a pair fails.

- [ ] **Step 5: Test long content**

Replace one pattern name in dev tools with `Kardigan z raglanem i warkoczowym panelem na chłodne wieczory`. Verify cards grow vertically without clipping, overlapping actions or horizontal scroll.

- [ ] **Step 6: Run automated checks**

Run:

```powershell
npm test
npm run build
npm run test:sites
```

Expected: all pass.

- [ ] **Step 7: Commit responsive and accessibility fixes**

```bash
git add prototypes/motek-five-directions
git commit -m "fix: polish responsive and accessible Motek prototypes"
```

### Task 10: Final Browser Verification and Five-Tab Handoff

**Files:**
- Modify: `prototypes/motek-five-directions/QA.md`

**Interfaces:**
- Consumes: verified production build and Chrome.
- Produces: five numbered tabs and final evidence that every requested flow works.

- [ ] **Step 1: Start one local preview server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite reports one local URL. Keep the process running through final QA and handoff.

- [ ] **Step 2: Open five separate Chrome tabs**

Open:

```text
?variant=atelier
?variant=nordic
?variant=forest
?variant=color
?variant=night
```

Expected tab titles:

```text
1 — Atelier — Motek
2 — Nordic — Motek
3 — Leśna Pracownia — Motek
4 — Koloroterapia — Motek
5 — Nocny Motek — Motek
```

- [ ] **Step 3: Run a full smoke path in every tab**

In each tab: add a yarn, edit the first yarn, open Dopasowanie, open the 100% recommendation in Katalog, set `skarpetki` + `bulky`, verify empty state, clear filters, return to Magazyn.

- [ ] **Step 4: Capture final desktop and mobile screenshots**

Store ten final screenshots in `design-references/final/` using names `01-atelier-desktop.png` through `05-night-mobile.png`.

- [ ] **Step 5: Compare final screenshots against visual targets**

For each variant, inspect the target and final screenshot together. Fix any remaining broken crop, spacing, typography, radius, border or contrast difference; then repeat the comparison for that variant.

- [ ] **Step 6: Run final verification from a clean state**

Run:

```powershell
npm test
npm run build
npm run test:sites
git diff --check
git status --short
```

Expected: tests and build pass; only intended final screenshots or QA notes remain uncommitted.

- [ ] **Step 7: Commit final evidence**

```bash
git add prototypes/motek-five-directions/design-references/final prototypes/motek-five-directions/QA.md
git commit -m "test: verify five Motek design prototypes"
```

- [ ] **Step 8: Keep the five numbered Chrome tabs open**

Do not close or replace the five tabs after final verification. Report the isolated branch, passing checks and that no production Motek files were modified.
