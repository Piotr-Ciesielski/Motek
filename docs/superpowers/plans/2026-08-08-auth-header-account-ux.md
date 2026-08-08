# Auth header and account UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zastąpić email użytkownika w headerze przyciskiem `Zaloguj`/`Wyloguj`, zapewnić przewidywalne przejścia sesji oraz zmniejszyć i uporządkować zalogowany widok Konta.

**Architecture:** Istniejący przepływ `renderAuthState`, `showAuthForm`, `setActiveView` i `POST /api/auth/logout` pozostaje źródłem prawdy. Header dostanie jeden przycisk sesji aktualizowany razem ze stanem Auth, a zalogowane Konto otrzyma natywną sekcję `details` dla destrukcyjnej operacji bez zmiany endpointów ani zabezpieczeń.

**Tech Stack:** HTML, vanilla JavaScript, CSS, Node.js test runner, JSDOM, istniejące kontrolery Auth.

## Global Constraints

- Przełącznik trybu znajduje się wizualnie po lewej stronie przycisku `Zaloguj`/`Wyloguj`.
- `Wyloguj` wywołuje istniejące `POST /api/auth/logout` natychmiast, z zachowaniem ostrzeżenia o niezapisanych zmianach.
- Poprawne logowanie kończy się widokiem `Magazyn`; poprawne wylogowanie kończy się widokiem `Konto` z formularzem logowania.
- Nie zmieniać API, cookies, idle timeoutu, Turnstile, ponownego uwierzytelnienia ani endpointu `DELETE /api/account`.
- Strefa `Usuń konto` używa dostępnego disclosure domyślnie zamkniętego i zachowuje wszystkie pola oraz komunikaty po otwarciu.
- Zachować minimum 44×44 px dla akcji headera, widoczny focus, reduced-motion i brak poziomego overflow.
- Nie pokazywać adresu email w headerze ani w tooltipie; email pozostaje tylko w panelu Konta jako `Zalogowano jako: {email}`.

---

### Task 1: Zabezpieczone kontrakty DOM i copy

**Files:**
- Modify: `index.html:39-44,70-192`
- Modify: `test/design-layout.test.js`
- Modify: `test/design-regression.test.js`

**Interfaces:**
- Produces `#headerAuthAction` (button), `#authLoggedIn`, `#authProfileSummary`, `#deleteAccountDisclosure`/`summary` hooks used by later JS and CSS tasks.

- [ ] **Step 1: Write failing DOM tests**

  Add assertions that the header actions are ordered as theme toggle followed by one auth button, that the old `#headerUser` is absent, and that the authenticated copy contains the colon while the permanent bottom `Zalogowano.` copy is absent.

  ```js
  const actions = [...document.querySelectorAll('.app-header__actions > *')];
  assert.deepEqual(actions.map((node) => node.id), ['themeToggle', 'headerAuthAction']);
  assert.equal(document.getElementById('headerUser'), null);
  assert.match(document.getElementById('authProfileSummary').textContent, /Zalogowano jako:/);
  assert.equal(document.querySelector('#authLoggedIn > .auth-message'), null);
  ```

- [ ] **Step 2: Run focused tests and confirm failure**

  Run `node --test test/design-layout.test.js test/design-regression.test.js`.

  Expected: FAIL because the current header still contains `#headerUser` and the current account markup has no disclosure contract.

- [ ] **Step 3: Update the HTML structure**

  Replace `<div id="headerUser" ...>` with `<button id="headerAuthAction" class="header-auth-action" type="button">Zaloguj</button>`. Keep it after `#themeToggle` in `.app-header__actions`.

  Change authenticated account copy to `Zalogowano jako: ` plus the runtime email. Remove the authenticated-state eyebrow `Konto` through the state-specific markup/class rather than changing the unauthenticated form heading. Wrap the existing delete form in:

  ```html
  <details id="deleteAccountDisclosure" class="account-danger-disclosure">
    <summary>Usuń konto</summary>
    <form id="deleteAccountForm" ...>...</form>
  </details>
  ```

  Preserve all existing input IDs, labels, `aria-describedby`, confirmation phrase, and submit button.

- [ ] **Step 4: Run the focused DOM tests**

  Run `node --test test/design-layout.test.js test/design-regression.test.js`.

  Expected: DOM/layout contract tests PASS; behavior tests remain pending until Task 2.

### Task 2: Header session action and navigation flow

**Files:**
- Modify: `app.js:43-56,1888-1934,1992-2031,2128-2155`
- Modify: `test/auth-controller.test.js`
- Modify: `test/design-regression.test.js`

**Interfaces:**
- Consumes: `#headerAuthAction`, existing `renderAuthState`, `showAuthForm`, `setActiveView`, `api`, `logoutBtn` and `isAuthenticated`.
- Produces: one header click handler whose behavior follows the current auth state.

- [ ] **Step 1: Add failing behavior tests**

  Extend the JSDOM app harness with a successful login response and assert that clicking the unauthenticated header action selects Konto and focuses `#login-email`; after a successful login assert `#inventoryView` is active and the header text is `Wyloguj`; clicking it must call `/api/auth/logout` and return to Konto.

  ```js
  assert.equal(document.getElementById('headerAuthAction').textContent, 'Zaloguj');
  document.getElementById('headerAuthAction').click();
  assert.equal(document.activeElement.id, 'login-email');
  ```

- [ ] **Step 2: Run the focused auth tests and confirm failure**

  Run `node --test test/auth-controller.test.js test/design-regression.test.js`.

  Expected: FAIL because the app currently has no header action handler and still writes the email to `#headerUser`.

- [ ] **Step 3: Implement state-driven header behavior**

  Add a DOM reference for `headerAuthAction`. In `renderAuthState`:

  - unauthenticated: set text `Zaloguj`, `aria-label="Zaloguj"`, and keep private views on Konto;
  - authenticated: set text `Wyloguj`, `aria-label="Wyloguj"`, and never copy the email into the header;
  - keep the existing `authUser`/profile summary only for the account panel.

  Add one click listener:

  ```js
  headerAuthAction.addEventListener('click', () => {
    if (isAuthenticated) return logoutBtn.click();
    setActiveView('account');
    showAuthForm(loginForm);
    setAuthMessage('');
    loginForm.querySelector('input[name="email"]').focus();
  });
  ```

  Keep the existing logout implementation as the single execution path. On successful login, preserve the existing `submitAuthForm` transition to `setActiveView('inventory')`. On successful logout, call `renderAuthState({ authenticated: false })`, show Konto and use the existing success message path without leaving private content visible.

- [ ] **Step 4: Run behavior tests**

  Run `node --test test/auth-controller.test.js test/design-regression.test.js`.

  Expected: PASS for login focus, login → Magazyn, header label changes, immediate logout and logout → Konto. Existing unsaved-draft confirmation tests must remain PASS.

### Task 3: Compact authenticated account layout

**Files:**
- Modify: `styles.css:734-840,2297-2338,2589-2615` and responsive blocks near `@media` rules
- Modify: `test/design-layout.test.js`
- Modify: `test/design-regression.test.js`

**Interfaces:**
- Consumes: `#authLoggedIn`, `#authProfileSummary`, `#logoutBtn`, `#deleteAccountDisclosure` and existing theme tokens.
- Produces: responsive authenticated account surface with compact disclosure and no layout overflow.

- [ ] **Step 1: Add failing CSS/layout assertions**

  Assert that the disclosure is closed by default in HTML, header actions have a 44px target, the account danger zone has compact spacing, and mobile rules keep the header action visible without horizontal overflow.

  ```js
  const disclosure = document.getElementById('deleteAccountDisclosure');
  assert.ok(disclosure);
  assert.equal(disclosure.hasAttribute('open'), false);
  assert.match(stylesCss, /\.header-auth-action[\s\S]*min-(?:width|height): 44px/);
  assert.match(stylesCss, /\.account-danger-disclosure/);
  ```

- [ ] **Step 2: Run layout tests and confirm failure**

  Run `node --test test/design-layout.test.js test/design-regression.test.js`.

  Expected: FAIL because the current account form is a full-size visible danger zone and no header-auth action styles exist.

- [ ] **Step 3: Implement scoped CSS**

  Add `.header-auth-action` beside `.theme-toggle` with shared 44px height, compact horizontal padding, focus-visible outline, and theme-token colors. Keep `.app-header__actions` in row order so theme toggle remains left of the auth action.

  Scope authenticated account rules under `#accountView.is-authenticated`: reduce panel spacing, remove the authenticated eyebrow visually, style `#authProfileSummary` as the single email line, and make `details.account-danger-disclosure` a compact warning surface. Style `summary` with a disclosure marker and a clear open state; do not use a hover-only affordance.

  Add mobile rules at the existing 768px/640px breakpoints so actions wrap cleanly, the header never overflows, and the expanded delete form remains one column. Add a reduced-motion override for disclosure transitions if any transition is introduced; default implementation may avoid animation entirely.

- [ ] **Step 4: Run layout and accessibility checks**

  Run `node --test test/design-layout.test.js test/design-regression.test.js` and `npm run lint`.

  Expected: focused tests PASS, lint has no new errors, and only the existing four warnings remain.

### Task 4: Full regression and visual QA

**Files:**
- No additional source files; update `docs/operations/` only after QA evidence is complete.

- [ ] **Step 1: Run the full automated suite**

  Run `npm run check`, `npm run lint`, and `git diff --check` from the clean implementation worktree.

  Expected: all tests PASS, lint has 0 errors, and the diff has no whitespace errors.

- [ ] **Step 2: Verify browser flows at four widths**

  In both light and dark themes, verify 1440, 1024, 768 and 390 CSS px:

  1. unauthenticated header order and `Zaloguj` focus flow;
  2. login → Magazyn and authenticated `Wyloguj` label;
  3. immediate logout → Konto login form;
  4. authenticated Konto copy and closed/open `Usuń konto` disclosure;
  5. keyboard focus, Escape/summary interaction, no horizontal scroll.

- [ ] **Step 3: Capture and self-review screenshots**

  Save final QA evidence under `.audit/auth-header-account-ux-2026-08-08/` only if the repository’s QA artifact policy permits it. Compare the authenticated Konto surface with the approved design spec and check that the danger zone is visually subordinate without hiding its irreversible nature.

- [ ] **Step 4: Update the QA record**

  Add the final test counts, viewport matrix, and any intentionally preserved behavior to `docs/operations/` without adding implementation claims that were not verified.

- [ ] **Step 5: Propose a Git checkpoint**

  After all checks pass, propose a focused commit such as:

  ```text
  feat: streamline auth header and account security view
  ```
