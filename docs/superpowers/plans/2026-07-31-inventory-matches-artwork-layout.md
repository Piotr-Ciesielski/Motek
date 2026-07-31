# Układ grafik Magazynu i Dopasowania Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rozdzielić grafiki motywów między pionowy panel Magazynu i szeroki hero Dopasowania.

**Architecture:** Istniejące dwa pliki PNG pozostają jedynymi assetami. HTML dostanie dwa miejsca prezentacji, a `renderThemeToggle()` będzie aktualizował oba elementy wspólnym stanem motywu. CSS zbuduje układ dwukolumnowy na desktopie i jednokolumnowy na mniejszych ekranach.

**Tech Stack:** Statyczny HTML, CSS, JavaScript, Node.js test runner.

## Global Constraints

- Zachować istniejące `color-yarn-cat.png` i `night-yarn-cat.png`.
- Nie zmieniać API, danych Supabase ani logiki logowania/magazynu.
- Zachować dostępność: `alt`, podpisy i istniejące przyciski.
- Zachować responsywność bez poziomego przewijania.

---

### Task 1: Przenieść miejsca prezentacji grafik w HTML

**Files:**
- Modify: `index.html:188-267`

**Interfaces:**
- Produces elementy `#inventoryThemeImage`, `#inventoryHeroImage`,
  `#inventoryHeroCaption`, `#matchesThemeImage` i `#matchesHeroCaption`.

- [ ] Przenieść pionowy obraz do panelu `inventory-layout__visual` po prawej stronie treści Magazynu.
- [ ] Dodać `matches-hero` nad panelem wyników Dopasowania z obrazem po prawej.
- [ ] Zachować istniejące identyfikatory przycisków i paneli danych.

### Task 2: Rozszerzyć wspólne przełączanie motywu

**Files:**
- Modify: `app.js:49-220`

**Interfaces:**
- Consumes: `data-light-src` i `data-dark-src` na obu elementach `<img>`.
- Produces: aktualizację `src`, `alt` i podpisów po starcie oraz po kliknięciu przełącznika.

- [ ] Dodać referencje do obu nowych miejsc graficznych.
- [ ] Wydzielić lub powtórzyć bezpieczną aktualizację dla elementów obecnych na stronie.
- [ ] Sprawdzić osobno stan jasny i ciemny w DOM.

### Task 3: Dostosować responsywny CSS

**Files:**
- Modify: `styles.css:254-312`, sekcje media queries dotyczące `inventory-hero`

**Interfaces:**
- Produces: pionowy obraz Magazynu po prawej na desktopie, jednokolumnowy układ na ekranach do 960 px i szeroki hero Dopasowania.

- [ ] Zastąpić dotychczasowy wspólny hero układami `inventory-layout` i `matches-hero`.
- [ ] Ustawić obraz Magazynu jako wysoki panel z `object-fit: cover`.
- [ ] Ustawić obraz Dopasowania jako szeroki panel po prawej.
- [ ] Dodać reguły mobilne z obrazem pod treścią i ograniczeniem wysokości.

### Task 4: Zweryfikować i udokumentować zmianę

**Files:**
- Modify: `README.md`, `SPEC.md`, `CHANGELOG.txt`
- Test: `test/server.test.js`

- [ ] Uruchomić `npm run check` i potwierdzić wszystkie testy.
- [ ] Sprawdzić `git diff --check`.
- [ ] Zweryfikować w przeglądarce oba widoki i przełączenie motywu.
- [ ] Opisać rozdzielenie grafik w dokumentacji.
- [ ] Zapisać zmianę jako commit `ui: move theme artwork between views` i wysłać ją na bieżącą gałąź.
