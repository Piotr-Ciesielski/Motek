# Wspólne materiały włóczek — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formularz motka i katalog wzorów mają używać jednej listy materiałów, a motek może zawierać kilka składników.

**Architecture:** Nowy moduł `material-policy.js` będzie jedynym źródłem nazw i reguł dopasowania. API oraz Supabase przejdą z pojedynczego `material` na tablicę `materials`, a frontend zbuduje dostępny wybór wielokrotny z tego samego modułu.

**Tech Stack:** JavaScript, Node.js `node:test`, HTML/CSS, PostgreSQL/Supabase

## Global Constraints

- Materiały wybieralne: `wełna`, `alpaka`, `moher`, `kaszmir`, `angora`, `jak`, `bawełna`, `len`, `bambus`, `wiskoza`, `jedwab`, `poliamid`, `poliester`, `akryl`, `mieszanka`.
- Włóczka ma od 1 do 15 unikalnych materiałów.
- `dowolny materiał` nie jest wartością zapisywaną w magazynie.
- Dotychczasowe wartości zostają zachowane jako jednoelementowe tablice.
- Katalog nadal pokazuje dynamicznie tylko materiały występujące we wzorach.
- Zmiana zdalnej bazy wymaga osobnej zgody właścicielki produktu.
- Każdy commit wymaga osobnej zgody właścicielki produktu.

---

### Task 1: Jedno źródło listy materiałów

**Files:**
- Create: `material-policy.js`
- Create: `test/material-policy.test.js`
- Modify: `index.html`
- Modify: `server.js`

**Interfaces:**
- Produces: `MATERIALS: readonly { value: string, label: string }[]`
- Produces: `normalizeYarnMaterials(value: unknown) -> string[]`
- Produces: `isAllowedYarnMaterial(value: string) -> boolean`
- Produces: `matchesMaterialRule(yarnMaterials: string[], rule: object) -> boolean`
- Produces: `matchesPatternMaterialFilter(patternMaterials: string[], selected: string) -> boolean`

- [ ] **Step 1: Napisać czerwone testy listy, normalizacji i reguł**

W `test/material-policy.test.js` dodać testy:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  MATERIALS,
  normalizeYarnMaterials,
  matchesMaterialRule,
  matchesPatternMaterialFilter,
} = require("../material-policy");

test("normalizuje kilka unikalnych materiałów w kolejności wspólnej listy", () => {
  assert.deepEqual(
    normalizeYarnMaterials(["jedwab", "wełna", "jedwab"]),
    ["wełna", "jedwab"],
  );
  assert.equal(MATERIALS.some(({ value }) => value === "dowolny materiał"), false);
});

test("rozróżnia wymaganie wszystkich, dowolnego i każdego materiału", () => {
  const yarn = ["wełna", "poliamid"];
  assert.equal(matchesMaterialRule(yarn, {
    material_match: "all",
    materials: ["wełna", "poliamid"],
  }), true);
  assert.equal(matchesMaterialRule(["wełna"], {
    material_match: "all",
    materials: ["wełna", "poliamid"],
  }), false);
  assert.equal(matchesMaterialRule(["wełna"], {
    material_match: "any",
    materials: ["wełna", "alpaka"],
  }), true);
  assert.equal(matchesMaterialRule(["akryl"], {
    material_match: "any_material",
    materials: [],
  }), true);
});

test("elastyczny wzór pasuje do każdego filtra katalogu", () => {
  assert.equal(
    matchesPatternMaterialFilter(["dowolny materiał"], "bawełna"),
    true,
  );
});
```

- [ ] **Step 2: Uruchomić test i potwierdzić właściwą porażkę**

Run:

```powershell
node --test --test-isolation=none test/material-policy.test.js
```

Expected: `FAIL`, ponieważ moduł jeszcze nie istnieje.

- [ ] **Step 3: Zaimplementować moduł UMD**

`material-policy.js` ma działać przez `require()` w Node.js i przez
`window.MotekMaterialPolicy` w przeglądarce. Lista jest zamrożona, normalizacja
odrzuca wartości spoza listy, usuwa duplikaty i przywraca ustaloną kolejność.
`matchesMaterialRule` implementuje dokładnie tryby `all`, `any` i
`any_material`.

- [ ] **Step 4: Podłączyć moduł po obu stronach**

W `index.html` załadować:

```html
<script src="/material-policy.js"></script>
<script src="/client-policy.js"></script>
<script src="/app.js"></script>
```

W `server.js` zastąpić lokalny `ALLOWED_MATERIALS` importem funkcji z
`material-policy.js`.

- [ ] **Step 5: Uruchomić test modułu**

Run:

```powershell
node --test --test-isolation=none test/material-policy.test.js
```

Expected: wszystkie testy `PASS`.

---

### Task 2: API obsługujące kilka materiałów

**Files:**
- Modify: `test/server.test.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: `body.materials: string[]`
- Produces: włóczka API z `materials: string[]`

- [ ] **Step 1: Zmienić testy API na tablicę materiałów**

Dodać przypadek:

```js
test("API zachowuje kilka materiałów motka", () => {
  const yarn = validateYarn({
    name: "Sock",
    color: "zielony",
    materials: ["wełna", "poliamid"],
    weightClass: "fingering",
    length: 400,
    weight: 100,
  });
  assert.deepEqual(yarn.materials, ["wełna", "poliamid"]);
});
```

Dodać test odrzucenia `[]`, `["nieznany"]` i `["dowolny materiał"]`.

- [ ] **Step 2: Uruchomić testy serwera i zobaczyć porażkę**

Run:

```powershell
node --test --test-isolation=none test/server.test.js
```

Expected: `FAIL`, ponieważ `validateYarn` nadal czyta pojedyncze `material`.

- [ ] **Step 3: Przenieść API na `materials`**

Zaktualizować:

- `validateYarn`,
- `normalizeSupabaseYarn`,
- `toSupabaseYarnFields`,
- pola zapytań `select`,
- parametry RPC,
- wyliczanie ETag,
- testowe atrapy Supabase.

W `module.exports` udostępnić `validateYarn`, aby test sprawdzał tę samą
walidację, której używa endpoint.

- [ ] **Step 4: Uruchomić testy serwera**

Run:

```powershell
node --test --test-isolation=none test/server.test.js
```

Expected: wszystkie testy `PASS`.

---

### Task 3: Wielokrotny wybór w formularzu

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `test/client-policy.test.js`

**Interfaces:**
- Produces: `getSelectedYarnMaterials(card: Element) -> string[]`
- Produces: `setSelectedYarnMaterials(card: Element, materials: string[]) -> void`
- Consumes: `window.MotekMaterialPolicy.MATERIALS`

- [ ] **Step 1: Dodać czerwony test formatu podsumowania**

Do `material-policy.js` zaplanować i najpierw przetestować funkcję:

```js
test("formatuje skład motka do czytelnego podsumowania", () => {
  assert.equal(formatYarnMaterials(["wełna", "poliamid"]), "Wełna, Poliamid");
  assert.equal(formatYarnMaterials([]), "Wybierz co najmniej jeden materiał");
  assert.equal(formatYarnMaterials(["mieszanka"]), "Mieszanka — skład nieokreślony");
});
```

- [ ] **Step 2: Uruchomić test i potwierdzić porażkę**

Run:

```powershell
node --test --test-isolation=none test/material-policy.test.js
```

Expected: `FAIL`, ponieważ funkcja nie istnieje.

- [ ] **Step 3: Zaimplementować formatowanie i wybór**

W szablonie motka zastąpić pojedynczy `<select data-field="material">`
rozwijaną sekcją `<details class="material-picker">` z podsumowaniem oraz
kontenerem checkboxów. `addYarnCard()` buduje checkboxy z `MATERIALS`.

`collectYarnFromCard`, `applyYarnToCard`, `isYarnComplete`,
`setYarnFieldsDisabled`, `updateYarnCardSummary` i obsługa zmiany pól mają
pracować na tablicy `materials`.

- [ ] **Step 4: Dodać style stanów**

W `styles.css` dodać widoczne:

- obramowanie i podsumowanie rozwijanej listy,
- siatkę checkboxów,
- stan fokusu klawiatury,
- komunikat błędu dla pustego wyboru,
- zawijanie długiego zestawu materiałów na urządzeniu mobilnym.

- [ ] **Step 5: Uruchomić kontrolę frontendową**

Run:

```powershell
npm run check
```

Expected: składnia poprawna i wszystkie testy `PASS`.

---

### Task 4: Migracja magazynu Supabase

**Files:**
- Create via CLI: `supabase/migrations/<timestamp>_expand_yarn_materials.sql`
- Modify: `test/supabase.test.js`

**Interfaces:**
- Database: `public.yarns.materials text[] not null`
- RPC: `public.insert_yarn_with_limit(text, text, text[], text, integer, integer)`

- [ ] **Step 1: Sprawdzić CLI i utworzyć plik poprawną komendą**

Run:

```powershell
supabase --version
supabase migration new expand_yarn_materials
```

Expected: CLI wypisuje dokładną ścieżkę nowej migracji. Nie tworzyć nazwy
pliku ręcznie.

- [ ] **Step 2: Dodać test kontraktu zapytań Supabase**

Testy atrap mają oczekiwać:

```js
{
  p_name: "Sock",
  p_color: "zielony",
  p_materials: ["wełna", "poliamid"],
  p_weight_class: "fingering",
  p_length_meters: 400,
  p_weight_grams: 100,
}
```

- [ ] **Step 3: Napisać migrację zachowującą dane**

Migracja ma:

1. usunąć stare ograniczenie pojedynczego materiału;
2. zmienić nazwę kolumny `material` na `materials`;
3. zmienić typ na `text[]` przez `using array[materials]`;
4. dodać ograniczenie `cardinality(materials) between 1 and 15`;
5. ograniczyć elementy operatorem `<@` do wspólnej listy 15 wartości;
6. usunąć starą wersję RPC z parametrem `p_material text`;
7. utworzyć wersję RPC z `p_materials text[]`;
8. odtworzyć minimalne uprawnienia `authenticated` i `service_role`;
9. pozostawić RLS i polityki bez rozszerzania dostępu.

- [ ] **Step 4: Zweryfikować migrację lokalnie**

Run:

```powershell
supabase db reset
supabase migration list --local
npm run check
```

Expected:

- wszystkie migracje zastosowane,
- istniejący testowy materiał ma postać jednoelementowej tablicy,
- nowa mieszanka przechowuje kilka wartości,
- wszystkie testy `PASS`.

- [ ] **Step 5: Poprosić o zgodę na zmianę zdalnego Supabase**

Przed `supabase db push` przedstawić pełną informację o zakresie, ryzyku
i możliwości cofnięcia zgodnie z `AGENTS.md`.

- [ ] **Step 6: Po zgodzie zastosować i zweryfikować migrację**

Run:

```powershell
supabase db push
supabase migration list
```

Następnie wykonać zapytania tylko do metadanych:

```sql
select data_type, udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'yarns'
  and column_name = 'materials';
```

Expected: `data_type = ARRAY`, `udt_name = _text`.

---

### Task 5: Spójny filtr katalogu

**Files:**
- Modify: `client-policy.js`
- Modify: `app.js`
- Modify: `test/client-policy.test.js`

**Interfaces:**
- Consumes: `matchesPatternMaterialFilter(patternMaterials, selected)`
- Produces: dynamiczne opcje bez sentinela `dowolny materiał`

- [ ] **Step 1: Napisać czerwone testy wildcardu**

Test ma potwierdzić, że wzór `["dowolny materiał"]`:

- pojawia się po filtrze `bawełna`,
- pojawia się po filtrze `wełna`,
- podbija liczniki obu materiałów,
- nie tworzy opcji `dowolny materiał`.

- [ ] **Step 2: Uruchomić test i potwierdzić porażkę**

Run:

```powershell
node --test --test-isolation=none test/client-policy.test.js
```

Expected: obecna polityka dokładnego `includes()` nie spełnia testu.

- [ ] **Step 3: Użyć wspólnej polityki**

`matchesPatternFilters` ma delegować dopasowanie do
`matchesPatternMaterialFilter`. Budowanie opcji ma pobierać wartości z
`MATERIALS`, zachować dynamiczne liczniki i pominąć sentinel.

- [ ] **Step 4: Pełna weryfikacja**

Run:

```powershell
npm run check
```

W przeglądarce sprawdzić:

- wybór kilku materiałów motka,
- zapis, odświeżenie i edycję,
- filtr konkretnego materiału,
- widoczność elastycznego wzoru pod każdym materiałem,
- obsługę klawiaturą oraz telefoniczny układ listy.

- [ ] **Step 5: Zaproponować checkpoint Git**

Po zgodzie właścicielki produktu:

```powershell
git add material-policy.js test/material-policy.test.js test/server.test.js test/client-policy.test.js test/supabase.test.js index.html app.js client-policy.js server.js styles.css supabase/migrations
git commit -m "feat: unify yarn and pattern materials"
```
