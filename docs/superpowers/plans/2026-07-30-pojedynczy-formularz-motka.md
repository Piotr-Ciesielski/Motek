# Pojedynczy formularz motka — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wielokrotne kliknięcie `+ Dodaj motek` ma wskazywać jeden istniejący formularz zamiast tworzyć kolejne.

**Architecture:** Decyzja „użyj istniejącego albo utwórz nowy” trafi do testowalnej funkcji w `client-policy.js`. Oba przyciski wejściowe nadal uruchamiają jeden handler w `app.js`.

**Tech Stack:** JavaScript, DOM, Node.js `node:test`

## Global Constraints

- W magazynie może istnieć najwyżej jeden niezapisany nowy motek.
- Istniejący formularz i wpisane dane nie mogą zostać zastąpione.
- Ponowne kliknięcie przewija do formularza i ustawia fokus w polu nazwy.
- Nie dodajemy nowej zależności testowej ani biblioteki DOM.
- Każdy commit wymaga osobnej zgody właścicielki produktu.

---

### Task 1: Idempotentne otwieranie formularza

**Files:**
- Modify: `test/client-policy.test.js`
- Modify: `client-policy.js`
- Modify: `app.js`

**Interfaces:**
- Produces: `ensureSingleNewYarnCard(cards: Iterable<object>, createCard: () => object) -> { card: object, created: boolean }`
- Consumes: elementy z `dataset.saved`, `addYarnCard()` i `yarnList.querySelectorAll()`

- [ ] **Step 1: Napisać czerwony test dwóch kliknięć**

W `test/client-policy.test.js` dodać import `ensureSingleNewYarnCard` i test:

```js
test("wielokrotne dodawanie wskazuje jeden formularz nowego motka", () => {
  const cards = [];
  let createdCards = 0;
  const createCard = () => {
    const card = { dataset: { saved: "false" } };
    cards.push(card);
    createdCards += 1;
    return card;
  };

  const first = ensureSingleNewYarnCard(cards, createCard);
  const second = ensureSingleNewYarnCard(cards, createCard);

  assert.equal(createdCards, 1);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.card, first.card);
});
```

- [ ] **Step 2: Uruchomić test i potwierdzić właściwą porażkę**

Run:

```powershell
node --test --test-isolation=none test/client-policy.test.js
```

Expected: `FAIL`, ponieważ `ensureSingleNewYarnCard` nie jest jeszcze eksportowane.

- [ ] **Step 3: Dodać minimalną funkcję polityki**

W `client-policy.js` dodać:

```js
function ensureSingleNewYarnCard(cards, createCard) {
  const existing = [...cards].find((card) => card?.dataset?.saved !== "true");
  return existing
    ? { card: existing, created: false }
    : { card: createCard(), created: true };
}
```

Dodać funkcję do obiektu zwracanego przez moduł.

- [ ] **Step 4: Uruchomić test jednostkowy i potwierdzić zielony wynik**

Run:

```powershell
node --test --test-isolation=none test/client-policy.test.js
```

Expected: wszystkie testy w pliku `PASS`.

- [ ] **Step 5: Podłączyć funkcję do przycisku**

W destrukturyzacji `window.MotekClientPolicy` w `app.js` dodać
`ensureSingleNewYarnCard`. Handler `addYarnBtn` zmienić na:

```js
addYarnBtn.addEventListener("click", () => {
  const { card, created } = ensureSingleNewYarnCard(
    yarnList.querySelectorAll(".yarn-card"),
    () => {
      yarnList.querySelector(".yarn-empty-state")?.remove();
      onboarding.hidden = true;
      return addYarnCard({}, { isNew: true });
    },
  );

  if (!created) {
    setStorageMessage("Formularz nowego motka jest już otwarty.");
  }
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.querySelector('[data-field="name"]').focus();
});
```

Przycisk onboardingu pozostaje delegowany przez `addYarnBtn.click()`.

- [ ] **Step 6: Uruchomić pełną kontrolę automatyczną**

Run:

```powershell
npm run check
```

Expected: składnia poprawna i wszystkie testy `PASS`.

- [ ] **Step 7: Sprawdzić zachowanie w przeglądarce**

Po zalogowaniu:

1. kliknąć `+ Dodaj motek` co najmniej pięć razy;
2. potwierdzić, że istnieje jedna nowa karta;
3. wpisać nazwę i ponownie kliknąć przycisk;
4. potwierdzić zachowanie tekstu i fokus w tym samym formularzu;
5. anulować, kliknąć ponownie i potwierdzić utworzenie nowej karty.

- [ ] **Step 8: Zaproponować checkpoint Git**

Po zgodzie właścicielki produktu:

```powershell
git add client-policy.js app.js test/client-policy.test.js
git commit -m "fix: keep one new yarn form open"
```

Expected: osobny, działający checkpoint poprawki formularza.
