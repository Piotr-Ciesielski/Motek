# Dokładne dopasowanie wzorów — plan wdrożenia

**Status:** ukończony. Kontrakt v2, ranking, dane katalogu, migracje, dokumentacja i testy zostały zrealizowane.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Automatyczne dopasowanie ma wiernie obsługiwać rzeczywiste wymagania wzorów oraz pierwsze trzy zweryfikowane PDF-y.

**Architecture:** Wymagania pozostają wersjonowanym dokumentem JSON w `patterns.matching_requirements`, lecz każdy rozmiar i wariant włóczki jest płaskim kandydatem. Czysty moduł `matching-policy.js` odpowiada za walidację, normalizację i przydział motków, a serwer tylko pobiera dane i buduje odpowiedź API.

**Tech Stack:** JavaScript, Node.js `node:test`, PostgreSQL JSONB/Supabase, istniejący importer PDF

## Global Constraints

- Dokument wymagań ma `version: 2`.
- Wariant ma od 1 do 8 ról `requirements`.
- Każda rola używa `measurement_basis: "meters"` albo `"grams"`.
- Wymagana jest tylko minimalna wartość jednostki wskazanej przez `measurement_basis`.
- Materiały korzystają wyłącznie ze wspólnej polityki.
- Ten sam rekord magazynu nie może być użyty w dwóch rolach.
- Domyślnie motki jednej roli muszą mieć ten sam kolor.
- Dane wyliczone muszą wynikać jednoznacznie z PDF-u.
- Zmiana zdalnego Supabase i import danych wymagają osobnych zgód.
- Realizacja odbywa się bez subagentów, punkt po punkcie.
- Każdy commit wymaga osobnej zgody właścicielki produktu.

---

### Task 1: Kontrakt i walidacja dokumentu wersji 2

**Files:**
- Create: `matching-policy.js`
- Create: `test/matching-policy.test.js`
- Modify: `limits.js`

**Interfaces:**
- Consumes: `matching_requirements` w formacie wersji 2
- Produces: `normalizeMatchingDocument(value: unknown) -> NormalizedVariant[]`
- Produces: `validateMatchingDocument(value: unknown, context?: string) -> void`
- Produces: `MatchingRequirement` z polami camelCase

- [x] **Step 1: Napisać czerwone testy znanej i brakującej jednostki**

W `test/matching-policy.test.js` dodać:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeMatchingDocument,
  validateMatchingDocument,
} = require("../matching-policy");

const metersVariant = {
  version: 2,
  variants: [{
    id: "M-safran",
    label: "M — DROPS Safran",
    size: "M",
    yarn_option: "DROPS Safran",
    requirements: [{
      role: "główna",
      measurement_basis: "meters",
      meters_min: 960,
      grams_min: 300,
      skeins_min: 6,
      materials: ["bawełna"],
      material_match: "all",
      color_mode: "same",
      weight_classes: ["sport"],
    }],
  }],
};

test("przyjmuje metry jako podstawę i zachowuje pomocnicze gramy", () => {
  const [variant] = normalizeMatchingDocument(metersVariant);
  assert.equal(variant.requirements[0].measurementBasis, "meters");
  assert.equal(variant.requirements[0].metersMin, 960);
  assert.equal(variant.requirements[0].gramsMin, 300);
});

test("nie wymaga metrów, gdy PDF podaje gramy", () => {
  assert.doesNotThrow(() => validateMatchingDocument({
    version: 2,
    variants: [{
      id: "kolory",
      label: "S/M/L — wspólne zużycie",
      requirements: [{
        role: "kolor główny",
        measurement_basis: "grams",
        grams_min: 35,
        materials: [],
        material_match: "any_material",
        color_mode: "same",
        weight_classes: ["fingering"],
      }],
    }],
  }));
});

test("odrzuca rolę bez wartości podstawowej", () => {
  const invalid = structuredClone(metersVariant);
  delete invalid.variants[0].requirements[0].meters_min;
  assert.throws(() => validateMatchingDocument(invalid), /meters_min/);
});
```

- [x] **Step 2: Uruchomić test i potwierdzić porażkę z braku modułu**

Run:

```powershell
node --test --test-isolation=none test/matching-policy.test.js
```

Expected: `FAIL`, ponieważ `matching-policy.js` nie istnieje.

- [x] **Step 3: Zaimplementować walidację i normalizację**

Moduł ma:

- przyjmować wyłącznie `version: 2`;
- wymagać niepustej tablicy `variants`;
- wymagać unikalnych `id`;
- ograniczać warianty i role wartościami z `limits.js`;
- walidować `_min` jako dodatnią liczbę całkowitą;
- walidować `_max` jako liczbę nie mniejszą od `_min`;
- wymagać jednostki wskazanej przez `measurement_basis`;
- walidować `material_match`, `color_mode`, materiały i grubości;
- zachowywać opcjonalne `size`, `yarn_option`, `strand_count`,
  `held_together_group` i `distinct_color_group`.

- [x] **Step 4: Uruchomić testy walidacji**

Run:

```powershell
node --test --test-isolation=none test/matching-policy.test.js
```

Expected: wszystkie przypadki `PASS`.

---

### Task 2: Przydział ilości, materiałów i kolorów

**Files:**
- Modify: `test/matching-policy.test.js`
- Modify: `matching-policy.js`

**Interfaces:**
- Produces: `allocateVariantRequirements(requirements, yarns) -> object[][] | null`
- Produces: `matchVariant(variant, yarns) -> { doable: boolean, allocation: object[][], coverage: number }`
- Consumes: włóczka `{ id, color, materials, weightClass, length, weight }`

- [x] **Step 1: Napisać czerwony test roli mierzonej tylko w metrach**

```js
test("dopasowuje rolę na podstawie metrów bez wymagania gramów", () => {
  const requirement = {
    role: "główna",
    measurementBasis: "meters",
    metersMin: 400,
    materials: ["wełna"],
    materialMatch: "all",
    colorMode: "same",
    weightClasses: ["fingering"],
  };
  const yarns = [
    { id: 1, color: "granat", materials: ["wełna"], weightClass: "fingering", length: 250, weight: 50 },
    { id: 2, color: "Granat ", materials: ["wełna"], weightClass: "fingering", length: 200, weight: 40 },
  ];
  assert.equal(matchVariant({ requirements: [requirement] }, yarns).doable, true);
});
```

- [x] **Step 2: Napisać czerwony test kilku ról i odrębnych kolorów**

```js
test("nie używa jednego motka dwa razy i wymaga różnych kolorów kontrastowych", () => {
  const requirements = ["MC", "CC1", "CC2"].map((role) => ({
    role,
    measurementBasis: "grams",
    gramsMin: 10,
    materials: [],
    materialMatch: "any_material",
    colorMode: "same",
    distinctColorGroup: "holly",
    weightClasses: ["fingering"],
  }));
  const sameColors = [1, 2, 3].map((id) => ({
    id,
    color: "czerwony",
    materials: ["wełna"],
    weightClass: "fingering",
    length: 100,
    weight: 50,
  }));
  assert.equal(matchVariant({ requirements }, sameColors).doable, false);
});
```

- [x] **Step 3: Uruchomić testy i potwierdzić porażkę**

Run:

```powershell
node --test --test-isolation=none test/matching-policy.test.js
```

Expected: `FAIL`, ponieważ przydział nie istnieje.

- [x] **Step 4: Zaimplementować przydział**

Algorytm:

1. filtruje motki według `matchesMaterialRule` i grubości;
2. dla `color_mode: "same"` grupuje je po `color.trim().toLocaleLowerCase("pl")`;
3. sumuje `length` albo `weight` zgodnie z `measurementBasis`;
4. szuka najmniejszej grupy osiągającej minimum;
5. oznacza użyte indeksy, zanim przejdzie do następnej roli;
6. pilnuje różnych kolorów we wspólnym `distinctColorGroup`;
7. zatrzymuje wyszukiwanie po `maxMatchSearchNodes`.

- [x] **Step 5: Uruchomić testy dopasowania**

Run:

```powershell
node --test --test-isolation=none test/matching-policy.test.js
```

Expected: wszystkie testy `PASS`, w tym brak ponownego użycia motka.

---

### Task 3: Importer i walidacja Supabase

**Files:**
- Modify: `test/pattern-validation.test.js`
- Modify: `scripts/import-patterns.js`
- Modify: `scripts/build-pattern-import.py`
- Create via CLI: `supabase/migrations/<timestamp>_validate_pattern_matching_v2.sql`

**Interfaces:**
- Importer używa `validateMatchingDocument`
- Trigger bazy akceptuje wyłącznie dokument wersji 2

- [x] **Step 1: Zmienić test importera na wersję 2**

Dobry przypadek ma zawierać `version: 2`, wariant i niepustą tablicę
`requirements`. Złe przypadki mają sprawdzać:

- brak jednostki podstawowej,
- nieznany materiał,
- pustą tablicę ról,
- więcej niż osiem ról,
- powtórzone `id`.

- [x] **Step 2: Uruchomić test i potwierdzić porażkę starego walidatora**

Run:

```powershell
node --test --test-isolation=none test/pattern-validation.test.js
```

Expected: `FAIL`, ponieważ importer oczekuje pól wersji 1.

- [x] **Step 3: Delegować walidację do wspólnego modułu**

`scripts/import-patterns.js` ma importować `validateMatchingDocument`, dodać
nazwę pliku do komunikatu kontekstowego i usunąć powieloną walidację wersji 1.

`scripts/build-pattern-import.py` ma generować pusty dokument:

```json
{"version": 2, "variants": []}
```

Pusta lista pozostaje dozwolona wyłącznie dla wzorów, które jeszcze nie
uczestniczą w dopasowaniu; każdy istniejący wariant musi być kompletny.

- [x] **Step 4: Utworzyć migrację przez CLI**

Run:

```powershell
supabase migration new validate_pattern_matching_v2
```

Expected: CLI tworzy i wypisuje dokładną ścieżkę pliku.

- [x] **Step 5: Zastąpić trigger walidacją wersji 2**

Funkcja `public.validate_pattern_matching_requirements()` ma:

- sprawdzić obiekt, `version = 2` i tablicę `variants`;
- ograniczyć warianty do 250;
- dla każdego wariantu sprawdzić tekstowe `id`, `label`, opcjonalne metadane
  oraz od 1 do 8 ról;
- dla każdej roli sprawdzić podstawę pomiaru, zakresy liczbowe, materiały,
  tryb materiału, tryb koloru i grubości;
- pozwolić na `variants: []`;
- pozostać `security invoker`;
- mieć odebrane wykonanie od `public`, `anon` i `authenticated`, a przyznane
  `service_role`.

- [x] **Step 6: Zweryfikować lokalnie**

Run:

```powershell
supabase db reset
node --test --test-isolation=none test/pattern-validation.test.js
npm run patterns:check
```

Expected: migracja i walidatory przyjmują ten sam kontrakt.

---

### Task 4: Integracja serwera i wyników

**Files:**
- Modify: `test/server.test.js`
- Modify: `server.js`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- Server consumes: `normalizeMatchingDocument`, `matchVariant`
- API produces: wynik z `requirements` oraz `allocation`
- UI displays: rozmiar, opcję włóczki, role i wymagane ilości

- [x] **Step 1: Napisać czerwony test odpowiedzi dla wersji 2**

Test serwera ma przekazać wariant z rolą mierzoną tylko w gramach i oczekiwać,
że `normalizeCatalogPattern()` zachowa wariant zamiast go odrzucić.

- [x] **Step 2: Uruchomić test i potwierdzić porażkę**

Run:

```powershell
node --test --test-isolation=none test/server.test.js
```

Expected: stary normalizator wymaga `yarns_needed`, metrów i gramów.

- [x] **Step 3: Zastąpić starą logikę wspólnym modułem**

W `server.js`:

- usunąć lokalne normalizatory wersji 1;
- użyć `normalizeMatchingDocument` w `normalizeCatalogPattern`;
- użyć `matchVariant` w `getSupabaseMatches`;
- zachować limit wariantów i węzłów wyszukiwania;
- zwracać tylko wykonalne warianty;
- do wyniku dołączyć przydzielone motki per rola bez danych innych
  użytkowników.

- [x] **Step 4: Zmienić prezentację wyniku**

`app.js` ma dla każdego wariantu pokazać:

- rozmiar,
- nazwę alternatywnej włóczki,
- każdą rolę osobno,
- minimum lub zakres metrów/gramów,
- pomocniczą liczbę motków,
- liczbę nitek trzymanych razem.

Nie pokazywać brakującej jednostki jako `0`.

- [x] **Step 5: Uruchomić testy i kontrolę składni**

Run:

```powershell
npm run check
```

Expected: wszystkie testy `PASS`.

---

### Task 5: Trzy rzeczywiste wzory

**Files:**
- Modify: `data/pattern-manual-overrides.json`
- Modify mechanically: `data/patterns-import.json`
- Verify: `Wzory/Kopia pliku na_pole_wzor.pdf`
- Verify: `Wzory/HollyBerryCharitySocks.pdf`
- Verify: `Wzory/Oslohuen_2.0_ENGELSK.pdf`

**Interfaces:**
- Produces: 21 rzeczywistych wariantów wersji 2
- Consumes: dane PDF i istniejące zweryfikowane parametry włóczek

- [x] **Step 1: Ponownie sprawdzić strony źródłowe**

Użyć istniejących renderów lub wyrenderować odpowiednie strony. Wzrokowo
potwierdzić:

- `Na Pole Tee`: rozmiary `XS, S, M, L, XL, XXL`, odpowiednio
  `5, 5, 6, 7, 8, 9` motków Safran i `6, 6, 7, 8, 9, 10` Bamboo Queen;
- `Holly Berry`: `35 g` MC, `26 g` CC1 i `10 g` CC2 oraz wspólne zużycie
  dla podanych rozmiarów;
- `Oslo Hat`: rozmiary `XS, S, M, L`, `100, 150, 150, 150 g`, dwie nitki
  i dwie alternatywy nawoju.

- [x] **Step 2: Dodać Na Pole Tee**

Utworzyć 12 wariantów:

| Rozmiar | Safran: motki / g / m | Bamboo Queen: motki / g / m |
|---|---:|---:|
| XS | 5 / 250 / 800 | 6 / 300 / 750 |
| S | 5 / 250 / 800 | 6 / 300 / 750 |
| M | 6 / 300 / 960 | 7 / 350 / 875 |
| L | 7 / 350 / 1120 | 8 / 400 / 1000 |
| XL | 8 / 400 / 1280 | 9 / 450 / 1125 |
| XXL | 9 / 450 / 1440 | 10 / 500 / 1250 |

Podstawa: `meters`; materiały Safran `["bawełna"]`, Bamboo Queen
`["bawełna", "bambus"]`; tryb `all`; grubość `sport`; kolor `same`.

- [x] **Step 3: Dodać Holly Berry Charity Socks**

Utworzyć jeden wariant `S/M/L — zużycie podane wspólnie` z trzema rolami:

- MC: `35 g`,
- CC1: `26 g`,
- CC2: `10 g`.

Podstawa: `grams`; materiał `any_material`; grubość `fingering`; kolor
`same`; wszystkie role mają `distinct_color_group: "holly-colors"`.

- [x] **Step 4: Dodać Oslo Hat**

Utworzyć osiem wariantów:

| Rozmiar | Arwetta: motki / g / m | Sunday: motki / g / m |
|---|---:|---:|
| XS | 2 / 100 / 420 | 2 / 100 / 470 |
| S | 3 / 150 / 630 | 3 / 150 / 705 |
| M | 3 / 150 / 630 | 3 / 150 / 705 |
| L | 3 / 150 / 630 | 3 / 150 / 705 |

Podstawa: `meters`; `strand_count: 2`; Arwetta wymaga
`["wełna", "poliamid"]`, Sunday `["wełna"]`; tryb `all`; grubość
`fingering`; kolor `same`.

- [x] **Step 5: Zbudować import mechanicznie**

Run:

```powershell
python scripts\build-pattern-import.py
npm run patterns:check
```

Expected:

- 106 rekordów,
- 0 rekordów `needs_review`,
- dokładnie 21 rzeczywistych wariantów w trzech wzorach,
- brak błędów walidacji.

- [x] **Step 6: Dodać test danych katalogu**

W `test/pattern-catalog-data.test.js` sprawdzić:

- 12 wariantów `Na Pole Tee`,
- 1 wariant z trzema rolami `Holly Berry`,
- 8 wariantów `Oslo Hat`,
- brak materiałów spoza wspólnej polityki z wyjątkiem sentinela
  `dowolny materiał` w danych opisowych.

- [x] **Step 7: Uruchomić pełną kontrolę**

Run:

```powershell
npm run check
npm run patterns:check
git diff --check
```

Expected: wszystkie kontrole `PASS`.

---

### Task 6: Zdalna baza, przeglądarka i wersja

**Files:**
- Modify: `VERSION`
- Modify: `package.json`
- Modify: `CHANGELOG.txt`
- Modify: `docs/PATTERN-CATALOG.md`
- Modify: `docs/UX-UI-ROADMAP.md`

**Interfaces:**
- Release: `2.0.0-alpha.35`

- [x] **Step 1: Poprosić o zgodę na migrację i import**

Wyjaśnić osobno:

- zmianę struktury `yarns.materials`,
- zachowanie obecnych danych,
- aktualizację walidatora JSON,
- import 21 wariantów do trzech istniejących rekordów.

- [x] **Step 2: Po zgodzie zastosować migracje i import**

Run:

```powershell
supabase db push
npm run patterns:import
```

Expected: migracje zastosowane i trzy rekordy zaktualizowane bez zmiany liczby
wzorów.

- [x] **Step 3: Zweryfikować zdalne dane**

Sprawdzić:

- typ `yarns.materials`,
- brak utraconych rekordów magazynu,
- 106 wzorów,
- 0 `needs_review`,
- 21 wariantów w trzech wzorach,
- brak dokumentów matching w wersji 1.

- [x] **Step 4: Sprawdzić aplikację w przeglądarce**

Scenariusze:

1. motek z `wełna + poliamid` dopasowuje Arwetta, a sama wełna nie;
2. wzór elastyczny pojawia się dla dowolnego materiału;
3. Na Pole pokazuje właściwe rozmiary i obie alternatywy;
4. Holly wymaga trzech różnych kolorów;
5. Oslo pokazuje dwie nitki i właściwe zużycie;
6. wynik nie wyświetla `0 m` ani `0 g` dla nieznanej jednostki;
7. brak błędów konsoli na komputerze i telefonie.

- [x] **Step 5: Podbić wersję i dokumentację**

Ustawić `2.0.0-alpha.35`, opisać wspólne materiały, pojedynczy formularz,
matching v2 i trzy rzeczywiste wzory.

- [x] **Step 6: Wykonać końcową weryfikację**

Run:

```powershell
npm run check
npm run patterns:check
git diff --check
git status --short --branch
```

Expected: wszystkie testy `PASS`, import poprawny, brak błędów formatowania.

- [x] **Step 7: Zaproponować checkpoint Git**

Po zgodzie właścicielki produktu:

```powershell
git add matching-policy.js test/matching-policy.test.js test/pattern-validation.test.js test/pattern-catalog-data.test.js scripts/import-patterns.js scripts/build-pattern-import.py server.js app.js styles.css data/pattern-manual-overrides.json data/patterns-import.json supabase/migrations VERSION package.json CHANGELOG.txt docs/PATTERN-CATALOG.md docs/UX-UI-ROADMAP.md
git commit -m "feat: add exact real-pattern matching"
```
