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
  getYarnMeasurementValidationMessage,
  getMatchFreshnessState,
  getYarnSaveHint,
  readYarnVersionHeader,
  withYarnVersionRetry,
  isDeleteConfirmed,
  resolveRequestedView,
  yarnsHaveSameValues,
} = require("../client-policy");

test("komunikat walidacji metrów rozróżnia tekst, zero i ułamek", () => {
  assert.equal(
    getYarnMeasurementValidationMessage({
      field: "length",
      validity: { badInput: true },
    }),
    "Długość musi być liczbą całkowitą, np. 200.",
  );
  assert.equal(
    getYarnMeasurementValidationMessage({
      field: "length",
      validity: { rangeUnderflow: true },
    }),
    "Długość musi wynosić co najmniej 1 m.",
  );
  assert.equal(
    getYarnMeasurementValidationMessage({
      field: "length",
      validity: { stepMismatch: true },
    }),
    "Długość musi być liczbą całkowitą.",
  );
});

test("komunikat walidacji wagi wymaga wartości i ogranicza maksimum", () => {
  assert.equal(
    getYarnMeasurementValidationMessage({
      field: "weight",
      validity: { valueMissing: true },
    }),
    "",
  );
  assert.equal(
    getYarnMeasurementValidationMessage({
      field: "weight",
      validity: { valueMissing: true },
      showRequired: true,
    }),
    "Podaj wagę w gramach.",
  );
  assert.equal(
    getYarnMeasurementValidationMessage({
      field: "length",
      validity: { badInput: true, valueMissing: true },
    }),
    "Długość musi być liczbą całkowitą, np. 200.",
  );
  assert.equal(
    getYarnMeasurementValidationMessage({
      field: "weight",
      validity: { rangeOverflow: true },
    }),
    "Waga nie może przekraczać 1 000 000 g.",
  );
  assert.equal(
    getYarnMeasurementValidationMessage({ field: "weight", validity: {} }),
    "",
  );
});

test("stara akceptacja kieruje chronione widoki do Konta", () => {
  assert.equal(resolveRequestedView({
    requested: "catalog",
    authenticated: true,
    acceptanceRequired: true,
  }), "account");
  assert.equal(resolveRequestedView({
    requested: "inventory",
    authenticated: true,
    acceptanceRequired: true,
  }), "account");
  assert.equal(resolveRequestedView({
    requested: "account",
    authenticated: true,
    acceptanceRequired: true,
  }), "account");
});

test("anonimowy użytkownik nie omija logowania przez katalog", () => {
  assert.equal(resolveRequestedView({
    requested: "catalog",
    authenticated: false,
    acceptanceRequired: false,
  }), "account");
});

test("preferuje jawny nagłówek wersji magazynu nad ETag", () => {
  const headers = new Map([
    ["x-motek-yarn-version", '"yarn-v8"'],
    ["etag", '"yarn-v7"'],
  ]);

  assert.equal(readYarnVersionHeader(headers), '"yarn-v8"');
});

test("odświeża wersję przed zapisem i ponawia jednorazowo po HTTP 428", async () => {
  let version = null;
  let refreshes = 0;
  let writes = 0;

  const result = await withYarnVersionRetry({
    getVersion: () => version,
    refreshVersion: async () => {
      refreshes += 1;
      version = '"yarn-v4"';
    },
    operation: async () => {
      writes += 1;
      if (writes === 1) {
        const error = new Error("missing version");
        error.status = 428;
        throw error;
      }
      return "saved";
    },
  });

  assert.equal(result, "saved");
  assert.equal(refreshes, 2);
  assert.equal(writes, 2);
});

test("nie ponawia niepowiązanego błędu ani drugiego HTTP 428", async () => {
  let refreshes = 0;
  let writes = 0;
  const error = new Error("still missing version");
  error.status = 428;

  await assert.rejects(
    withYarnVersionRetry({
      getVersion: () => '"yarn-v4"',
      refreshVersion: async () => { refreshes += 1; },
      operation: async () => {
        writes += 1;
        throw error;
      },
    }),
    (caught) => caught === error,
  );

  assert.equal(refreshes, 1);
  assert.equal(writes, 2);
});

test("nie odświeża wersji, gdy bieżąca wersja jest poprawna", async () => {
  let refreshes = 0;

  const result = await withYarnVersionRetry({
    getVersion: () => '"yarn-v7"',
    refreshVersion: async () => { refreshes += 1; },
    operation: async () => "saved",
  });

  assert.equal(result, "saved");
  assert.equal(refreshes, 0);
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
