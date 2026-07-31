const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { MATERIALS } = require("../material-policy");
const { validateMatchingDocument } = require("../matching-policy");

const importDocument = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "data", "patterns-import.json"),
    "utf8",
  ),
);
const records = importDocument.records;

function getPattern(sourceFilename) {
  const pattern = records.find((record) => record.source_filename === sourceFilename);
  assert.ok(pattern, `Brak wzoru ${sourceFilename}`);
  return pattern;
}

test("cały katalog używa kontraktu dopasowania wersji 2", () => {
  assert.equal(records.length, 106);
  assert.equal(records.filter((record) => record.needs_review).length, 0);
  records.forEach((record) =>
    assert.doesNotThrow(() =>
      validateMatchingDocument(record.matching_requirements, record.source_filename)
    )
  );
  assert.equal(
    records.reduce(
      (total, record) => total + record.matching_requirements.variants.length,
      0,
    ),
    21,
  );
});

test("Na Pole Tee ma 12 wariantów obu włóczek i wszystkich rozmiarów", () => {
  const variants = getPattern(
    "Kopia pliku na_pole_wzor.pdf",
  ).matching_requirements.variants;
  assert.equal(variants.length, 12);
  assert.deepEqual(
    [...new Set(variants.map(({ size }) => size))],
    ["XS", "S", "M", "L", "XL", "XXL"],
  );
  assert.deepEqual(
    [...new Set(variants.map(({ yarn_option }) => yarn_option))],
    ["DROPS Safran", "Performance Bamboo Queen"],
  );
  assert.equal(
    variants.find(({ id }) => id === "xxl-safran")
      .requirements[0].meters_min,
    1440,
  );
  assert.equal(
    variants.find(({ id }) => id === "xxl-bamboo-queen")
      .requirements[0].meters_min,
    1250,
  );
});

test("Holly Berry wymaga trzech odrębnych kolorów mierzonych w gramach", () => {
  const [variant] = getPattern(
    "HollyBerryCharitySocks.pdf",
  ).matching_requirements.variants;
  assert.equal(variant.requirements.length, 3);
  assert.deepEqual(
    variant.requirements.map(({ grams_min }) => grams_min),
    [35, 26, 10],
  );
  assert.equal(
    new Set(variant.requirements.map(({ distinct_color_group }) =>
      distinct_color_group
    )).size,
    1,
  );
});

test("Oslo Hat ma osiem wariantów z dwiema nitkami", () => {
  const variants = getPattern(
    "Oslohuen_2.0_ENGELSK.pdf",
  ).matching_requirements.variants;
  assert.equal(variants.length, 8);
  assert.equal(
    variants.every(({ requirements }) => requirements[0].strand_count === 2),
    true,
  );
  assert.equal(
    variants.find(({ id }) => id === "xs-arwetta")
      .requirements[0].meters_min,
    420,
  );
  assert.equal(
    variants.find(({ id }) => id === "l-sunday")
      .requirements[0].meters_min,
    705,
  );
});

test("materiały dopasowania pochodzą ze wspólnej listy", () => {
  const allowed = new Set(MATERIALS.map(({ value }) => value));
  const matchingMaterials = records.flatMap((record) =>
    record.matching_requirements.variants.flatMap((variant) =>
      variant.requirements.flatMap((requirement) => requirement.materials)
    )
  );
  assert.equal(matchingMaterials.every((material) => allowed.has(material)), true);
});
