# Zamykanie dropdownu „Materiały” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zamknąć rozwinięty dropdown „Materiały” po kliknięciu pola formularza włóczki poza dropdownem i wdrożyć zmianę wyłącznie na staging.

**Architecture:** Natywny `<details data-material-picker>` pozostaje źródłem stanu otwarcia. Delegowana obsługa kliknięć na kontenerze listy włóczek zamknie picker tylko wtedy, gdy kliknięty cel nie znajduje się wewnątrz pickera. Test DOM pokryje zachowanie pola nazwy i kliknięcia checkboxu.

**Tech Stack:** Vanilla JavaScript, HTML `<details>`, jsdom, Node.js `node:test`, Railway.

## Global Constraints

- Produkcja pozostaje na gałęzi `main` i nie otrzyma tej zmiany.
- Staging pozostaje na gałęzi `staging`.
- Kliknięcie checkboxów materiałów nie zamyka dropdownu.
- Zmiana ustawień ręcznej akceptacji produkcji jest osobną operacją i wymaga osobnej zgody.
- Istniejący nieśledzony katalog `audits/` pozostaje nietknięty.

### Task 1: Test regresyjny dropdownu

**Files:**
- Create: `test/yarn-form-dom.test.js`
- Inspect: `index.html:414-470`, `app.js:1010-1145`

**Interfaces:**
- Consumes: istniejący szablon `#yarnTemplate`, `data-material-picker`, `data-material-option`, `data-field`.
- Produces: dwa testy DOM opisujące zamykanie poza pickerem i pozostawienie otwartego pickera przy checkboxie.

- [ ] **Step 1: Utworzyć test DOM z minimalnym HTML formularza**

  Test załaduje `index.html` do jsdom, skopiuje zawartość `#yarnTemplate` do dokumentu i ustawi `picker.open = true`.

- [ ] **Step 2: Uruchomić test i potwierdzić RED**

  Run: `node --test test/yarn-form-dom.test.js`

  Expected: test zamknięcia pickera zakończy się FAIL, ponieważ obecny kod nie obsługuje kliknięcia poza dropdownem.

### Task 2: Minimalna implementacja zachowania

**Files:**
- Modify: `app.js` w sekcji obsługi zdarzeń formularza włóczki
- Test: `test/yarn-form-dom.test.js`

**Interfaces:**
- Consumes: `yarnList` i dynamiczne karty `.yarn-card`.
- Produces: obsługę kliknięcia zamykającą otwarte `[data-material-picker]` tylko poza pickerem.

- [ ] **Step 1: Dodać delegowaną obsługę kliknięcia**

  Obsługa znajdzie najbliższą kartę `.yarn-card` dla `event.target`. Jeśli cel nie znajduje się w `[data-material-picker]`, ustawi `open = false` dla otwartych pickerów w tej karcie. Nie zmieni stanu pickera dla celów wewnętrznych.

- [ ] **Step 2: Uruchomić testy regresyjne**

  Run: `node --test test/yarn-form-dom.test.js`

  Expected: oba testy PASS.

### Task 3: Pełna weryfikacja i staging

**Files:**
- Verify: `app.js`, `test/yarn-form-dom.test.js`, `package.json`

**Interfaces:**
- Consumes: wynik Task 2.
- Produces: zweryfikowany commit na gałęzi `staging` i działające wdrożenie staging.

- [ ] **Step 1: Uruchomić pełne sprawdzenie projektu**

  Run: `npm run check`

  Expected: exit code 0 i brak nieprzechodzących testów.

- [ ] **Step 2: Sprawdzić diff i zakres plików**

  Run: `git diff --check` oraz `git status --short`.

  Expected: wyłącznie pliki związane z planem; `audits/` pozostaje nieśledzony i nie jest dodany.

- [ ] **Step 3: Zapisać zmianę i wysłać ją na staging**

  Utworzyć focused commit zawierający `app.js` i `test/yarn-form-dom.test.js`, wypchnąć gałąź `staging`, a następnie sprawdzić status wdrożenia Railway dla środowiska `staging Motek`.

- [ ] **Step 4: Zweryfikować staging**

  Sprawdzić `/health/ready` na `https://staging.rysia.org` i potwierdzić, że produkcja nadal wskazuje poprzedni commit.
