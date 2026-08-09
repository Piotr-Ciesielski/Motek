# Legal Page and Acceptance UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Udostępnić czytelną stronę informacji prawnych, notę copyright, świadomą akceptację przy rejestracji i ekran ponownej akceptacji bez utraty możliwości wylogowania lub usunięcia konta.

**Architecture:** Osobna statyczna strona `/informacje-prawne` renderuje strukturalny `CURRENT_LEGAL_DOCUMENT` bez `innerHTML`. Mały kontroler odpowiada wyłącznie za stan ponownej akceptacji, a `app.js` integruje wynik sesji z istniejącymi czterema widokami SPA. Serwer pozostaje ostateczną bramką; UI jedynie odzwierciedla stan i zapobiega zbędnym żądaniom.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript UMD/CommonJS, JSDOM, Node.js 24 `node:test`, istniejący serwer statyczny Motka.

## Global Constraints

- Ten plan wykonuje się po planie gotowości prawnej i planie zaproszeń/akceptacji.
- Strona zawiera trzy sekcje: regulamin, prywatność, prawa autorskie i katalog wzorów.
- Informacja prywatności jest przekazywana użytkownikowi, ale nie jest przedstawiana jako zgoda będąca podstawą całego przetwarzania.
- Checkbox regulaminu jest wymagany, niezaznaczony domyślnie i wskazuje bieżącą wersję.
- Nota ma brzmieć `© 2026 Motek — [IMIĘ I NAZWISKO OPERATORA]. Wszelkie prawa zastrzeżone.` w wersji roboczej.
- Produkcyjna bramka z wcześniejszego planu blokuje publikację placeholderów.
- Ekran akceptacji pozostaje częścią widoku konta; liczba `data-view` nadal wynosi cztery.
- Bez aktualnej akceptacji dostępne są tylko informacje prawne, akceptacja, wylogowanie i usunięcie konta.
- Nie używać `innerHTML` do renderowania treści dokumentu.
- Nie nadpisywać niezwiązanych zmian użytkownika.

---

### Task 1: Bezpieczny renderer dokumentu prawnego

**Files:**
- Create: `client/legal-page.js`
- Create: `test/legal-page.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `CURRENT_LEGAL_DOCUMENT` z `legal-document.js`.
- Produces: `renderLegalDocument(documentRoot, legalDocument)` i `initializeLegalPage(options)`.

- [ ] **Step 1: Napisać failing test JSDOM**

```js
test("renderer tworzy spis treści i trzy sekcje bez innerHTML", () => {
  const dom = new JSDOM(`<main id="legalDocument"><nav id="legalToc"></nav><article id="legalArticle"></article></main>`);
  renderLegalDocument(dom.window.document, CURRENT_LEGAL_DOCUMENT);
  assert.equal(dom.window.document.querySelectorAll("#legalToc a").length, 3);
  assert.deepEqual(
    [...dom.window.document.querySelectorAll(".legal-section")].map((node) => node.id),
    ["regulamin", "prywatnosc", "prawa-autorskie"],
  );
  assert.equal(dom.window.document.querySelector("script"), null);
});
```

Dodać test, który umieszcza `<img src=x onerror=alert(1)>` w `text` i potwierdza wyświetlenie jako zwykłego tekstu.

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/legal-page.test.js`

Expected: FAIL z brakiem modułu.

- [ ] **Step 3: Zaimplementować renderer przez DOM API**

Obsłużyć bloki:

```js
const BLOCK_RENDERERS = {
  paragraph(documentRoot, block) {
    const paragraph = documentRoot.createElement("p");
    paragraph.textContent = block.text;
    return paragraph;
  },
  list(documentRoot, block) {
    const list = documentRoot.createElement("ul");
    for (const item of block.items) {
      const row = documentRoot.createElement("li");
      row.textContent = item;
      list.append(row);
    }
    return list;
  },
};
```

Renderer tworzy metadane wersji i daty, TOC, nagłówki `h2`, historię oraz copyright. Nie czyta stanu Auth.

- [ ] **Step 4: Uruchomić GREEN i kontrolę składni**

Run: `node --check client/legal-page.js`; `node --test test/legal-page.test.js`

Expected: PASS.

- [ ] **Step 5: Utworzyć checkpoint zadania**

```powershell
git add client/legal-page.js test/legal-page.test.js package.json
git commit -m "feat: render legal document safely"
```

### Task 2: Publiczna strona i trasa statyczna

**Files:**
- Create: `informacje-prawne.html`
- Modify: `server.js`
- Modify: `test/static-files.test.js`
- Modify: `scripts/regression/public-suite.js`
- Modify: `test/regression-public-suite.test.js`

**Interfaces:**
- Produces: `GET /informacje-prawne` i `/informacje-prawne/` status 200.
- Loads: `styles.css`, `theme-policy.js`, `legal-document.js`, `client/legal-page.js`.

- [ ] **Step 1: Napisać failing test allowlisty**

Test serwera ma oczekiwać 200 dla obu wariantów ścieżki oraz MIME `text/html; charset=utf-8`. Test publicznej regresji oczekuje markera `data-legal-document`, trzech kotwic i bieżącej wersji. Istniejące anonimowe żądanie `/api/patterns` należy zmienić tak, aby oczekiwało 401; katalog nie jest już publiczną częścią regresji.

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/static-files.test.js test/regression-public-suite.test.js`

Expected: FAIL z 404.

- [ ] **Step 3: Utworzyć semantyczny dokument HTML**

Strona ma zawierać `skip-link`, nagłówek z linkiem do `/`, przełącznik motywu, `<main id="legalDocument" data-legal-document>`, `<nav id="legalToc" aria-label="Spis treści">`, `<article id="legalArticle">` i link powrotu. Nie ładuje `app.js`, Auth ani CAPTCHA.

- [ ] **Step 4: Dodać jawne ścieżki statyczne**

W mapie `server.js` dodać:

```js
"/informacje-prawne": "informacje-prawne.html",
"/informacje-prawne/": "informacje-prawne.html",
"/legal-document.js": "legal-document.js",
"/client/legal-page.js": "client/legal-page.js",
```

- [ ] **Step 5: Rozszerzyć publiczną regresję**

Suite pobiera stronę, sprawdza status, nagłówki bezpieczeństwa, marker, kotwice i `termsVersion`. Osobno potwierdza 401 dla anonimowego `/api/patterns`. Nie parsuje danych operatora ani nie wypisuje ich do logów.

- [ ] **Step 6: Uruchomić testy**

Run: `node --test test/legal-page.test.js test/static-files.test.js test/regression-public-suite.test.js`

Expected: PASS.

- [ ] **Step 7: Utworzyć checkpoint zadania**

```powershell
git add informacje-prawne.html server.js test/static-files.test.js scripts/regression/public-suite.js test/regression-public-suite.test.js
git commit -m "feat: serve public legal information page"
```

### Task 3: Linki, rejestracja i nota copyright

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `test/design-layout.test.js`
- Modify: `test/auth.test.js`

**Interfaces:**
- Registration payload: `{ login, password, invitationToken, termsAccepted, termsVersion, privacyNoticeVersion }`.
- Produces: linki przy rejestracji, koncie i stopce oraz dokładną notę copyright.

- [ ] **Step 1: Napisać failing test HTML**

Test JSDOM ma potwierdzić:

```js
const checkbox = document.querySelector('[name="termsAccepted"]');
assert.equal(checkbox.required, true);
assert.equal(checkbox.checked, false);
assert.equal(document.querySelectorAll('a[href^="/informacje-prawne"]').length >= 3, true);
assert.ok(document.querySelector('[name="invitationToken"]'));
```

Dodać kontrolę, że komunikat prywatności nie zawiera zwrotu `wyrażam zgodę na przetwarzanie`.

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/design-layout.test.js test/auth.test.js`

Expected: FAIL na braku pól i linków.

- [ ] **Step 3: Rozszerzyć formularz rejestracji**

Dodać token zaproszenia, niezaznaczony checkbox regulaminu, ukryte `termsVersion` i `privacyNoticeVersion`, linki do `#regulamin` i `#prywatnosc`. Wersje ustawia `app.js` wyłącznie z `CURRENT_LEGAL_DOCUMENT`.

- [ ] **Step 4: Dodać link konta i globalną stopkę**

Stopka zawiera link oraz element `#copyrightNotice`. Tekst jest ustawiany przez `formatCopyrightNotice(CURRENT_LEGAL_DOCUMENT)` przez `textContent`.

- [ ] **Step 5: Zbudować payload rejestracji**

Przekazać boolean z `checkbox.checked`, nie string z niezweryfikowanego body. Nie wysyłać żądania, jeśli wersja ukrytego pola różni się od bieżącego dokumentu.

- [ ] **Step 6: Uruchomić testy**

Run: `node --test test/design-layout.test.js test/auth.test.js test/registration-policy.test.js`; `node --check app.js`

Expected: PASS.

- [ ] **Step 7: Utworzyć checkpoint zadania**

```powershell
git add index.html app.js test/design-layout.test.js test/auth.test.js
git commit -m "ui: add legal consent and copyright links"
```

### Task 4: Kontroler ponownej akceptacji

**Files:**
- Create: `client/legal-acceptance-controller.js`
- Create: `test/legal-acceptance-controller.test.js`
- Modify: `index.html`
- Modify: `package.json`

**Interfaces:**
- Produces: `createLegalAcceptanceController(options)`.
- Consumes: session `legal: {currentVersion, acceptedVersion, acceptanceRequired}`.
- Calls: `POST /api/legal/acceptance` z `{version}`.

- [ ] **Step 1: Napisać failing testy kontrolera**

Przypadki:

```js
test("pokazuje gate tylko dla nieaktualnej akceptacji", () => {});
test("wysyła wyłącznie bieżącą wersję dokumentu", () => {});
test("nie wywołuje onAccepted po odpowiedzi błędnej", () => {});
test("po sukcesie ukrywa błąd i wywołuje onAccepted", () => {});
```

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/legal-acceptance-controller.test.js`

Expected: FAIL z brakiem modułu.

- [ ] **Step 3: Utworzyć region gate w widoku konta**

`#legalAcceptanceGate` zawiera wersję, link, niezaznaczony checkbox, przycisk, `role="status"` dla wyniku oraz linki do wylogowania i istniejącego usunięcia konta. Nie tworzyć nowego `data-view`.

- [ ] **Step 4: Zaimplementować izolowany kontroler**

Sygnatura:

```js
createLegalAcceptanceController({
  form,
  gate,
  message,
  versionOutput,
  request,
  legalDocument,
  onAccepted,
});
```

Metody `setSessionLegalState`, `isAcceptanceRequired`, `submit` nie odczytują globalnego DOM poza przekazanymi elementami.

- [ ] **Step 5: Uruchomić GREEN**

Run: `node --check client/legal-acceptance-controller.js`; `node --test test/legal-acceptance-controller.test.js test/design-layout.test.js`

Expected: PASS.

- [ ] **Step 6: Utworzyć checkpoint zadania**

```powershell
git add client/legal-acceptance-controller.js test/legal-acceptance-controller.test.js index.html package.json
git commit -m "ui: add current terms acceptance gate"
```

### Task 5: Integracja stanu sesji i blokada widoków

**Files:**
- Modify: `app.js`
- Modify: `client-policy.js`
- Modify: `test/client-policy.test.js`
- Modify: `test/design-regression.test.js`
- Modify: `test/legal-acceptance-controller.test.js`

**Interfaces:**
- Consumes: `session.legal.acceptanceRequired`.
- Guarantees: inventory, matches i catalog są ładowane wyłącznie dla zalogowanej sesji z aktualną akceptacją; katalog przestaje być publiczny.

- [ ] **Step 1: Napisać failing test polityki nawigacji**

```js
assert.equal(resolveRequestedView({ requested: "catalog", authenticated: true, acceptanceRequired: true }), "account");
assert.equal(resolveRequestedView({ requested: "account", authenticated: true, acceptanceRequired: true }), "account");
```

Dodać test, że sesja anonimowa jest kierowana do konta zamiast katalogu, natomiast logout i delete pozostają aktywne dla zalogowanego konta ze starą akceptacją.

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/client-policy.test.js test/design-regression.test.js`

Expected: FAIL na braku stanu prawnego.

- [ ] **Step 3: Rozszerzyć stan aplikacji**

Wprowadzić `requiresLegalAcceptance`. `setActiveView()` kieruje każdą chronioną próbę do `account`, dezaktywuje przyciski inventory/matches/catalog i pokazuje gate. Liczba widoków pozostaje cztery.

- [ ] **Step 4: Usunąć wyścig bootstrapu**

Najpierw pobrać sesję. Katalog i dane użytkownika pobierać dopiero po ustaleniu, że sesja jest zalogowana i ma aktualną akceptację. Sesja anonimowa oraz zalogowana sesja ze starą zgodą nie wywołują endpointów chronionych.

- [ ] **Step 5: Obsłużyć sukces ponownej akceptacji**

`onAccepted` ponownie pobiera sesję, odświeża stan i dopiero wtedy uruchamia dane widoku. Nie zakładać sukcesu wyłącznie na podstawie odpowiedzi UI.

- [ ] **Step 6: Uruchomić testy**

Run: `node --test test/client-policy.test.js test/design-regression.test.js test/legal-acceptance-controller.test.js`; `node --check app.js`

Expected: PASS.

- [ ] **Step 7: Utworzyć checkpoint zadania**

```powershell
git add app.js client-policy.js test/client-policy.test.js test/design-regression.test.js test/legal-acceptance-controller.test.js
git commit -m "ui: block stale legal sessions safely"
```

### Task 6: Styl, mobile, druk i dostępność

**Files:**
- Modify: `styles.css`
- Create: `test/legal-layout.test.js`
- Modify: `test/design-layout.test.js`

**Interfaces:**
- Produces: `.legal-shell`, `.legal-document`, `.legal-toc`, `.legal-section`, `.legal-meta`, `.legal-acceptance-gate`, `.legal-consent`, `.app-footer`.

- [ ] **Step 1: Napisać failing test kontraktu CSS**

Test tekstowy ma wymagać breakpointu `max-width: 640px`, `@media print`, ukrycia nawigacji w druku, białego tła/czarnego tekstu i `break-inside: avoid` dla sekcji.

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/legal-layout.test.js`

Expected: FAIL na braku selektorów.

- [ ] **Step 3: Dodać styl oparty na istniejących tokenach**

Nie tworzyć drugiej palety. Linki i przyciski zachowują widoczny focus oraz cel dotykowy co najmniej 44 px. Mobile ma jedną kolumnę i brak poziomego przewijania.

- [ ] **Step 4: Dodać styl wydruku**

```css
@media print {
  .app-header,
  .legal-actions,
  .app-footer,
  .skip-link,
  .theme-toggle { display: none !important; }
  body { background: #fff !important; color: #000 !important; }
  .legal-shell { width: 100%; max-width: none; box-shadow: none; }
  .legal-section { break-inside: avoid; }
}
```

- [ ] **Step 5: Uruchomić automatyczne testy**

Run: `node --test test/legal-layout.test.js test/design-layout.test.js`; `npm run lint`

Expected: PASS.

- [ ] **Step 6: Wykonać kontrolę wizualną**

Uruchomić lokalny serwer i sprawdzić `/informacje-prawne` przy 375 px oraz 1440 px, nawigację klawiaturą, focus, kotwice, motyw jasny/ciemny i podgląd wydruku/PDF. Zapisać wynik w raporcie wykonania; nie zastępować kontroli wizualnej samymi regexami CSS.

- [ ] **Step 7: Utworzyć checkpoint zadania**

```powershell
git add styles.css test/legal-layout.test.js test/design-layout.test.js
git commit -m "ui: style legal information for screen and print"
```

### Task 7: Dokumentacja i pełna weryfikacja

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `CHANGELOG.txt`

**Interfaces:**
- Documents: publiczną ścieżkę, rejestrację, ponowną akceptację i copyright.

- [ ] **Step 1: Zaktualizować dokumentację**

README opisuje stronę prawną i zaproszenia. SPEC opisuje session payload, endpoint akceptacji oraz blokadę widoków. CHANGELOG opisuje widoczny rezultat dla użytkownika.

- [ ] **Step 2: Uruchomić pełny zestaw kontroli**

Run: `npm run check`; `npm run lint`; `npm run format:check`; `npm run test:db`; `git diff --check`

Expected: PASS.

- [ ] **Step 3: Uruchomić publiczną regresję lokalną**

Run: `npm start`, a w drugim procesie `npm run regression:smoke`.

Expected: strona główna i `/informacje-prawne` zwracają 200, mają nagłówki bezpieczeństwa i właściwą wersję dokumentu.

- [ ] **Step 4: Sprawdzić stan bramki produkcyjnej**

Run: `npm run legal:check`

Expected przed uzupełnieniem danych operatora: kontrolowany wynik `not ready`. Nie obchodzić bramki i nie wdrażać produkcyjnie z placeholderami.

- [ ] **Step 5: Sprawdzić zakres zmian**

Run: `git status --short`; `git diff --stat`

Expected: wcześniejsze niezwiązane zmiany użytkownika pozostają zachowane poza checkpointami tego planu.

- [ ] **Step 6: Utworzyć checkpoint dokumentacji**

```powershell
git add README.md SPEC.md CHANGELOG.txt
git commit -m "docs: document legal information experience"
```

## Completion Gate

Plan jest wykonany, gdy strona prawna działa bez logowania, zawiera aktualną wersję i copyright, rejestracja przekazuje ważną akceptację, stara zgoda pokazuje bezpieczny gate, a UI nie pobiera chronionych danych przed zgodą. Produkcja pozostaje zablokowana do czasu zastąpienia placeholderów i potwierdzenia danych dostawców.
