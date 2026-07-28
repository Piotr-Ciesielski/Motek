const { test } = require("node:test");
const assert = require("node:assert/strict");

const { validateImportCapacity } = require("../scripts/import-patterns");

test("import wzorów odrzuca wynik powyżej limitu katalogu", () => {
  assert.doesNotThrow(() => validateImportCapacity({ tableRecordCount: 299, newRecordCount: 1 }));
  assert.throws(
    () => validateImportCapacity({ tableRecordCount: 299, newRecordCount: 2 }),
    /maksymalnie 300 rekordów/
  );
});
