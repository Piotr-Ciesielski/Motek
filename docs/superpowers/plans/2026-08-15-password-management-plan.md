# Password Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać bezpieczną zmianę istniejącego hasła w karcie „Konto” oraz naprawić przejście z linku resetującego do formularza ustawienia nowego hasła.

**Architecture:** Reset pozostaje osobnym przepływem recovery z istniejącym grantem i endpointem `/api/auth/password`. Zwykła zmiana hasła otrzyma osobny endpoint `/api/auth/password/change`, który wymaga aktywnej sesji i dotychczasowego hasła, a po sukcesie unieważnia wszystkie sesje. Interfejs wykorzysta istniejący widok „Konto”, wspólne komunikaty Auth i istniejące mechanizmy walidacji oraz czyszczenia cookies.

**Tech Stack:** Node.js HTTP server, Supabase Auth przez `@supabase/supabase-js`, statyczny frontend `index.html`/`app.js`, testy `node:test`, testy integracyjne HTTP i testy statycznego layoutu.

**Status realizacji (2026-08-16):** implementacja planu wykonana. Kod zapisano w commitach
`597cf02` i `fc1650d`, opublikowano na GitHub oraz wdrożono na stagingu.
Ręczna zmiana hasła na `https://staging.rysia.org` zakończyła się sukcesem;
osobny ręczny test recovery pozostaje do wykonania.

## Global Constraints

- Nie zmieniać istniejącego kontraktu recovery ani nie używać grantu recovery do zwykłej zmiany hasła.
- Wymagać `currentPassword` oraz `password`; pole potwierdzenia służy wyłącznie do walidacji frontendu.
- Po udanym `updateUser` próbować globalnego wylogowania i zawsze czyścić bieżące cookies; po błędzie przed zmianą hasła nie wylogowywać użytkownika.
- Nie używać `service_role` do weryfikacji hasła ani nie przekazywać sekretów Supabase do przeglądarki.
- Nie logować haseł, kodów recovery, access tokenów, refresh tokenów ani cookies.
- Zachować istniejące rate limiting, `validateAuthPassword`, komunikaty `ApiError` i wzorce `setAuthCookies`/`clearAuthCookies`.
- Zachować istniejące niezapisane zmiany użytkownika; staging i inne operacje zewnętrzne wymagają osobnej zgody przed wykonaniem.
- Po każdym zadaniu uruchomić test właściwy dla zadania, a przed checkpointem pełne `npm run check`, lint, format check i `git diff --check`.

---

### Task 1: Rozszerzyć testy kontraktu zwykłej zmiany hasła

**Files:**
- Modify: `test/server.test.js` — istniejący fake klient Supabase i blok testów Auth przy scenariuszach recovery.
- Modify: `test/auth.test.js` — walidacja wymaganych pól i wspólne reguły Auth.

**Interfaces:**
- Consumes: istniejący `fakeSupabaseAuthClientFactory`, `recoveryGrantState`, `signOutScopes`, `recoveryGrantEvents` oraz helper uruchamiający testowy serwer.
- Produces: testowy kontrakt `POST /api/auth/password/change` z kolejnością `signInWithPassword → updateUser → signOut({ scope: "global" })`.

- [ ] **Step 1: Rozszerz fake klienta o niezależne zdarzenia weryfikacji hasła**

Dodaj do stanu testowego liczbę wywołań `verifyPasswordCalls`, błąd `verifyPasswordError` oraz dane przekazywane do `signInWithPassword`. Zachowaj istniejące zdarzenia recovery, aby testy starych przepływów nadal rozróżniały `signInWithPassword` logowania od weryfikacji zmiany hasła.

```js
passwordChangeState = {
  verifyPasswordCalls: 0,
  verifyPasswordError: null,
  updateUserCalls: 0,
  updateUserError: null,
  signOutError: null,
};
```

- [ ] **Step 2: Napisz testy czerwone dla nowego endpointu**

Dodaj testy sprawdzające:

```js
const response = await fetch(`${baseUrl}/api/auth/password/change`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: authenticatedCookies },
  body: JSON.stringify({ currentPassword: "OldValid1!", password: "NewValid1!" }),
});

assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { passwordUpdated: true, authenticated: false });
assert.equal(passwordChangeState.verifyPasswordCalls, 1);
assert.equal(passwordChangeState.updateUserCalls, 1);
assert.deepEqual(signOutScopes.at(-1), { scope: "global" });
```

Dodaj osobne przypadki dla braku sesji (`401`), braku `currentPassword` (`400`),
błędnego starego hasła bez `updateUser`, niepoprawnego nowego hasła bez wywołań
Auth, błędu `updateUser` bez globalnego wylogowania oraz błędu globalnego
wylogowania po udanej zmianie z wyczyszczeniem cookies. Sprawdź także, że
odpowiedzi i logi testowane przez spy nie zawierają haseł ani tokenów.

- [ ] **Step 3: Uruchom testy i potwierdź oczekiwane niepowodzenie**

Run: `node --test test/server.test.js test/auth.test.js`

Expected: nowe testy nie przechodzą, ponieważ endpoint nie istnieje; istniejące
testy Auth pozostają zielone.

---

### Task 2: Dodać backendowy endpoint zmiany hasła

**Files:**
- Modify: `server.js:571-575` — użycie fabryki klienta Auth i izolowanego klienta weryfikującego.
- Modify: `server.js:1278-1410` — nowa trasa obok, ale niezależnie od `/api/auth/password` recovery.
- Test: `test/server.test.js` — testy z Task 1.

**Interfaces:**
- Consumes: `requireAuthenticatedSession(req, res)`, `validateAuthPassword`, `parseCookies`, `clearAuthCookies`, `supabaseAuthClientFactory` oraz bieżące access/refresh tokeny sesji.
- Produces: `POST /api/auth/password/change` przyjmujący `{ currentPassword, password }` i zwracający `{ passwordUpdated: true, authenticated: false }`.

- [ ] **Step 1: Utwórz izolowany klient do weryfikacji dotychczasowego hasła**

Nie zapisuj sesji utworzonej przez `signInWithPassword` do cookies ani do
globalnego klienta. Klient weryfikujący ma służyć wyłącznie do jednego żądania
Auth; wynik sesji nie może być zwracany do przeglądarki.

```js
const verifier = supabaseAuthClientFactory(supabaseAuthConfig);
const { error: verifyError } = await verifier.auth.signInWithPassword({
  email: session.user.email,
  password: currentPassword,
});
```

Przy błędzie zwróć kontrolowany `400` z ogólnym komunikatem i zakończ przed
`updateUser`. Nie rozróżniaj w odpowiedzi, czy konto istnieje lub czy błąd
pochodził od starego hasła.

- [ ] **Step 2: Dodaj minimalną obsługę endpointu**

Kolejność w `server.js` ma być następująca:

```js
const session = await requireAuthenticatedSession(req, res);
const body = await readBody(req);
const currentPassword = normalizePassword(body.currentPassword, "dotychczasowe");
const password = validateAuthPassword(body.password);
// signInWithPassword na izolowanym kliencie
// setSession({ access_token, refresh_token }) na kliencie bieżącej sesji
// updateUser({ current_password, password }) na tym kliencie
// signOut({ scope: "global" }) po udanej zmianie
// clearAuthCookies(res) po udanej zmianie, także w ścieżce błędu signOut
```

Użyj istniejącego wzorca klienta z bearer tokenem:

```js
const client = supabaseAuthClientFactory(supabaseAuthConfig, session.accessToken);
await client.auth.setSession({
  access_token: session.accessToken,
  refresh_token: session.refreshToken,
});
const { error: updateError } = await client.auth.updateUser({
  current_password: currentPassword,
  password,
});
```

Jeżeli `updateUser` się nie powiedzie, zwróć kontrolowany błąd i nie wykonuj
globalnego wylogowania. Jeżeli `updateUser` się powiedzie, spróbuj
`client.auth.signOut({ scope: "global" })` w `try/finally`, a `clearAuthCookies`
wykonaj zawsze w tym `finally`. Gdy globalny sign-out się nie powiedzie,
zwróć `503` z komunikatem, że hasło zmieniono i należy zalogować się ponownie;
nie próbuj cofać hasła.

- [ ] **Step 3: Uruchom testy backendu**

Run: `node --test test/server.test.js test/auth.test.js`

Expected: wszystkie testy zwykłej zmiany hasła oraz istniejące testy recovery
przechodzą.

---

### Task 3: Dodać formularz zmiany hasła do stanu zalogowanego

**Files:**
- Modify: `index.html:180-230` — sekcja `#authLoggedIn`.
- Modify: `styles.css` — scoped style nowej sekcji `account-security-zone`.
- Modify: `test/design-layout.test.js` — kontrakt DOM i endpointu.

**Interfaces:**
- Consumes: istniejące `authLoggedIn`, `authMessage`, `password-reveal`, `field-hint` i klasy formularzy Auth.
- Produces: `#changePasswordForm` z polami `currentPassword`, `password`, `passwordConfirmation` i `action="/api/auth/password/change"`.

- [ ] **Step 1: Napisz testy strukturalne formularza**

Dodaj asercje, że `index.html` zawiera ukryte wraz ze stanem gościa, ale
renderowane po zalogowaniu `changePasswordForm`, wymagane pola haseł,
`autocomplete="current-password"`/`"new-password"`, potwierdzenie nowego
hasła i akcję nowego endpointu. Sprawdź, że formularz nie znajduje się w
`passwordResetForm` ani w recovery-only `passwordUpdateForm`.

Run: `node --test test/design-layout.test.js`

Expected: nowe asercje początkowo nie przechodzą.

- [ ] **Step 2: Dodaj markup bez zmiany istniejącego recovery**

Dodaj w `#authLoggedIn` sekcję z przyciskiem otwierającym panel i formularzem.
Panel ma być domyślnie zwinięty, mieć `aria-labelledby`, a formularz ma używać
istniejących mechanizmów reveal password i `authMessage`. Pole potwierdzenia
nie jest wysyłane do backendu jako część kontraktu; służy do lokalnego
porównania przed żądaniem.

- [ ] **Step 3: Dodaj minimalne style i uruchom testy layoutu**

Użyj istniejących tokenów i klas przycisków. Nie twórz nowego systemu modalnego
ani osobnej strony. Jeśli potrzebny jest styl, ogranicz go do sekcji
`account-security-zone` w `styles.css`.

Run: `node --test test/design-layout.test.js test/password-reveal-dom.test.js`

Expected: testy przechodzą, a istniejące formularze Auth zachowują dotychczasowe
identyfikatory i akcje.

---

### Task 4: Podłączyć frontend zmiany hasła i naprawić callback resetu

**Files:**
- Modify: `app.js:1810-1882` — przełączanie formularzy i `startPasswordRecovery`.
- Modify: `app.js:1884-1948` — renderowanie stanu zalogowanego, jeśli wymaga pokazania sekcji.
- Modify: `app.js:2095-2148` — handlery resetu i nowego formularza.
- Modify: `test/design-layout.test.js` — statyczne kontrakty callbacku i handlera.
- Modify: `test/auth.test.js` — lokalna walidacja zgodności nowego hasła z potwierdzeniem.

**Interfaces:**
- Consumes: `api`, `setAuthMessage`, `setAuthBusy`, `renderAuthState`, `showAuthForm`, `resetCaptchaForForm`.
- Produces: obsługa `changePasswordForm` oraz callbacku recovery bez cichego przejścia do zwykłej karty „Konto”.

- [ ] **Step 1: Napisz testy czerwone dla handlera i callbacku**

Dodaj statyczne asercje, że:

```js
await api("/api/auth/password/change", {
  method: "POST",
  body: JSON.stringify({ currentPassword, password }),
});
```

oraz że formularz porównuje `passwordConfirmation`, blokuje się podczas
żądania, po sukcesie czyści pola, renderuje stan gościa i pokazuje komunikat
ponownego logowania. Dodaj przypadek callbacku z `code` bez `recovery=1`:
kod ma być obsłużony, jeśli nie jest callbackiem potwierdzenia rejestracji.

- [ ] **Step 2: Dodaj funkcję obsługi zmiany hasła**

Handler ma:

1. zatrzymać submit i sprawdzić zgodność nowego hasła z potwierdzeniem;
2. wysłać tylko `currentPassword` i `password`;
3. użyć `setAuthBusy` i wspólnego `authMessage`;
4. po sukcesie wyczyścić formularz, ukryć stan zalogowany, pokazać login i
   komunikat o ponownym logowaniu;
5. po błędzie zachować formularz i fokus na komunikacie.

Nie wysyłaj pola `passwordConfirmation` do backendu.

- [ ] **Step 3: Napraw parser callbacku resetu**

Wydziel lokalną funkcję, która odczytuje `code` z query stringu i traktuje go
jak recovery, gdy marker `recovery=1` jest obecny albo gdy jest to callback
resetu bez znanego callbacku signup/confirmation. Przed `POST /api/auth/recovery`
wyczyść query i fragment przez `history.replaceState`. Nie zapisuj kodu w
globalnym stanie i nie loguj go. Po sukcesie pokaż `passwordUpdateForm` i
ustaw fokus na polu nowego hasła. Po błędzie pokaż login z komunikatem i nie
wywołuj `refreshAuthSession` dla niedokończonego recovery.

- [ ] **Step 4: Odśwież CAPTCHA po żądaniu resetu**

W `finally` handlera `passwordResetForm` wywołaj `resetCaptchaForForm(passwordResetForm)`
po zakończeniu żądania, aby kolejne próby nie używały starego tokenu.

- [ ] **Step 5: Uruchom testy frontendowe**

Run: `node --test test/design-layout.test.js test/auth.test.js test/client-policy.test.js`

Expected: testy callbacku, nowego formularza i istniejących przepływów Auth
przechodzą.

---

### Task 5: Niezależna recenzja i poprawki

**Files:**
- Review: `server.js`, `app.js`, `index.html`, `styles.css`, zmienione testy i migracje, jeśli jakakolwiek okaże się potrzebna.

**Interfaces:**
- Consumes: wynik Tasks 1–4 oraz specyfikacja `docs/superpowers/specs/2026-08-15-password-management-design.md`.
- Produces: lista konkretnych uwag dotyczących bezpieczeństwa, kolejności sesji, wycieku sekretów, dostępności i regresji recovery.

- [ ] **Step 1: Uruchom niezależnego `motek_reviewer` tylko do odczytu**

Recenzent ma sprawdzić minimum:

- czy zwykła sesja nie może wywołać recovery endpointu bez grantu;
- czy błędne stare hasło nie zmienia hasła i nie wylogowuje użytkownika;
- czy po sukcesie cookies są czyszczone także po błędzie globalnego sign-out;
- czy izolowany klient `signInWithPassword` nie zapisuje sesji;
- czy URL nie ujawnia kodu po rozpoczęciu recovery;
- czy istniejące reset, login, signup i account deletion nadal działają;
- czy testy pokrywają obie ścieżki.

- [ ] **Step 2: Popraw wyłącznie konkretne uwagi**

Po każdej poprawce uruchom test właściwy dla zmienionego pliku. Nie rozszerzaj
zakresu na przebudowę `client/auth-controller.js` ani inne niezwiązane refaktoryzacje.

---

### Task 6: Pełna weryfikacja lokalna i checkpoint

**Files:**
- Verify: wszystkie pliki zmienione w Tasks 1–5.
- Update if needed: `docs/operations/password-management-follow-up-2026-08-15.md`.

**Interfaces:**
- Consumes: zweryfikowany kod i raport recenzenta.
- Produces: lokalnie zielony pakiet gotowy do ręcznego sprawdzenia na stagingu.

- [x] **Step 1: Uruchom pełny zestaw kontroli**

Run: `npm run check`

Expected: wszystkie testy przechodzą, w tym nowe testy zmiany hasła i recovery.

Run: `npm run lint`

Expected: lint przechodzi.

Run: `npm run format:check`

Expected: formatowanie przechodzi.

Run: `git diff --check`

Expected: brak błędów whitespace; ostrzeżenia CRLF dotyczące istniejącego
worktree nie są traktowane jako błąd treści.

- [x] **Step 2: Sprawdź brak niezamierzonych plików w pakiecie**

Run: `git diff --stat` oraz `git status --short`

Staged diff ma zawierać wyłącznie pliki tego pakietu; `README.md`, `SPEC.md`,
materiały `AUDYT_*`, `Designs/`, `tools/` i wcześniejsze niezapisane zmiany
pozostają poza checkpointem.

- [x] **Step 3: Zaproponuj osobny checkpoint Git**

Po lokalnej weryfikacji zaproponuj commit o nazwie:

```text
feat: add password change and recovery form flows
```

Commit i push wymagają osobnej zgody użytkownika. Nie wykonuj wdrożenia,
zdalnej migracji ani zmian produkcyjnych w ramach tego planu.

---

### Task 7: Ręczna weryfikacja stagingu po zgodzie

**Files:**
- Verify externally: staging Motka w przeglądarce.
- Update: `docs/operations/password-management-follow-up-2026-08-15.md` po wyniku testu.

**Interfaces:**
- Consumes: opublikowany, lokalnie zweryfikowany checkpoint i zalogowana sesja stagingowa.
- Produces: potwierdzenie obu ścieżek bez zmiany produkcji.

- [x] **Step 1: Sprawdź zwykłą zmianę hasła**

Na stagingu otwórz „Konto”, rozwiń „Zmień hasło”, sprawdź odrzucenie błędnego
starego hasła, następnie wykonaj zmianę poprawnym starym hasłem. Potwierdź
wylogowanie, ponowne logowanie nowym hasłem i brak dostępu starego hasła.

- [ ] **Step 2: Sprawdź reset z e-maila**

Wyślij żądanie resetu, otwórz nowy link z wiadomości i potwierdź, że formularz
„Ustaw nowe hasło” jest widoczny. Sprawdź także link wygasły lub wykorzystany:
ma pokazać komunikat i nie może otworzyć zwykłego konta.

- [ ] **Step 3: Sprawdź dane i sesje**

Potwierdź, że po zmianie hasła dane magazynu pozostają bez zmian, a druga
aktywna sesja użytkownika przestaje być ważna. Wyniki i ewentualne blokady
zapisz w dokumentacji operacyjnej.
