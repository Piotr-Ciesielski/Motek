const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  validateMatchingRequirements,
  validateProjectType,
} = require("../scripts/import-patterns");

const validDocument = {
  version: 2,
  variants: [{
    id: "M-safran",
    label: "M — DROPS Safran",
    requirements: [{
      role: "główna",
      measurement_basis: "meters",
      meters_min: 400,
      materials: ["bawełna"],
      material_match: "all",
      color_mode: "same",
      weight_classes: ["sport"],
    }],
  }],
};

test("walidator importera przyjmuje wymagania wersji 2", () => {
  assert.doesNotThrow(() =>
    validateMatchingRequirements(validDocument, "dobry.json")
  );
  assert.doesNotThrow(() =>
    validateMatchingRequirements({ version: 2, variants: [] }, "pusty.json")
  );
});

test("walidator importera odrzuca niepełne lub niespójne wymagania", () => {
  const missingQuantity = structuredClone(validDocument);
  delete missingQuantity.variants[0].requirements[0].meters_min;
  assert.throws(
    () => validateMatchingRequirements(missingQuantity, "brak-metrow.json"),
    /brak-metrow\.json.*meters_min/,
  );

  const unknownMaterial = structuredClone(validDocument);
  unknownMaterial.variants[0].requirements[0].materials = ["metal"];
  assert.throws(
    () => validateMatchingRequirements(unknownMaterial, "material.json"),
    /material\.json.*materiał/i,
  );

  const emptyRoles = structuredClone(validDocument);
  emptyRoles.variants[0].requirements = [];
  assert.throws(
    () => validateMatchingRequirements(emptyRoles, "role.json"),
    /role\.json.*od 1 do 8 ról/,
  );

  const tooManyRoles = structuredClone(validDocument);
  tooManyRoles.variants[0].requirements = Array.from(
    { length: 9 },
    (_, index) => ({
      ...structuredClone(validDocument.variants[0].requirements[0]),
      role: `rola ${index}`,
    }),
  );
  assert.throws(
    () => validateMatchingRequirements(tooManyRoles, "duzo-rol.json"),
    /duzo-rol\.json.*od 1 do 8 ról/,
  );

  const duplicateIds = structuredClone(validDocument);
  duplicateIds.variants.push(structuredClone(duplicateIds.variants[0]));
  assert.throws(
    () => validateMatchingRequirements(duplicateIds, "duplikat.json"),
    /duplikat\.json.*powtórzony identyfikator/i,
  );
});

test("walidator importera przyjmuje tylko obsługiwane typy projektów", () => {
  assert.doesNotThrow(() => validateProjectType("cardigan", "dobry.json"));
  assert.doesNotThrow(() => validateProjectType("other", "inny.json"));
  assert.throws(
    () => validateProjectType("nieznany-typ", "zly.json"),
    /nieobsługiwany typ projektu/,
  );
});
