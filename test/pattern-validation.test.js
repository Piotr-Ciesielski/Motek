const { test } = require("node:test");
const assert = require("node:assert/strict");

const { validateMatchingRequirements } = require("../scripts/import-patterns");

test("walidator importera odrzuca częściowo błędne wymagania wzoru", () => {
  assert.doesNotThrow(() => validateMatchingRequirements({
    variants: [{
      yarns_needed: 1,
      meters_needed: 400,
      grams_needed: 100,
      materials: ["wełna"],
      weight_classes: ["dk"],
      yarn_requirements: [],
    }],
  }, "dobry.json"));

  assert.throws(
    () => validateMatchingRequirements({ variants: [{
      yarns_needed: 1,
      meters_needed: 400,
      grams_needed: 100,
      weight_classes: ["dk"],
    }] }, "zly.json"),
    /materials.*niepustą tablicą/
  );
  assert.throws(
    () => validateMatchingRequirements({ variants: [{
      yarns_needed: 1,
      meters_needed: 400,
      grams_needed: 100,
      materials: ["wełna"],
      weight_classes: ["dk"],
      yarn_requirements: Array.from({ length: 9 }, () => ({})),
    }] }, "zly-role.json"),
    /od 0 do 8/
  );
});
