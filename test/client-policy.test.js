const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPatternFacetCounts,
  buildPatternFacetOptions,
  filterPatterns,
  findNewlySavedYarn,
  formatPatternYarnFact,
  getExistingYarnState,
  isDeleteConfirmed,
  loadPaginatedItems,
  shouldRetryRead,
} = require("../client-policy");

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

const draft = {
  name: "Merino",
  color: "ecru",
  material: "wełna",
  weightClass: "dk",
  length: 200,
  weight: 100,
};

test("wzór z kilkoma alternatywami nie jest opisany jako brak danych", () => {
  assert.equal(
    formatPatternYarnFact?.(
      {
        metersPer100g: null,
        yarnRequirements: [
          { yarnName: "Wariant pierwszy", metersPer100g: 320 },
          { yarnName: "Wariant drugi", metersPer100g: 250 },
        ],
      },
      () => "brak danych",
    ),
    "Włóczka: 2 warianty opisane w szczegółach",
  );
});

test("ponawia tylko bezpieczny odczyt po przejściowym błędzie", () => {
  assert.equal(
    shouldRetryRead({
      method: "GET",
      errorName: "TypeError",
      attempt: 1,
      maxAttempts: 2,
    }),
    true
  );
  assert.equal(
    shouldRetryRead({
      method: "GET",
      status: 503,
      attempt: 1,
      maxAttempts: 2,
    }),
    true
  );
  assert.equal(
    shouldRetryRead({
      method: "POST",
      errorName: "TypeError",
      attempt: 1,
      maxAttempts: 2,
    }),
    false
  );
  assert.equal(
    shouldRetryRead({
      method: "GET",
      errorName: "TypeError",
      externallyAborted: true,
      attempt: 1,
      maxAttempts: 2,
    }),
    false
  );
});

test("rozpoznaje nowy motek zapisany mimo utraconej odpowiedzi", () => {
  const knownIds = new Set(["1"]);
  const yarns = [
    { id: 1, ...draft },
    { id: 2, ...draft },
  ];

  assert.equal(findNewlySavedYarn(yarns, draft, knownIds)?.id, 2);
  assert.equal(findNewlySavedYarn([yarns[0]], draft, knownIds), null);
});

test("rozpoznaje wynik przerwanej modyfikacji i usunięcia", () => {
  assert.equal(getExistingYarnState([{ id: 7, ...draft }], 7, draft).state, "saved");
  assert.equal(
    getExistingYarnState([{ id: 7, ...draft, color: "granat" }], 7, draft).state,
    "different"
  );
  assert.equal(getExistingYarnState([], 7, draft).state, "missing");
  assert.equal(isDeleteConfirmed([], 7), true);
  assert.equal(isDeleteConfirmed([{ id: 7, ...draft }], 7), false);
});

test("zachowuje częściowo pobrany katalog i wznawia od miejsca błędu", async () => {
  const firstAttempt = await loadPaginatedItems(async (offset) => {
    if (offset === 0) {
      return {
        items: [{ id: 1 }, { id: 2 }],
        hasMore: true,
      };
    }
    throw new Error("chwilowy błąd");
  });

  assert.deepEqual(firstAttempt.items, [{ id: 1 }, { id: 2 }]);
  assert.equal(firstAttempt.nextOffset, 2);
  assert.equal(firstAttempt.complete, false);
  assert.match(firstAttempt.error.message, /chwilowy błąd/);

  const resumed = await loadPaginatedItems(
    async (offset) => {
      assert.equal(offset, 2);
      return {
        items: [{ id: 2 }, { id: 3 }],
        hasMore: false,
      };
    },
    {
      items: firstAttempt.items,
      offset: firstAttempt.nextOffset,
    }
  );

  assert.deepEqual(resumed.items, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.equal(resumed.complete, true);
  assert.equal(resumed.error, null);
});

test("nie przedstawia błędu pierwszej strony jako częściowego sukcesu", async () => {
  await assert.rejects(
    loadPaginatedItems(async () => {
      throw new Error("brak katalogu");
    }),
    /brak katalogu/
  );
});

test("udostępnia kolejne strony katalogu od razu po ich pobraniu", async () => {
  const progress = [];
  const result = await loadPaginatedItems(
    async (offset) => ({
      items: offset === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
      total: 3,
      hasMore: offset === 0,
    }),
    {
      onPage: (page) => progress.push(page),
    },
  );

  assert.deepEqual(
    progress.map((page) => ({
      ids: page.items.map((item) => item.id),
      total: page.total,
      complete: page.complete,
    })),
    [
      { ids: [1, 2], total: 3, complete: false },
      { ids: [1, 2, 3], total: 3, complete: true },
    ],
  );
  assert.deepEqual(result.items, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.equal(result.total, 3);
});

test("łączy typ projektu i materiał jako wspólne kryteria", () => {
  const result = filterPatterns?.(filterPatternsFixture, {
    phrase: "",
    review: "all",
    language: "all",
    type: "top",
    material: "bawełna",
  });

  assert.deepEqual(
    result?.map((pattern) => pattern.name),
    ["Bawełniany top"],
  );
});

test("wzór z kilkoma materiałami pasuje do każdego z nich tylko raz", () => {
  const filters = {
    phrase: "",
    review: "all",
    language: "all",
    type: "top",
  };

  assert.deepEqual(
    filterPatterns?.(filterPatternsFixture, {
      ...filters,
      material: "bawełna",
    })?.map((pattern) => pattern.name),
    ["Bawełniany top"],
  );
  assert.deepEqual(
    filterPatterns?.(filterPatternsFixture, {
      ...filters,
      material: "bambus",
    })?.map((pattern) => pattern.name),
    ["Bawełniany top"],
  );
  assert.deepEqual(
    filterPatterns?.(filterPatternsFixture, {
      ...filters,
      material: "wełna",
    })?.map((pattern) => pattern.name),
    ["Wełniany top"],
  );
});

test("liczy dynamiczne opcje typu i materiału względem pozostałych filtrów", () => {
  const counts = buildPatternFacetCounts?.(filterPatternsFixture, {
    phrase: "",
    review: "all",
    language: "all",
    type: "top",
    material: "bawełna",
  });

  assert.deepEqual(counts, {
    types: { top: 1, socks: 1 },
    materials: { "bawełna": 1, bambus: 1, "wełna": 1 },
  });
});

test("wyłącza niemożliwe opcje, ale zachowuje aktualnie wybraną", () => {
  assert.deepEqual(
    buildPatternFacetOptions?.(
      ["bawełna", "bambus", "wełna"],
      { "bawełna": 1 },
      "wełna",
    ),
    [
      { value: "bawełna", count: 1, disabled: false },
      { value: "bambus", count: 0, disabled: true },
      { value: "wełna", count: 0, disabled: false },
    ],
  );
});
