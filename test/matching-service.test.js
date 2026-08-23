const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluateMatchingVariantsWithDiagnostics,
  evaluateMatchingVariants,
  scorePattern,
  selectMatchingYarns,
} = require("../server/matching-service");

function evaluateDiagnostics(variants, diagnostician) {
  return evaluateMatchingVariantsWithDiagnostics(variants, yarns, {
    matcher: () => ({ doable: false, allocation: [], coverage: 0 }),
    diagnostician,
  });
}

const yarns = [
  { id: 1, materials: ["wełna"], weightClass: "dk", length: 300, weight: 60 },
  { id: 2, materials: ["wełna"], weightClass: "dk", length: 250, weight: 50 },
  { id: 3, materials: ["bawełna"], weightClass: "fingering", length: 400, weight: 100 },
];

test("scorePattern obsługuje wymagania ról i zwraca wynik wykonalny", () => {
  const result = scorePattern(
    {
      requirements: [{
        yarnsNeeded: 1,
        metersNeeded: 500,
        gramsNeeded: 100,
        materials: ["wełna"],
        weightClasses: ["dk"],
      }],
    },
    yarns,
  );

  assert.deepEqual(result, {
    total: 100,
    doable: true,
    totalLength: 550,
    totalWeight: 110,
    matchedYarns: 2,
  });
});

test("scorePattern zachowuje tryb legacy bez wymagań ról", () => {
  const result = scorePattern(
    {
      yarnsNeeded: 1,
      metersNeeded: 500,
      gramsNeeded: 100,
      materials: ["wełna"],
      weightClasses: ["dk"],
      colors: "dowolny",
    },
    yarns,
  );

  assert.equal(result.doable, true);
  assert.equal(result.matchedYarns, 2);
});

test("selectMatchingYarns zwraca wszystkie kwalifikujące się motki", () => {
  const result = selectMatchingYarns(
    {
      requirements: [{
        yarnsNeeded: 1,
        metersNeeded: 100,
        gramsNeeded: 20,
        materials: ["wełna"],
        weightClasses: ["dk"],
      }],
    },
    yarns,
  );

  assert.deepEqual(result, { yarns: [yarns[0], yarns[1]], limited: false });
});

test("algorytm respektuje limit węzłów wyszukiwania", () => {
  const tooComplex = {
    requirements: Array.from({ length: 8 }, () => ({
      yarnsNeeded: 100,
      metersNeeded: 1,
      gramsNeeded: 1,
      materials: ["wełna"],
      weightClasses: ["dk"],
    })),
  };
  const manyYarns = Array.from({ length: 500 }, (_, id) => ({
    id,
    materials: ["wełna"],
    weightClass: "dk",
    length: 10,
    weight: 10,
  }));

  assert.throws(
    () => scorePattern(tooComplex, manyYarns),
    /Dopasowanie jest zbyt złożone/,
  );
});
test("przekroczenie budżetu jednego wariantu zachowuje poprawne dopasowania", () => {
  const validVariant = { id: "m" };
  const tooComplexVariant = { id: "xl" };

  const result = evaluateMatchingVariants(
    [validVariant, tooComplexVariant],
    yarns,
    (variant) => {
      if (variant === tooComplexVariant) {
        throw new RangeError("limit wyszukiwania");
      }
      return { doable: true, allocation: [[yarns[0]]], coverage: 100 };
    },
  );

  assert.equal(result.limited, true);
  assert.deepEqual(result.matches, [{
    variant: validVariant,
    outcome: { doable: true, allocation: [[yarns[0]]], coverage: 100 },
  }]);
});

test("diagnostyka wybiera jeden najbliższy wariant wzoru", () => {
  const variants = [{ id: "s" }, { id: "m" }, { id: "l" }];
  const result = evaluateDiagnostics(variants, (variant) => ({
    status: "no_match",
    allocation: [],
    coverage: 0,
    reasons: variant.id === "m"
      ? [{ code: "QUANTITY", role: "główna", basis: "meters", required: 500, available: 450 }]
      : [
          { code: "WEIGHT_CLASS", role: "główna", expected: ["worsted"] },
          { code: "QUANTITY", role: "główna", basis: "meters", required: 700, available: 0 },
        ],
  }));

  assert.equal(result.limited, false);
  assert.equal(result.diagnostic.variant, variants[1]);
  assert.equal(result.diagnostic.outcome.reasons.length, 1);
});

test("możliwe dopasowanie ma pierwszeństwo przed zwykłym niedopasowaniem", () => {
  const variants = [{ id: "blocked" }, { id: "unknown" }];
  const result = evaluateDiagnostics(variants, (variant) => variant.id === "unknown"
    ? {
        status: "possible_unknown_material",
        allocation: [[yarns[0]]],
        coverage: 0,
        reasons: [{ code: "UNKNOWN_MATERIAL", role: "główna" }],
      }
    : {
        status: "no_match",
        allocation: [],
        coverage: 0,
        reasons: [{ code: "MATERIAL", role: "główna", expected: ["bawełna"] }],
      });

  assert.equal(result.diagnostic.variant, variants[1]);
});

test("przy tej samej liczbie powodów wybiera mniejszy znormalizowany niedobór", () => {
  const variants = [{ id: "brak" }, { id: "prawie" }];
  const result = evaluateDiagnostics(variants, (variant) => ({
    status: "no_match",
    allocation: [],
    coverage: 0,
    reasons: [{
      code: "QUANTITY",
      role: "główna",
      basis: "meters",
      required: 1000,
      available: variant.id === "prawie" ? 999 : 0,
    }],
  }));

  assert.equal(result.diagnostic.variant, variants[1]);
});

test("diagnostyka wykonuje strict raz na wariant i przekazuje jego wynik", () => {
  const variants = [{ id: "full" }, { id: "blocked" }];
  const strictCalls = new Map();
  const diagnosticCalls = new Map();
  const strictOutcomes = new Map(variants.map((variant) => [variant, {
    doable: variant.id === "full",
    allocation: variant.id === "full" ? [[yarns[0]]] : [],
    coverage: variant.id === "full" ? 100 : 0,
  }]));

  const result = evaluateMatchingVariantsWithDiagnostics(variants, yarns, {
    matcher(variant) {
      strictCalls.set(variant.id, (strictCalls.get(variant.id) || 0) + 1);
      return strictOutcomes.get(variant);
    },
    diagnostician(variant, _yarns, options) {
      diagnosticCalls.set(variant.id, (diagnosticCalls.get(variant.id) || 0) + 1);
      assert.equal(options.strictOutcome, strictOutcomes.get(variant));
      return {
        status: "no_match",
        allocation: [],
        coverage: 0,
        reasons: [{ code: "WEIGHT_CLASS", role: "główna", expected: ["worsted"] }],
      };
    },
  });

  assert.deepEqual([...strictCalls], [["full", 1], ["blocked", 1]]);
  assert.deepEqual([...diagnosticCalls], [["blocked", 1]]);
  assert.equal(result.matches[0].variant, variants[0]);
  assert.equal(result.diagnostic.variant, variants[1]);
});

test("remis kosztu zachowuje pierwszy wariant", () => {
  const variants = [{ id: "pierwszy" }, { id: "drugi" }];
  const result = evaluateDiagnostics(variants, () => ({
    status: "no_match",
    allocation: [],
    coverage: 0,
    reasons: [{
      code: "QUANTITY",
      role: "główna",
      basis: "meters",
      required: 1000,
      available: 500,
    }],
  }));

  assert.equal(result.diagnostic.variant, variants[0]);
});

test("pojedyncze przejście zachowuje limited i pozostałą diagnostykę", () => {
  const variants = [{ id: "złożony" }, { id: "prosty" }];
  const result = evaluateMatchingVariantsWithDiagnostics(variants, yarns, {
    matcher(variant) {
      if (variant.id === "złożony") throw new RangeError("limit wyszukiwania");
      return { doable: false, allocation: [], coverage: 0 };
    },
    diagnostician() {
      return {
        status: "no_match",
        allocation: [],
        coverage: 0,
        reasons: [{ code: "WEIGHT_CLASS", role: "główna", expected: ["sport"] }],
      };
    },
  });

  assert.equal(result.limited, true);
  assert.equal(result.diagnostic.variant, variants[1]);
});

test("prawie pełna ilość wygrywa ze złą grubością niezależnie od kolejności", () => {
  for (const variants of [
    [{ id: "zła-grubość" }, { id: "prawie" }],
    [{ id: "prawie" }, { id: "zła-grubość" }],
  ]) {
    const result = evaluateDiagnostics(variants, (variant) => ({
      status: "no_match",
      allocation: [],
      coverage: 0,
      reasons: variant.id === "prawie"
        ? [{
            code: "QUANTITY",
            role: "główna",
            basis: "meters",
            required: 1000,
            available: 999,
          }]
        : [{ code: "WEIGHT_CLASS", role: "główna", expected: ["worsted"] }],
    }));

    assert.equal(result.diagnostic.variant.id, "prawie");
  }
});

test("dowolna liczba miękkich niedoborów pozostaje bliższa niż twarda niezgodność", () => {
  const variants = [{ id: "twardy" }, { id: "miękkie" }];
  const result = evaluateDiagnostics(variants, (variant) => ({
    status: "no_match",
    allocation: [],
    coverage: 0,
    reasons: variant.id === "twardy"
      ? [{ code: "MATERIAL", role: "główna", expected: ["wełna"] }]
      : [
          { code: "QUANTITY", role: "główna", required: 1000, available: 0 },
          { code: "STRAND_COUNT", role: "główna", required: 3, available: 0 },
          { code: "DISTINCT_COLORS", group: "kontrast", required: 3, available: 0 },
        ],
  }));

  assert.equal(result.diagnostic.variant, variants[1]);
});

test("mieszane miękkie powody porównuje według łącznej znormalizowanej skali", () => {
  const variants = [{ id: "jeden" }, { id: "mieszane" }];
  const result = evaluateDiagnostics(variants, (variant) => ({
    status: "no_match",
    allocation: [],
    coverage: 0,
    reasons: variant.id === "jeden"
      ? [{ code: "QUANTITY", role: "główna", required: 1000, available: 400 }]
      : [
          { code: "QUANTITY", role: "główna", required: 1000, available: 500 },
          { code: "COLOR", role: "główna", required: 1000, available: 999 },
        ],
  }));

  assert.equal(result.diagnostic.variant, variants[1]);
});
