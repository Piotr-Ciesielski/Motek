const test = require("node:test");
const assert = require("node:assert/strict");

const {
  bindHoldToReveal,
  buildAuthPayload,
  buildPatternFacetCounts,
  buildPatternFacetOptions,
  ensureSingleNewYarnCard,
  filterPatterns,
  findNewlySavedYarn,
  formatMatchingRequirement,
  formatPatternYarnFact,
  getExistingYarnState,
  getMatchFreshnessState,
  getYarnSaveHint,
  isDeleteConfirmed,
  loadPaginatedItems,
  loadNextPaginatedPage,
  shouldRetryRead,
  yarnsHaveSameValues,
} = require("../client-policy");

test("ładuje dokładnie jedną stronę katalogu i deduplikuje elementy", async () => {
  const calls = [];
  const result = await loadNextPaginatedPage(
    async (offset) => {
      calls.push(offset);
      return { items: [{ id: 2 }, { id: 3 }], total: 3, hasMore: false };
    },
    { items: [{ id: 1 }, { id: 2 }], offset: 2, total: 3 },
  );
  assert.deepEqual(calls, [2]);
  assert.deepEqual(result.items, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.equal(result.complete, true);
});

test("pusta strona nie oznacza ukończenia, gdy serwer sygnalizuje dalsze dane", async () => {
  const result = await loadNextPaginatedPage(
    async () => ({ items: [], total: 4, hasMore: true }),
    { items: [{ id: 1 }], offset: 1, total: 4 },
  );
  assert.equal(result.complete, false);
  assert.equal(result.nextOffset, 1);
});

test("zachowuje częściowy wynik i błąd bez fałszywego complete", async () => {
  const error = new Error("chwilowy błąd");
  const result = await loadNextPaginatedPage(async () => { throw error; }, {
    items: [{ id: 1 }], offset: 1, total: 2,
  });
  assert.deepEqual(result.items, [{ id: 1 }]);
  assert.equal(result.complete, false);
  assert.equal(result.error, error);
});

test("payload Auth dodaje token tylko przy włączonej CAPTCHA", () => {
  assert.deepEqual(
    buildAuthPayload({ email: "a@example.test", password: "Secret1!" }, { captchaEnabled: false }),
    { email: "a@example.test", password: "Secret1!" },
  );
  assert.deepEqual(
    buildAuthPayload({ login: "a@example.test", password: "Secret1!" }, { captchaEnabled: true, captchaToken: "token" }),
    { login: "a@example.test", password: "Secret1!", captchaToken: "token" },
  );
  assert.throws(
    () => buildAuthPayload({ email: "a@example.test" }, { captchaEnabled: true }),
    /zabezpieczenie/,
  );
});

test("wyjaśnia brakujące dane zamiast ukrywać zapis", () => {
  assert.deepEqual(
    getYarnSaveHint({
      yarn: { name: "", color: "", materials: [] },
      isEditing: true,
      isNew: true,
      changed: true,
      busy: false,
    }),
    {
      visible: true,
      disabled: true,
      message: "Uzupełnij: nazwę, kolor i materiał.",
    },
  );
});

test("opisuje zapis, brak zmian i trwającą operację", () => {
  const yarn = { name: "Merino", color: "Granat", materials: ["wool"] };
  assert.equal(getYarnSaveHint({ yarn, isEditing: true, isNew: true, changed: true }).disabled, false);
  assert.equal(getYarnSaveHint({ yarn, isEditing: true, isNew: false, changed: false }).message, "Brak nowych zmian.");
  assert.equal(getYarnSaveHint({ yarn, isEditing: true, isNew: false, changed: true, busy: true }).message, "Zapisywanie…");
});

test("oznacza wcześniejsze dopasowanie jako nieaktualne po zmianie", () => {
  assert.deepEqual(
    getMatchFreshnessState({ hasCalculatedMatches: true, inventoryChanged: true }),
    { stale: true, message: "Wyniki są nieaktualne po zmianie magazynu." },
  );
  assert.equal(
    getMatchFreshnessState({ hasCalculatedMatches: false, inventoryChanged: true }).stale,
    false,
  );
});

class PasswordRevealControl extends EventTarget {
  constructor() {
    super();
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }
}

test("hasło jest widoczne tylko podczas przytrzymania kontrolki", () => {
  const button = new PasswordRevealControl();
  const field = { type: "password" };

  bindHoldToReveal(button, field);

  button.dispatchEvent(new Event("click", { cancelable: true }));
  assert.equal(field.type, "password");

  button.dispatchEvent(new Event("pointerdown", { cancelable: true }));
  assert.equal(field.type, "text");
  assert.equal(button.getAttribute("aria-pressed"), "true");

  button.dispatchEvent(new Event("pointerup"));
  assert.equal(field.type, "password");
  assert.equal(button.getAttribute("aria-pressed"), "false");

  button.dispatchEvent(new Event("pointerdown", { cancelable: true }));
  button.dispatchEvent(new Event("pointerleave"));
  assert.equal(field.type, "password");

  button.dispatchEvent(new Event("pointerdown", { cancelable: true }));
  button.dispatchEvent(new Event("blur"));
  assert.equal(field.type, "password");

  const keyDown = new Event("keydown", { cancelable: true });
  Object.defineProperty(keyDown, "key", { value: " " });
  button.dispatchEvent(keyDown);
  assert.equal(field.type, "text");

  const keyUp = new Event("keyup", { cancelable: true });
  Object.defineProperty(keyUp, "key", { value: " " });
  button.dispatchEvent(keyUp);
  assert.equal(field.type, "password");
});

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
  materials: ["wełna", "poliamid"],
  weightClass: "dk",
  length: 200,
  weight: 100,
};

test("porównuje pełny skład materiałowy motka", () => {
  assert.equal(
    yarnsHaveSameValues(draft, { ...draft, materials: ["wełna", "poliamid"] }),
    true,
  );
  assert.equal(
    yarnsHaveSameValues(draft, { ...draft, materials: ["wełna"] }),
    false,
  );
});

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

test("opis dokładnego wymagania nie dopisuje nieznanej jednostki jako zera", () => {
  const text = formatMatchingRequirement(
    {
      role: "kolor główny",
      measurementBasis: "grams",
      gramsMin: 35,
      gramsMax: null,
      metersMin: null,
      metersMax: null,
      skeinsMin: 1,
      skeinsMax: null,
      materials: [],
      materialMatch: "any_material",
      weightClasses: ["fingering"],
      strandCount: null,
    },
    [{ name: "Sock", color: "biały" }],
    (value) => String(value),
    (value) => `${value} motek`,
  );

  assert.match(text, /kolor główny: min\. 35 g/);
  assert.match(text, /dowolny materiał/);
  assert.match(text, /Sock \(biały\)/);
  assert.doesNotMatch(text, /0 m|0 g/);
});

test("elastyczny wzór pasuje do każdego konkretnego materiału", () => {
  const flexiblePattern = {
    name: "Dowolna chusta",
    description: "Włóczka według uznania",
    projectType: "shawl_scarf",
    materials: ["dowolny materiał"],
    sourceLanguage: "pl",
    needsReview: false,
  };
  const patterns = [...filterPatternsFixture, flexiblePattern];

  assert.deepEqual(
    filterPatterns(patterns, {
      review: "verified",
      material: "bawełna",
    }).map(({ name }) => name),
    ["Bawełniany top", "Bawełniane skarpety", "Dowolna chusta"],
  );
  assert.deepEqual(
    filterPatterns(patterns, {
      review: "verified",
      material: "wełna",
    }).map(({ name }) => name),
    ["Wełniany top", "Dowolna chusta"],
  );

  const counts = buildPatternFacetCounts(patterns, { review: "verified" });
  assert.equal(counts.materials["dowolny materiał"], undefined);
  assert.equal(counts.materials.bawełna, 3);
  assert.equal(counts.materials.wełna, 2);
});
