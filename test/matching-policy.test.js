const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  allocateVariantRequirements,
  matchVariant,
  normalizeMatchingDocument,
  validateMatchingDocument,
} = require("../matching-policy");

const metersDocument = {
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
  const [variant] = normalizeMatchingDocument(metersDocument);
  assert.equal(variant.requirements[0].measurementBasis, "meters");
  assert.equal(variant.requirements[0].metersMin, 960);
  assert.equal(variant.requirements[0].gramsMin, 300);
  assert.equal(variant.size, "M");
  assert.equal(variant.yarnOption, "DROPS Safran");
});

test("nie wymaga metrów, gdy PDF podaje wyłącznie gramy", () => {
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

test("odrzuca brak podstawowej jednostki i niespójny zakres", () => {
  const missing = structuredClone(metersDocument);
  delete missing.variants[0].requirements[0].meters_min;
  assert.throws(() => validateMatchingDocument(missing), /meters_min/);

  const range = structuredClone(metersDocument);
  range.variants[0].requirements[0].meters_max = 900;
  assert.throws(() => validateMatchingDocument(range), /meters_max/);
});

test("odrzuca powtórzone warianty, nieznany materiał i zbyt wiele ról", () => {
  const duplicate = structuredClone(metersDocument);
  duplicate.variants.push(structuredClone(duplicate.variants[0]));
  assert.throws(() => validateMatchingDocument(duplicate), /powtórzony identyfikator/i);

  const material = structuredClone(metersDocument);
  material.variants[0].requirements[0].materials = ["metal"];
  assert.throws(() => validateMatchingDocument(material), /materiał/i);

  const roles = structuredClone(metersDocument);
  roles.variants[0].requirements = Array.from(
    { length: 9 },
    (_, index) => ({
      ...structuredClone(metersDocument.variants[0].requirements[0]),
      role: `rola ${index}`,
    }),
  );
  assert.throws(() => validateMatchingDocument(roles), /8 ról/);
});

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

  const match = matchVariant({ requirements: [requirement] }, yarns);
  assert.equal(match.doable, true);
  assert.deepEqual(match.allocation[0].map(({ id }) => id), [1, 2]);
});

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

  const differentColors = sameColors.map((yarn, index) => ({
    ...yarn,
    color: ["czerwony", "zielony", "biały"][index],
  }));
  const allocation = allocateVariantRequirements(requirements, differentColors);
  assert.equal(new Set(allocation.flat().map(({ id }) => id)).size, 3);
});

test("wybiera najmniejszą liczbę zgodnych motków i respektuje materiały", () => {
  const requirements = [{
    role: "główna",
    measurementBasis: "grams",
    gramsMin: 100,
    materials: ["wełna", "poliamid"],
    materialMatch: "all",
    colorMode: "same",
    weightClasses: ["fingering"],
  }];
  const yarns = [
    { id: 1, color: "ecru", materials: ["wełna"], weightClass: "fingering", length: 500, weight: 200 },
    { id: 2, color: "ecru", materials: ["wełna", "poliamid"], weightClass: "fingering", length: 200, weight: 50 },
    { id: 3, color: "ecru", materials: ["wełna", "poliamid"], weightClass: "fingering", length: 220, weight: 100 },
  ];

  assert.deepEqual(
    allocateVariantRequirements(requirements, yarns)[0].map(({ id }) => id),
    [3],
  );
});

test("wymaga minimalnej liczby motków nawet gdy suma metrów lub gramów wystarcza", () => {
  const requirement = {
    role: "główna",
    measurementBasis: "meters",
    metersMin: 400,
    skeinsMin: 2,
    materials: ["wełna"],
    materialMatch: "all",
    colorMode: "same",
    weightClasses: ["fingering"],
  };
  const oneLargeSkein = [{
    id: 1,
    color: "granat",
    materials: ["wełna"],
    weightClass: "fingering",
    length: 500,
    weight: 100,
  }];

  assert.equal(matchVariant({ requirements: [requirement] }, oneLargeSkein).doable, false);
  assert.equal(
    matchVariant({ requirements: [requirement] }, [
      oneLargeSkein[0],
      { ...oneLargeSkein[0], id: 2, length: 100, weight: 25 },
    ]).doable,
    true,
  );
});

test("wymaga osobnych motków dla dziergania z dwóch nitek", () => {
  const requirement = {
    role: "główna",
    measurementBasis: "meters",
    metersMin: 400,
    strandCount: 2,
    materials: ["wełna"],
    materialMatch: "all",
    colorMode: "same",
    weightClasses: ["fingering"],
  };
  const yarn = {
    id: 1,
    color: "ecru",
    materials: ["wełna"],
    weightClass: "fingering",
    length: 500,
    weight: 100,
  };

  assert.equal(matchVariant({ requirements: [requirement] }, [yarn]).doable, false);
  assert.equal(
    matchVariant({ requirements: [requirement] }, [
      yarn,
      { ...yarn, id: 2 },
    ]).doable,
    true,
  );
});

test("odrzuca nieobsługiwaną grupę nitek trzymanych razem", () => {
  const document = structuredClone(metersDocument);
  document.variants[0].requirements[0].held_together_group = "oslo-hat";

  assert.throws(
    () => validateMatchingDocument(document, "test"),
    /held_together_group nie jest obsługiwane/,
  );
});
