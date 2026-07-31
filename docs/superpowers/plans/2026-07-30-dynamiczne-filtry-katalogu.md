# Dynamiczne filtry katalogu wzorów — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Naprawić kategorie wzorów oraz dodać dynamiczne, wzajemnie zawężające się filtry typu projektu i materiału.

**Architecture:** Końcowa kategoria wzoru będzie wyliczana dopiero po scaleniu danych automatycznych z ręcznymi poprawkami, z zachowaniem pierwszeństwa jawnego `project_type` w poprawce. Czyste funkcje filtrowania i liczenia faset trafią do `client-policy.js`; `app.js` będzie jedynie odczytywał kontrolki i renderował opcje oraz wyniki.

**Tech Stack:** JavaScript ES2022, Node.js test runner, Python 3, Supabase/Postgres, natywny HTML `<select>`.

## Global Constraints

- Wynik musi spełniać równocześnie wszystkie aktywne kryteria.
- Wzór wielomateriałowy jest dostępny pod każdym materiałem z pola `materials`.
- Typy i materiały pokazują dynamiczną liczbę wyników.
- Opcje z wynikiem zero są nieaktywne, z wyjątkiem aktualnie wybranej opcji.
- Jawny `project_type` z ręcznej poprawki ma pierwszeństwo przed klasyfikatorem.
- Aktualizacja Supabase nie może dodać ani usunąć rekordów; oczekiwany katalog ma 106 pozycji.
- Bez nowych zależności npm.
- Każda zmiana zachowania powstaje w cyklu test czerwony → minimalna poprawka → test zielony.
- Commit jest wykonywany wyłącznie po osobnej zgodzie właścicielki produktu.

---

## Struktura plików

- `scripts/build-pattern-import.py` — wybór końcowej kategorii i budowa importu.
- `scripts/pattern_taxonomy.py` — reguły automatycznego rozpoznawania kategorii.
- `scripts/report-pattern-categories.py` — raport rozkładu kategorii i listy `other`.
- `data/pattern-manual-overrides.json` — jawne wyjątki dla niejednoznacznych wzorów.
- `data/patterns-import.json` — wygenerowany katalog 106 rekordów.
- `client-policy.js` — czyste filtrowanie, etykiety typów i liczenie faset.
- `app.js` — renderowanie katalogu oraz dynamicznych opcji `<select>`.
- `test/pattern-catalog-data.test.js` — kontrola jakości końcowych kategorii.
- `test/client-policy.test.js` — testy łączenia filtrów i liczników.
- `CHANGELOG.txt`, `VERSION`, `package.json`, `package-lock.json`, `SPEC.md`, `README.md` — wersja i opis zachowania.

---

### Task 1: Ponowne wyliczanie kategorii po ręcznej korekcie danych

**Files:**
- Modify: `test/pattern-catalog-data.test.js:32-52`
- Modify: `scripts/build-pattern-import.py:172-203`
- Regenerate: `data/patterns-import.json`

**Interfaces:**
- Consumes: `infer_project_type(title: str, text: str) -> tuple[str, str]`
- Produces: `resolve_project_type(candidate: dict, override: dict) -> str`

- [ ] **Step 1: Dodać czerwony test końcowych kategorii**

Rozszerzyć `expectedTypes` o wzory, które dziś błędnie pozostają w `other`:

```js
["Na Pole Tee", "top"],
["Black Lodge Socks - wzór dziewiarski", "socks"],
["Autumn s Letter Cardigan by Amina Ali", "cardigan"],
["BABUSHKA SCARF", "shawl_scarf"],
["Bone", "vest"],
```

- [ ] **Step 2: Uruchomić test i potwierdzić właściwą porażkę**

Run:

```powershell
npm test -- test\pattern-catalog-data.test.js
```

Expected: FAIL dla co najmniej `Na Pole Tee`, ponieważ aktualna wartość to `other`.

- [ ] **Step 3: Wydzielić wybór końcowej kategorii**

W `scripts/build-pattern-import.py` dodać:

```python
def resolve_project_type(candidate: dict, override: dict) -> str:
    explicit_type = override.get("project_type")
    if explicit_type:
        return explicit_type

    final_name = override.get("name", candidate.get("name", ""))
    final_description = override.get(
        "description",
        candidate.get("description", ""),
    )
    return infer_project_type(final_name, final_description)[0]
```

W pętli budującej rekord zastąpić zachowywanie `merged.get("project_type")`
wywołaniem:

```python
override = overrides.get(source_filename, {})
merged = {**candidate, **override}
merged["source_filename"] = source_filename
merged["project_type"] = resolve_project_type(candidate, override)
```

- [ ] **Step 4: Przebudować katalog**

Run:

```powershell
python scripts\build-pattern-import.py
```

Expected:

```text
"record_count": 106
"excluded_pdf_count": 13
"needs_review_count": 0
```

- [ ] **Step 5: Uruchomić test kategorii**

Run:

```powershell
npm test -- test\pattern-catalog-data.test.js
```

Expected: PASS.

- [ ] **Step 6: Punkt kontrolny**

Sprawdzić `git diff --check` i zaproponować użytkowniczce checkpoint:

```text
fix: recalculate final pattern categories
```

Nie wykonywać commita bez osobnej zgody.

---

### Task 2: Audyt wszystkich kategorii „Inny projekt”

**Files:**
- Modify: `scripts/pattern_taxonomy.py`
- Modify: `data/pattern-manual-overrides.json`
- Modify: `test/pattern-catalog-data.test.js`
- Regenerate: `data/patterns-import.json`

**Interfaces:**
- Consumes: rekordy wygenerowane przez Task 1
- Produces: kontrolowany zbiór kategorii bez oczywistych nazw w `other`

- [ ] **Step 1: Wypisać rozkład i rekordy `other`**

Run:

```powershell
python scripts\report-pattern-categories.py
```

Jeśli skrypt nie istnieje, utworzyć `scripts/report-pattern-categories.py` jako
narzędzie tylko do odczytu:

```python
import json
from collections import Counter
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "data" / "patterns-import.json"
records = json.loads(path.read_text(encoding="utf-8"))["records"]
print(json.dumps(Counter(
    record["project_type"] for record in records
), ensure_ascii=False, indent=2))
for record in records:
    if record["project_type"] == "other":
        print(f"{record['source_filename']} | {record['name']}")
```

- [ ] **Step 2: Dodać czerwone testy dla oczywistych pomyłek**

Dla każdego jednoznacznego rekordu z raportu dodać literalną parę
`[nazwa, oczekiwany_typ]` do `expectedTypes`. Nie zmieniać rekordów naprawdę
niejednoznacznych tylko po to, aby usunąć `other`.

- [ ] **Step 3: Rozszerzyć regułę albo dodać ręczny wyjątek**

Zasada wyboru:

- wspólne słowo produktu w wielu nazwach → dopisać pełne słowo do
  `PROJECT_TYPES` w `scripts/pattern_taxonomy.py`;
- nazwa własna albo konstrukcja niejednoznaczna → dodać `project_type` do
  właściwego rekordu w `data/pattern-manual-overrides.json`.

Nie klasyfikować na podstawie luźnych fragmentów słów. Wszystkie regexy muszą
zachowywać granice `\b` albo jednoznaczny polski rdzeń.

- [ ] **Step 4: Przebudować dane i uruchomić test**

Run:

```powershell
python scripts\build-pattern-import.py
npm test -- test\pattern-catalog-data.test.js
```

Expected: 106 rekordów i PASS.

- [ ] **Step 5: Przejrzeć końcową listę `other`**

Ponownie uruchomić raport. Każdy pozostały wpis ma być rzeczywiście
niejednoznaczny albo niepasujący do dziesięciu kategorii produktu.

- [ ] **Step 6: Punkt kontrolny**

Zaproponować checkpoint:

```text
data: correct pattern catalog categories
```

Nie wykonywać commita bez osobnej zgody.

---

### Task 3: Czyste funkcje łączenia filtrów

**Files:**
- Modify: `test/client-policy.test.js`
- Modify: `client-policy.js`

**Interfaces:**
- Produces:
  - `getProjectTypeLabel(value: string) -> string`
  - `matchesPatternFilters(pattern: object, filters: object, ignoredFacet?: "type" | "material" | null) -> boolean`
  - `filterPatterns(patterns: object[], filters: object, ignoredFacet?: "type" | "material" | null) -> object[]`

- [ ] **Step 1: Dodać czerwony test kombinacji typu i materiału**

Fixture:

```js
const filterPatternsFixture = [
  {
    name: "Bawełniany top",
    description: "Letnia bluzka",
    projectType: "top",
    materials: ["bawełna", "bambus"],
    sourceLanguage: "pl",
    needsReview: false,
  },
  {
    name: "Wełniany top",
    description: "Ciepła bluzka",
    projectType: "top",
    materials: ["wełna"],
    sourceLanguage: "pl",
    needsReview: false,
  },
  {
    name: "Bawełniane skarpety",
    description: "Skarpetki",
    projectType: "socks",
    materials: ["bawełna"],
    sourceLanguage: "pl",
    needsReview: false,
  },
];
```

Test:

```js
assert.deepEqual(
  filterPatterns(filterPatternsFixture, {
    phrase: "",
    review: "verified",
    language: "all",
    type: "top",
    material: "bawełna",
  }).map((pattern) => pattern.name),
  ["Bawełniany top"],
);
```

- [ ] **Step 2: Uruchomić test i potwierdzić porażkę**

Run:

```powershell
npm test -- test\client-policy.test.js
```

Expected: FAIL, ponieważ `filterPatterns` nie jest jeszcze eksportowane.

- [ ] **Step 3: Dodać minimalną implementację**

W `client-policy.js` przenieść mapę etykiet typów z `app.js`:

```js
const PROJECT_TYPE_LABELS = {
  socks: "Skarpety",
  sweater: "Sweter",
  cardigan: "Kardigan",
  top: "Top lub bluzka",
  shawl_scarf: "Chusta lub szal",
  head_accessory: "Czapka, opaska lub komin",
  gloves: "Rękawiczki",
  vest: "Kamizelka",
  skirt_dress: "Spódnica lub sukienka",
  blanket: "Koc",
  other: "Inny projekt",
};

function getProjectTypeLabel(value) {
  return PROJECT_TYPE_LABELS[value] || PROJECT_TYPE_LABELS.other;
}
```

Następnie dodać:

```js
function matchesPatternFilters(pattern, filters, ignoredFacet = null) {
  const phrase = String(filters.phrase || "").trim().toLocaleLowerCase("pl");
  const searchable = [
    pattern.name,
    pattern.description,
    getProjectTypeLabel(pattern.projectType),
    ...(Array.isArray(pattern.materials) ? pattern.materials : []),
  ].join(" ").toLocaleLowerCase("pl");

  const matchesPhrase = !phrase || searchable.includes(phrase);
  const matchesStatus =
    filters.review === "all"
    || (filters.review === "review" && pattern.needsReview)
    || (filters.review === "verified" && !pattern.needsReview);
  const matchesLanguage =
    filters.language === "all"
    || pattern.sourceLanguage === filters.language;
  const matchesType =
    ignoredFacet === "type"
    || filters.type === "all"
    || pattern.projectType === filters.type;
  const matchesMaterial =
    ignoredFacet === "material"
    || filters.material === "all"
    || (
      Array.isArray(pattern.materials)
      && pattern.materials.includes(filters.material)
    );

  return matchesPhrase
    && matchesStatus
    && matchesLanguage
    && matchesType
    && matchesMaterial;
}

function filterPatterns(patterns, filters, ignoredFacet = null) {
  return patterns.filter((pattern) =>
    matchesPatternFilters(pattern, filters, ignoredFacet)
  );
}
```

Wyeksportować funkcje w obiekcie `policy`.

- [ ] **Step 4: Uruchomić test**

Run:

```powershell
npm test -- test\client-policy.test.js
```

Expected: PASS.

- [ ] **Step 5: Dodać test wzoru wielomateriałowego**

Sprawdzić osobno, że ten sam `Bawełniany top` przechodzi dla `bawełna` i dla
`bambus`, a nie przechodzi dla `wełna`.

- [ ] **Step 6: Uruchomić test ponownie**

Expected: PASS bez zmiany implementacji albo po minimalnej korekcie użycia
`materials.includes`.

---

### Task 4: Dynamiczne liczniki typów i materiałów

**Files:**
- Modify: `test/client-policy.test.js`
- Modify: `client-policy.js`

**Interfaces:**
- Consumes: `filterPatterns` z Task 3
- Produces:
  - `buildPatternFacetCounts(patterns: object[], filters: object) -> { types: Record<string, number>, materials: Record<string, number> }`

- [ ] **Step 1: Dodać czerwony test liczników**

```js
assert.deepEqual(
  buildPatternFacetCounts(filterPatternsFixture, {
    phrase: "",
    review: "verified",
    language: "all",
    type: "top",
    material: "bawełna",
  }),
  {
    types: { top: 1, socks: 1 },
    materials: { bawełna: 1, bambus: 1, wełna: 1 },
  },
);
```

Znaczenie:

- liczniki typów ignorują aktywny typ, ale respektują `bawełna`,
- liczniki materiałów ignorują aktywny materiał, ale respektują `top`,
- wzór bawełna+bambus zwiększa oba odpowiednie liczniki o jeden.

- [ ] **Step 2: Potwierdzić czerwony test**

Run:

```powershell
npm test -- test\client-policy.test.js
```

Expected: FAIL, brak `buildPatternFacetCounts`.

- [ ] **Step 3: Zaimplementować liczniki**

```js
function buildPatternFacetCounts(patterns, filters) {
  const typeCandidates = filterPatterns(patterns, filters, "type");
  const materialCandidates = filterPatterns(patterns, filters, "material");
  const types = {};
  const materials = {};

  typeCandidates.forEach((pattern) => {
    types[pattern.projectType] = (types[pattern.projectType] || 0) + 1;
  });
  materialCandidates.forEach((pattern) => {
    new Set(Array.isArray(pattern.materials) ? pattern.materials : [])
      .forEach((material) => {
        materials[material] = (materials[material] || 0) + 1;
      });
  });

  return { types, materials };
}
```

Wyeksportować funkcję.

- [ ] **Step 4: Uruchomić test**

Expected: PASS.

- [ ] **Step 5: Dodać test pustej kombinacji i aktywnej opcji**

Test ma potwierdzić, że liczniki mogą zwrócić zero przez brak klucza, a decyzja
o pozostawieniu aktywnej opcji należy do warstwy renderowania.

---

### Task 5: Dynamiczne opcje w interfejsie katalogu

**Files:**
- Modify: `app.js:56-63`
- Modify: `app.js:1181-1223`
- Modify: `app.js:1225-1340`
- Modify: `app.js:1903-1921`

**Interfaces:**
- Consumes:
  - `getProjectTypeLabel`
  - `filterPatterns`
  - `buildPatternFacetCounts`
- Produces:
  - `readPatternFilters() -> object`
  - `updatePatternFacetOptions(filters: object, facetCounts: object) -> void`

- [ ] **Step 1: Podłączyć eksportowane funkcje**

Dodać je do destrukturyzacji `window.MotekClientPolicy` i usunąć lokalną funkcję
`formatProjectType`, zastępując użycia przez `getProjectTypeLabel`.

- [ ] **Step 2: Dodać odczyt stanu filtrów**

```js
function readPatternFilters() {
  return {
    phrase: patternSearch.value,
    review: patternReviewFilter.value,
    language: patternLanguageFilter.value,
    type: patternTypeFilter.value,
    material: patternMaterialFilter.value,
  };
}
```

- [ ] **Step 3: Zastąpić lokalne filtrowanie**

W `renderPatternCatalog` użyć:

```js
const filters = readPatternFilters();
const facetCounts = buildPatternFacetCounts(catalogPatterns, filters);
updatePatternFacetOptions(filters, facetCounts);
const matchingPatterns = filterPatterns(catalogPatterns, filters)
  .sort(/* zachować obecną logikę sortowania */);
```

- [ ] **Step 4: Renderować opcje typu z licznikami**

Użyć stałej kolejności typów:

```js
const PROJECT_TYPE_ORDER = [
  "socks", "sweater", "cardigan", "top", "shawl_scarf",
  "head_accessory", "gloves", "vest", "skirt_dress", "blanket", "other",
];
```

Etykieta opcji:

```js
`${getProjectTypeLabel(type)} (${formatNumber(count)})`
```

Opcja jest `disabled`, gdy `count === 0 && filters.type !== type`.

- [ ] **Step 5: Renderować materiały z licznikami**

Zachować globalny, posortowany zbiór materiałów z `catalogPatterns`. Etykieta:

```js
`${material} (${formatNumber(count)})`
```

Opcja jest `disabled`, gdy `count === 0 && filters.material !== material`.
Wzór wielomateriałowy jest liczony raz dla każdego unikalnego materiału.

- [ ] **Step 6: Zachować wartości kontrolek**

Przed `replaceChildren` zapisać wartość. Po odbudowaniu ustawić ją ponownie,
jeżeli odpowiednia opcja istnieje. Nie wywoływać zdarzenia `change` programowo.

- [ ] **Step 7: Sprawdzić składnię i pełne testy**

Run:

```powershell
npm run check
```

Expected: wszystkie testy PASS.

- [ ] **Step 8: Punkt kontrolny**

Zaproponować checkpoint:

```text
feat: add dynamic catalog facets
```

Nie wykonywać commita bez osobnej zgody.

---

### Task 6: Wersja, dokumentacja i lokalna weryfikacja

**Files:**
- Modify: `VERSION`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `CHANGELOG.txt`
- Modify: `README.md`
- Modify: `SPEC.md`

**Interfaces:**
- Produces: wersja `2.0.0-alpha.34`

- [ ] **Step 1: Podbić wersję**

Ustawić `2.0.0-alpha.34` w `VERSION`, `package.json` i dwóch polach głównych
`package-lock.json`.

- [ ] **Step 2: Uzupełnić log zmian**

Dodać sekcję:

```text
Wersja 2.0.0-alpha.34 (w przygotowaniu) - dynamiczne filtry katalogu

- Poprawiono kategorie wzorów na podstawie końcowych nazw i opisów.
- Typ projektu i materiał wzajemnie zawężają dostępne opcje.
- Opcje filtrów pokazują liczbę pasujących wzorów.
- Wzory wielomateriałowe są dostępne pod każdym użytym materiałem.
```

- [ ] **Step 3: Uaktualnić opis katalogu**

W `README.md` i `SPEC.md` opisać:

- semantykę „wszystkie aktywne filtry muszą pasować”,
- dynamiczne liczniki,
- zachowanie wzorów wielomateriałowych.

- [ ] **Step 4: Przebudować i zweryfikować dane**

Run:

```powershell
python scripts\extract-pattern-candidates.py
python scripts\build-pattern-import.py
npm run check
npm run patterns:check
git diff --check
```

Expected:

- 106 rekordów lokalnie,
- 106 rekordów w Supabase przed importem,
- 0 nowych rekordów,
- 0 rekordów `needs_review`,
- wszystkie testy PASS,
- brak błędów `git diff --check`.

---

### Task 7: Aktualizacja kategorii w Supabase

**Files:**
- Remote update: `public.patterns`

**Interfaces:**
- Consumes: `data/patterns-import.json` po wszystkich testach
- Produces: 106 zaktualizowanych rekordów bez zmian liczebności

- [ ] **Step 1: Pokazać podsumowanie zmian**

Uruchomić:

```powershell
npm run patterns:check
```

Odczytać dokładnie liczbę rekordów w pliku i tabeli.

- [ ] **Step 2: Poprosić o zgodę na aktualizację Supabase**

Użyć pełnego firmowego szablonu zgody. Wyjaśnić, że:

- zmienią się istniejące kategorie,
- liczba rekordów pozostanie 106,
- żaden wzór nie będzie usuwany,
- dane można odtworzyć z pliku importowego i Git.

- [ ] **Step 3: Wykonać import dopiero po zgodzie**

Run:

```powershell
npm run patterns:import
```

Expected:

```text
SAVED_RECORDS=106
FINAL_TABLE_RECORDS=106
```

- [ ] **Step 4: Sprawdzić zdalny rozkład**

Zapytanie:

```sql
select project_type, count(*)::int
from public.patterns
group by project_type
order by project_type;
```

Sprawdzić również:

```sql
select count(*)::int as total,
       count(*) filter (where needs_review)::int as needs_review
from public.patterns;
```

Expected: `total = 106`, `needs_review = 0`.

- [ ] **Step 5: Uruchomić kontrolę po imporcie**

Run:

```powershell
npm run patterns:check
```

Expected: 106 lokalnie i 106 w tabeli.

---

### Task 8: Weryfikacja w przeglądarce i końcowy checkpoint

**Files:**
- No new files expected

**Interfaces:**
- Consumes: działająca aplikacja lokalna i zaktualizowany Supabase
- Produces: potwierdzenie zachowania użytkowego

- [ ] **Step 1: Otworzyć katalog i sprawdzić sam typ**

Wybrać „Topy i bluzki”. Potwierdzić:

- liczba wyników jest większa od zera,
- `Na Pole Tee` ma kategorię „Top lub bluzka”,
- materiały pokazują dynamiczne liczniki.

- [ ] **Step 2: Sprawdzić kombinację typu i materiału**

Przy aktywnym typie „Topy i bluzki” wybrać „bawełna”. Potwierdzić, że wszystkie
widoczne karty są topami/bluzkami i zawierają bawełnę.

- [ ] **Step 3: Sprawdzić wielomateriałowość**

Potwierdzić, że `Na Pole Tee` jest dostępny zarówno przy materiale „bawełna”,
jak i „bambus”.

- [ ] **Step 4: Sprawdzić dynamiczne blokady**

Po wybraniu typu sprawdzić, że materiały bez pasujących wzorów są nieaktywne.
Po wybraniu materiału sprawdzić analogicznie typy projektu.

- [ ] **Step 5: Sprawdzić reset**

Kliknąć „Wyczyść filtry”. Potwierdzić:

- domyślny status „Zweryfikowane”,
- wszystkie typy i materiały dostępne zgodnie z pełnym katalogiem,
- podsumowanie pokazuje 106 wzorów.

- [ ] **Step 6: Uruchomić świeżą weryfikację końcową**

Run:

```powershell
npm run check
npm run patterns:check
git diff --check
git status --short --branch
```

- [ ] **Step 7: Zaproponować końcowy commit**

Proponowana nazwa:

```text
feat: add dynamic pattern catalog filters
```

Commit wykonać wyłącznie po zgodzie użytkowniczki. Push pozostawić
użytkowniczce.
