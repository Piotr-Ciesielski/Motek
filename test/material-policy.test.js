const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  MATERIALS,
  formatYarnMaterials,
  matchesMaterialRule,
  matchesPatternMaterialFilter,
  normalizeYarnMaterials,
} = require("../material-policy");

test("normalizuje kilka unikalnych materiałów w kolejności wspólnej listy", () => {
  assert.deepEqual(
    normalizeYarnMaterials(["jedwab", "wełna", "jedwab"]),
    ["wełna", "jedwab"],
  );
  assert.equal(
    MATERIALS.some(({ value }) => value === "dowolny materiał"),
    false,
  );
});

test("odrzuca nieznane, elastyczne i puste składy włóczki", () => {
  assert.throws(() => normalizeYarnMaterials([]), /co najmniej jeden materiał/);
  assert.throws(
    () => normalizeYarnMaterials(["dowolny materiał"]),
    /niedozwolony materiał/i,
  );
  assert.throws(
    () => normalizeYarnMaterials(["nieznany"]),
    /niedozwolony materiał/i,
  );
  assert.throws(
    () => normalizeYarnMaterials(["mieszanka", "wełna"]),
    /mieszanka/i,
  );
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
  assert.equal(
    matchesPatternMaterialFilter(["wełna"], "bawełna"),
    false,
  );
});

test("formatuje skład motka do czytelnego podsumowania", () => {
  assert.equal(
    formatYarnMaterials(["wełna", "poliamid"]),
    "Wełna, Poliamid",
  );
  assert.equal(
    formatYarnMaterials([]),
    "Wybierz co najmniej jeden materiał",
  );
  assert.equal(
    formatYarnMaterials(["mieszanka"]),
    "Mieszanka — skład nieokreślony",
  );
});
