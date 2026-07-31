# Usuwanie konta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać natychmiastowe i bezpowrotne usuwanie konta po ponownym podaniu hasła oraz wpisaniu `USUŃ KONTO`.

**Architecture:** Backend udostępni chroniony `DELETE /api/account`, zweryfikuje hasło przez Supabase Auth i usunie użytkownika przez administracyjny klient Supabase z kluczem secret. Istniejące klucze obce `profiles` i `yarns` z `on delete cascade` usuną dane prywatne bez nowej migracji. Frontend dostanie osobną sekcję ryzyka, która nie ponawia niepewnej operacji.

**Tech Stack:** Node.js, `@supabase/supabase-js` 2.110.8, istniejące sesje HttpOnly, Node test runner, statyczny frontend HTML/CSS/JavaScript

## Global Constraints

- Operacja jest natychmiastowa i nieodwracalna.
- Wymagane są aktywna sesja, poprawne hasło i dokładna fraza `USUŃ KONTO`.
- Frontend nigdy nie otrzymuje `SUPABASE_SECRET_KEY`.
- `public.patterns` pozostaje nietknięte.
- Hasła, tokeny i sekretne komunikaty nie trafiają do logów ani odpowiedzi API.
- Po utracie odpowiedzi sieciowej usunięcie nie jest automatycznie ponawiane.
- Każda przyszła tabela z danymi użytkownika musi używać `on delete cascade` albo jawnej procedury usuwania.

---

### Task 1: Walidacja żądania usunięcia

**Files:**
- Create: `account-deletion-policy.js`
- Create: `test/account-deletion-policy.test.js`

**Interfaces:**
- Produces: `ACCOUNT_DELETION_PHRASE: "USUŃ KONTO"`
- Produces: `validateAccountDeletionInput(value: unknown) -> { password: string, confirmation: string }`

- [ ] **Step 1: Napisać czerwone testy kontraktu**

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ACCOUNT_DELETION_PHRASE,
  validateAccountDeletionInput,
} = require("../account-deletion-policy");

test("przyjmuje poprawne hasło i dokładną frazę", () => {
  assert.deepEqual(
    validateAccountDeletionInput({
      password: "BezpieczneHaslo1!",
      confirmation: ACCOUNT_DELETION_PHRASE,
    }),
    { password: "BezpieczneHaslo1!", confirmation: ACCOUNT_DELETION_PHRASE },
  );
});

test("odrzuca błędną frazę niezależnie od wielkości liter i spacji", () => {
  assert.throws(
    () => validateAccountDeletionInput({
      password: "BezpieczneHaslo1!",
      confirmation: " usuń konto ",
    }),
    /USUŃ KONTO/,
  );
});

test("odrzuca brak hasła, frazy i obiekt zamiast danych", () => {
  assert.throws(() => validateAccountDeletionInput(null), /danych/);
  assert.throws(
    () => validateAccountDeletionInput({ confirmation: ACCOUNT_DELETION_PHRASE }),
    /hasło/,
  );
  assert.throws(
    () => validateAccountDeletionInput({ password: "BezpieczneHaslo1!" }),
    /USUŃ KONTO/,
  );
});
```

- [ ] **Step 2: Uruchomić test i potwierdzić właściwą porażkę**

Run:

```powershell
node --test --test-isolation=none test/account-deletion-policy.test.js
```

Expected: `FAIL`, ponieważ `account-deletion-policy.js` jeszcze nie istnieje.

- [ ] **Step 3: Zaimplementować minimalną walidację**

Walidator ma wymagać niepustego stringa `password`, nie modyfikować jego treści
i wymagać porównania `confirmation === ACCOUNT_DELETION_PHRASE`. Nie przyjmuje
identyfikatora użytkownika, adresu e-mail ani innych danych sterujących celem
usunięcia.

- [ ] **Step 4: Uruchomić test modułu**

Run:

```powershell
node --test --test-isolation=none test/account-deletion-policy.test.js
```

Expected: wszystkie testy `PASS`.

- [ ] **Step 5: Zapisać checkpoint**

```powershell
git add account-deletion-policy.js test/account-deletion-policy.test.js
git commit -m "feat: validate account deletion confirmation"
git push
```

---

### Task 2: Usunięcie użytkownika w warstwie Supabase

**Files:**
- Modify: `server.js:370-470, 1400-1545`
- Modify: `test/server.test.js`

**Interfaces:**
- Consumes: `session.user.id`, `session.user.email` oraz wynik `validateAccountDeletionInput`
- Produces: `deleteSupabaseAccount(session, deletionInput) -> Promise<void>`

- [ ] **Step 1: Dodać czerwone testy użycia właściwego użytkownika**

Atrapa klienta ma rejestrować wywołanie `auth.signInWithPassword` oraz
`supabaseConnection.client.auth.admin.deleteUser`. Test ma potwierdzić:

```js
assert.deepEqual(passwordAttempts, [{
  email: "a@example.com",
  password: "BezpieczneHaslo1!",
}]);
assert.deepEqual(deletedUserIds, ["11111111-1111-4111-8111-111111111111"]);
```

Dodać osobne przypadki dla błędnego hasła oraz sytuacji, w której Auth zwróci
użytkownika o innym identyfikatorze. W obu przypadkach metoda administracyjna
nie może zostać wywołana.

- [ ] **Step 2: Uruchomić test serwera i potwierdzić porażkę**

Run:

```powershell
node --test --test-isolation=none test/server.test.js
```

Expected: `FAIL`, ponieważ funkcja usuwania i administracyjny klient nie są
jeszcze podłączone do serwera testowego.

- [ ] **Step 3: Zaimplementować weryfikację i usunięcie**

Implementacja ma:

1. utworzyć nietrwały klient Auth z istniejącym publishable key;
2. wykonać `signInWithPassword({ email: session.user.email, password })`;
3. sprawdzić, że zwrócony użytkownik ma `id === session.user.id`;
4. wywołać `supabaseConnection.client.auth.admin.deleteUser(session.user.id)`;
5. zamienić błędy Auth i Admin API na kontrolowany błąd bez haseł, tokenów i
   pełnych komunikatów dostawcy.

Klient ponownej weryfikacji nie zapisuje sesji ani nie zmienia ciasteczek
bieżącego żądania.

- [ ] **Step 4: Uruchomić testy warstwy Supabase**

Run:

```powershell
node --test --test-isolation=none test/server.test.js
```

Expected: wszystkie testy `PASS`.

- [ ] **Step 5: Zapisać checkpoint**

```powershell
git add server.js test/server.test.js
git commit -m "feat: delete authenticated Supabase users"
git push
```

---

### Task 3: Endpoint i bezpieczna obsługa sesji

**Files:**
- Modify: `server.js:1280-1380`
- Modify: `test/server.test.js`

**Interfaces:**
- Consumes: `DELETE /api/account` z JSON `{ password, confirmation }`
- Produces: `204 No Content` po sukcesie oraz kontrolowany `400`, `401` albo `500` przy błędzie

- [ ] **Step 1: Dodać testy endpointu**

Testy mają sprawdzić:

- żądanie bez sesji zwraca `401`;
- błędna fraza zwraca `400` bez wywołania Admin API;
- błędne hasło zwraca `400` bez wywołania Admin API;
- poprawne żądanie usuwa bieżącego użytkownika i zwraca `204`;
- odpowiedź nie zawiera e-maila, hasła, tokenu ani identyfikatora sekretnego klienta;
- sukces czyści oba ciasteczka sesji.

- [ ] **Step 2: Uruchomić test i potwierdzić porażkę**

Run:

```powershell
node --test --test-isolation=none test/server.test.js
```

Expected: nowe przypadki `FAIL`, ponieważ router nie obsługuje jeszcze ścieżki.

- [ ] **Step 3: Dodać trasę przed trasami magazynu**

Router ma:

1. zaakceptować tylko metodę `DELETE` i ścieżkę `/api/account`;
2. pobrać sesję przez istniejący mechanizm `getSession`;
3. przeczytać body z istniejącym limitem;
4. wywołać `validateAccountDeletionInput` i `deleteSupabaseAccount`;
5. wyczyścić sesję przez istniejącą funkcję cookie;
6. odpowiedzieć `204` bez body.

Żądanie nie przyjmuje `user_id`, a kontrola `Origin` i wymaganie JSON pozostają
aktywne zgodnie z istniejącym routerem.

- [ ] **Step 4: Uruchomić pełne testy backendu**

Run:

```powershell
npm run check
```

Expected: wszystkie testy `PASS`.

- [ ] **Step 5: Zapisać checkpoint**

```powershell
git add server.js test/server.test.js
git commit -m "feat: add account deletion endpoint"
git push
```

---

### Task 4: Sekcja usuwania konta w interfejsie

**Files:**
- Modify: `index.html:145-155`
- Modify: `app.js:1-220, 1580-1760, 1820-1905`
- Modify: `styles.css:560-620`
- Modify: `test/client-policy.test.js`

**Interfaces:**
- Consumes: `DELETE /api/account` oraz `ACCOUNT_DELETION_PHRASE`
- Produces: formularz z polami `account-delete-password` i `account-delete-confirmation`

- [ ] **Step 1: Dodać kontrakt resetu lokalnego stanu**

Rozszerzyć testy klienta o funkcję lub czysty fragment polityki, który po
udanym usunięciu przyjmuje stan `{ authenticated: true, yarns: [...] }` i zwraca
stan gościa `{ authenticated: false, yarns: [], activeView: "account" }`.

- [ ] **Step 2: Uruchomić test klienta i potwierdzić porażkę**

Run:

```powershell
node --test --test-isolation=none test/client-policy.test.js
```

Expected: `FAIL`, ponieważ kontrakt resetu nie jest jeszcze dostępny.

- [ ] **Step 3: Dodać dostępny formularz w widoku konta**

Formularz ma zawierać:

```html
<section class="account-danger-zone" aria-labelledby="deleteAccountTitle">
  <h3 id="deleteAccountTitle">Usuń konto</h3>
  <p>Ta operacja trwale usuwa konto i wszystkie zapisane włóczki.</p>
  <label for="account-delete-password">Twoje hasło</label>
  <input id="account-delete-password" name="password" type="password" autocomplete="current-password" required />
  <label for="account-delete-confirmation">Wpisz: USUŃ KONTO</label>
  <input id="account-delete-confirmation" name="confirmation" autocomplete="off" required />
  <button class="button button--danger" type="submit">Usuń konto bezpowrotnie</button>
</section>
```

Sekcja jest widoczna wyłącznie po zalogowaniu, ma własny komunikat statusu,
blokadę podczas wysyłania i kontrolkę pokaż/ukryj hasło zgodną z istniejącym
mechanizmem formularzy Auth.

- [ ] **Step 4: Podłączyć pojedyncze żądanie destrukcyjne**

Obsługa formularza ma wysłać dokładnie jedno żądanie `DELETE` z JSON-em,
wyłączyć przycisk do końca odpowiedzi i nie używać ogólnego retry z funkcji
odczytów. Po `204` ma wyczyścić lokalny magazyn, wyzerować wersję magazynu,
ustawić `isAuthenticated = false`, odświeżyć nawigację i przejść do widoku
konta. Po błędzie formularz pozostaje z wpisanymi danymi do poprawy.

- [ ] **Step 5: Dodać style stanów i responsywności**

Sekcja ma wyraźnie odróżniać się od zwykłych akcji, ale zachować kontrast,
focus-visible i minimalny obszar dotyku 44×44 px. Na telefonie pola i przycisk
układają się w jedną kolumnę.

- [ ] **Step 6: Uruchomić kontrolę frontendową**

Run:

```powershell
npm run check
```

Expected: składnia poprawna i wszystkie testy `PASS`.

- [ ] **Step 7: Zapisać checkpoint**

```powershell
git add index.html app.js styles.css test/client-policy.test.js
git commit -m "feat: add irreversible account deletion flow"
git push
```

---

### Task 5: Dokumentacja i weryfikacja końcowa

**Files:**
- Modify: `SPEC.md`
- Modify: `README.md`
- Modify: `CHANGELOG.txt`
- Modify: `VERSION`

- [ ] **Step 1: Uzupełnić dokumentację aktualnego API**

Dodać `DELETE /api/account` do tabel API oraz opisać, że wymaga aktywnej sesji,
ponownego hasła i frazy potwierdzającej. Opisać, że usuwane są konto, profil i
włóczki, a katalog wzorów pozostaje wspólny.

- [ ] **Step 2: Uzupełnić log zmian i wersję**

Dodać wpis o usuwaniu konta do sekcji wersji rozwojowej i zwiększyć wersję
zgodnie z istniejącym formatem alpha.

- [ ] **Step 3: Uruchomić pełną kontrolę**

Run:

```powershell
npm run check
git diff --check
```

Expected: wszystkie testy `PASS`, brak błędów składni i brak białych znaków
na końcach linii.

- [ ] **Step 4: Sprawdzić lokalny przepływ bez usuwania prawdziwego konta**

W przeglądarce sprawdzić widoczność sekcji, walidację frazy, błędne hasło,
blokadę wielokrotnego kliknięcia i zachowanie po błędzie sieciowym. Nie
wykonywać destrukcyjnego usunięcia na produkcyjnym ani głównym koncie.

- [ ] **Step 5: Zapisać końcowy checkpoint**

```powershell
git add SPEC.md README.md CHANGELOG.txt VERSION
git commit -m "docs: document account deletion flow"
git push
```
