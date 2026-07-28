const { test } = require("node:test");
const assert = require("node:assert/strict");

const limits = require("../limits");

test("limity produktu są współdzielone przez backend i importer", () => {
  assert.deepEqual(limits, {
    maxYarnsPerUser: 500,
    maxPatternCatalogRecords: 300,
    maxMatchingVariantsPerPattern: 250,
    maxMatchingRoleRequirements: 8,
    maxMatchingTextLength: 100,
  });
});
