const { test } = require("node:test");
const assert = require("node:assert/strict");

const patternImport = require("../data/patterns-import.json");

const ALLOWED_PROJECT_TYPES = new Set([
  "socks",
  "sweater",
  "cardigan",
  "top",
  "shawl_scarf",
  "head_accessory",
  "gloves",
  "vest",
  "skirt_dress",
  "blanket",
  "other",
]);

test("dane katalogu mają kompletne i kontrolowane typy projektów", () => {
  assert.equal(patternImport.records.length, patternImport.metadata.record_count);
  assert.equal(patternImport.records.length, 106);

  for (const record of patternImport.records) {
    assert.ok(
      ALLOWED_PROJECT_TYPES.has(record.project_type),
      `${record.name}: nieobsługiwany typ ${record.project_type}`,
    );
  }
});

test("charakterystyczne wzory trafiają do właściwych kategorii", () => {
  const typeByName = new Map(
    patternImport.records.map((record) => [record.name, record.project_type]),
  );

  const expectedTypes = new Map([
    ["Capucharpe EN", "shawl_scarf"],
    ["Chusta Erin kotek i motek", "shawl_scarf"],
    ["Turtle Town Cowl", "head_accessory"],
    ["Oslo Hat", "head_accessory"],
    ["Penguono", "cardigan"],
    ["Picot Headband Knitting Pattern - The Obsessed final", "head_accessory"],
    ["Starry Night Mittens PL-lo9p3u7q", "gloves"],
    ["Szal Queen of Spades Kokonki Pure", "shawl_scarf"],
    ["TEXTURE VEST hi UK-rm07er", "vest"],
    ["Tromsø Hoodie", "other"],
  ]);

  for (const [name, expectedType] of expectedTypes) {
    assert.equal(typeByName.get(name), expectedType, name);
  }
});
