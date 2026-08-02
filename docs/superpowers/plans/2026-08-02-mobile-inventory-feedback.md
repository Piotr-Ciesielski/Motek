# Mobile Inventory and Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Naprawić nakładanie elementów magazynu na tabletach i telefonach oraz uczynić stan zapisu i aktualność dopasowań jednoznacznymi.

**Architecture:** Układ magazynu otrzyma jawne obszary CSS grid współdzielone przez desktop i breakpointy. Czyste funkcje w `client-policy.js` będą obliczać komunikat kompletności formularza i stan aktualności dopasowania, a `app.js` ograniczy się do połączenia ich z DOM i istniejącymi operacjami API.

**Tech Stack:** HTML, CSS Grid, vanilla JavaScript, Node.js `node:test`.

## Global Constraints

- Kolejność mobile/tablet: nagłówek, onboarding, statystyki, lista, grafika.
- Desktop zachowuje dwie kolumny i kadrowanie `object-fit: cover; object-position: right center`.
- Nie zmieniać palety kolorów, kontrastu ani zachowań wyłącznie accessibility.
- Nie ponawiać automatycznie zapisów zmieniających dane.
- Poprzednie wyniki dopasowania pozostają widoczne po zmianie magazynu.
- Nie stage'ować niezwiązanych, istniejących zmian dokumentacyjnych.

---

### Task 1: Jawny układ magazynu na wszystkich breakpointach

**Files:**
- Modify: `test/design-layout.test.js`
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Consumes: istniejące elementy `.inventory-heading`, `#onboarding`, `#inventoryStats`, sekcję listy i `.inventory-layout__visual`.
- Produces: obszary `heading`, `onboarding`, `stats`, `stock`, `visual`.

- [ ] **Step 1: Napisać test regresyjny CSS**

```js
test("mobile inventory orders stats before stock and artwork", () => {
  assert.match(indexHtml, /class="inventory-stock"/);
  assert.match(stylesCss, /grid-template-areas:[\s\S]*"heading visual"[\s\S]*"stats visual"[\s\S]*"stock visual"/);
  assert.match(stylesCss, /@media \(max-width: 980px\)[\s\S]*grid-template-areas:[\s\S]*"heading"[\s\S]*"onboarding"[\s\S]*"stats"[\s\S]*"stock"[\s\S]*"visual"/);
  assert.doesNotMatch(stylesCss, /inventory-layout__content > section:not\(#onboarding\)[\s\S]{0,120}grid-row: 4/);
});
```

- [ ] **Step 2: Uruchomić RED**

Run: `node --test test/design-layout.test.js`

Expected: FAIL, ponieważ sekcja listy nie ma klasy `inventory-stock`, a breakpoint używa konfliktujących `grid-row`.

- [ ] **Step 3: Nazwać sekcję listy**

W `index.html` zmienić otwarcie sekcji zawierającej nagłówek „Twój zapas” na:

```html
<section class="inventory-stock">
```

- [ ] **Step 4: Wprowadzić obszary desktopowe**

W końcowej sekcji stylów magazynu ustawić:

```css
#inventoryView .inventory-layout {
  grid-template-areas:
    "heading visual"
    "onboarding visual"
    "stats visual"
    "stock visual";
  grid-template-columns: minmax(0, 1fr) minmax(400px, 0.56fr);
  grid-template-rows: auto auto auto minmax(600px, auto);
}

#inventoryView .inventory-heading { grid-area: heading; }
#inventoryView #onboarding { grid-area: onboarding; }
#inventoryView .inventory-stats { grid-area: stats; }
#inventoryView .inventory-stock { grid-area: stock; min-width: 0; }
#inventoryView .inventory-layout__visual { grid-area: visual; }
```

Usunąć konfliktujące deklaracje `grid-column` i ogólny selektor `section:not(#onboarding)`.

- [ ] **Step 5: Wprowadzić kolejność tablet/mobile**

W `@media (max-width: 980px)` ustawić jeden słupek i obszary:

```css
#inventoryView .inventory-layout {
  grid-template-areas:
    "heading"
    "onboarding"
    "stats"
    "stock"
    "visual";
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto;
}
```

Usunąć ręczne `grid-row` z nagłówka, grafiki, statystyk i listy. Zachować wysokości grafiki 380 px dla tabletu i 300 px dla telefonu.

- [ ] **Step 6: Uruchomić GREEN i pełne testy**

Run: `node --test test/design-layout.test.js`

Run: `npm run check`

Expected: wszystkie testy PASS.

- [ ] **Step 7: Sprawdzić widoki 390, 768 i 1440 px**

Uruchomić aplikację lokalnie i wykonać screenshoty kontrolne. Potwierdzić brak nakładania, kolejność oraz niezmieniony desktop. Nie aktualizować audytu bez faktycznego obejrzenia wszystkich trzech rozmiarów.

- [ ] **Step 8: Zapisać checkpoint**

```powershell
git add index.html styles.css test/design-layout.test.js
git commit -m "ui: fix mobile inventory flow"
git push origin docs/update-project-documentation
```

### Task 2: Widoczny powód blokady zapisu

**Files:**
- Modify: `client-policy.js`
- Modify: `test/client-policy.test.js`
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: szkic `{ name, color, materials, weightClass, length, weight }`.
- Produces: `getYarnSaveHint({ yarn, isEditing, isNew, changed, busy }): { visible, disabled, message }`.

- [ ] **Step 1: Napisać test czystej polityki**

```js
test("wyjaśnia brakujące dane zamiast ukrywać zapis", () => {
  assert.deepEqual(
    getYarnSaveHint({
      yarn: { name: "", color: "", materials: [] },
      isEditing: true,
      isNew: true,
      changed: true,
      busy: false,
    }),
    {
      visible: true,
      disabled: true,
      message: "Uzupełnij: nazwę, kolor i materiał.",
    },
  );
});
```

Dodać przypadki kompletnego nowego motka, niezmienionego istniejącego motka oraz stanu `busy`.

- [ ] **Step 2: Uruchomić RED**

Run: `node --test test/client-policy.test.js`

Expected: FAIL, `getYarnSaveHint is not a function`.

- [ ] **Step 3: Zaimplementować minimalną funkcję**

W `client-policy.js` dodać mapowanie braków i eksport `getYarnSaveHint`. Funkcja nie korzysta z DOM i zwraca komunikat `Zapisywanie…` dla `busy` oraz `Brak nowych zmian.` dla istniejącego, niezmienionego motka.

- [ ] **Step 4: Uruchomić GREEN polityki**

Run: `node --test test/client-policy.test.js`

Expected: PASS.

- [ ] **Step 5: Dodać miejsce komunikatu w szablonie**

Bezpośrednio przed `.yarn-card__actions` zawierającym zapis dodać:

```html
<p class="yarn-save-hint" data-save-hint></p>
```

- [ ] **Step 6: Połączyć politykę z kartą**

W `updateYarnSaveButton(card)` pobrać szkic, wywołać `getYarnSaveHint`, pozostawić przycisk widoczny podczas edycji, ustawić `disabled` i tekst `[data-save-hint]`. Dodać `card.dataset.busy` i pomocnicze `setYarnCardBusy(card, busy)` zmieniające tekst przycisku na `Zapisywanie…` bez ukrywania go.

- [ ] **Step 7: Użyć stanu busy we wszystkich ścieżkach zapisu**

W `saveNewYarn` i `saveExistingYarn` ustawić busy przed API i wyczyścić go w `finally`. Zachować istniejące rozgałęzienia konfliktu, niepewnego zapisu i zwykłego błędu.

- [ ] **Step 8: Sprawdzić testy i składnię**

Run: `node --test test/client-policy.test.js test/design-layout.test.js`

Run: `node --check app.js`

Expected: PASS.

- [ ] **Step 9: Zapisać checkpoint**

```powershell
git add client-policy.js test/client-policy.test.js index.html app.js styles.css
git commit -m "ux: explain yarn save state"
git push origin docs/update-project-documentation
```

### Task 3: Nieaktualne dopasowania po zmianie magazynu

**Files:**
- Modify: `client-policy.js`
- Modify: `test/client-policy.test.js`
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `{ hasCalculatedMatches: boolean, inventoryChanged: boolean }`.
- Produces: `getMatchFreshnessState(input): { stale, message }` oraz region `#matchFreshnessNotice`.

- [ ] **Step 1: Napisać test stanu aktualności**

```js
test("oznacza wcześniejsze dopasowanie jako nieaktualne po zapisie", () => {
  assert.deepEqual(
    getMatchFreshnessState({ hasCalculatedMatches: true, inventoryChanged: true }),
    {
      stale: true,
      message: "Wyniki są nieaktualne po zmianie magazynu.",
    },
  );
  assert.equal(
    getMatchFreshnessState({ hasCalculatedMatches: false, inventoryChanged: true }).stale,
    false,
  );
});
```

- [ ] **Step 2: Uruchomić RED**

Run: `node --test test/client-policy.test.js`

Expected: FAIL, brak eksportu.

- [ ] **Step 3: Zaimplementować i wyeksportować politykę**

Funkcja zwraca `stale: true` tylko gdy istnieje zakończone obliczenie i magazyn został później zmieniony.

- [ ] **Step 4: Uruchomić GREEN**

Run: `node --test test/client-policy.test.js`

Expected: PASS.

- [ ] **Step 5: Dodać osobny region nad wynikami**

W `index.html` nad `#results` dodać:

```html
<div id="matchFreshnessNotice" class="match-freshness" hidden>
  <span>Wyniki są nieaktualne po zmianie magazynu.</span>
  <button id="refreshStaleMatchesBtn" class="button button--ghost" type="button">
    Oblicz ponownie
  </button>
</div>
```

- [ ] **Step 6: Zarządzać stanem bez usuwania wyników**

W `app.js` dodać `hasCalculatedMatches` i `inventoryChangedSinceMatch`. Po zakończonym `renderResults()` ustawić pierwszy stan na `true`, drugi na `false` i ukryć notice. Po potwierdzonym dodaniu, zmianie lub usunięciu motka ustawić `inventoryChangedSinceMatch = true` i odświeżyć notice, pozostawiając `#results` bez zmian.

- [ ] **Step 7: Podłączyć ponowne obliczenie**

Kliknięcie `#refreshStaleMatchesBtn` wywołuje `findBtn.click()`. Podczas obliczania przycisk jest nieaktywny; po sukcesie notice znika.

- [ ] **Step 8: Uruchomić pełne testy i ręczny przepływ**

Run: `npm run check`

Ręcznie: obliczyć dopasowanie, zmienić motek, potwierdzić zachowanie kart oraz notice, kliknąć `Oblicz ponownie` i potwierdzić zniknięcie notice.

- [ ] **Step 9: Zapisać checkpoint**

```powershell
git add client-policy.js test/client-policy.test.js index.html app.js styles.css
git commit -m "ux: mark matching results as stale"
git push origin docs/update-project-documentation
```

### Task 4: Dokumentacja i końcowa kontrola pakietu UX

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `CHANGELOG.txt`
- Modify: `docs/UX-UI-ROADMAP.md`

**Interfaces:**
- Consumes: zweryfikowany układ oraz komunikaty.
- Produces: aktualny opis zachowania bez oznaczania kontrastu/accessibility jako wykonanych.

- [ ] **Step 1: Opisać poprawki**

Dodać wpis `alpha.38` lub kolejny wpis roboczy opisujący pionowy mobile flow, widoczny stan zapisu i nieaktualne wyniki. Nie wpisywać zmian kontrastu ani accessibility.

- [ ] **Step 2: Uruchomić kontrolę końcową**

Run: `npm run check`

Run: `git diff --check`

Expected: PASS, 0 failures, brak whitespace errors.

- [ ] **Step 3: Zapisać dokumentację**

```powershell
git add README.md SPEC.md CHANGELOG.txt docs/UX-UI-ROADMAP.md
git commit -m "docs: record mobile inventory feedback"
git push origin docs/update-project-documentation
```
