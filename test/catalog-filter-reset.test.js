const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const appJs = readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function functionSource(name) {
  const start = appJs.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `app.js nie zawiera funkcji ${name}`);
  const next = appJs.indexOf("\nfunction ", start + 1);
  return appJs.slice(start, next === -1 ? appJs.length : next);
}

test("reset filtrów katalogu pobiera katalog ponownie z serwera", () => {
  const source = functionSource("resetPatternCatalogFilters");
  assert.match(source, /patternTechniqueFilter\.value = "all"/);
  assert.match(source, /refreshPatternCatalog\(\)\.catch\(showPatternCatalogError\)/);
});

test("„pokaż w katalogu” pobiera katalog ponownie po zdjęciu filtru techniki", () => {
  const source = functionSource("showPatternInCatalog");
  assert.match(source, /patternTechniqueFilter\.value = "all"/);
  assert.match(source, /refreshPatternCatalog\(\)\.catch\(showPatternCatalogError\)/);
});
