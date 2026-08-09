const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  importRecords,
  validateImportCapacity,
  validatePatternAuditManifest,
} = require("../scripts/import-patterns");

test("import wzorów odrzuca wynik powyżej limitu katalogu", () => {
  assert.doesNotThrow(() => validateImportCapacity({ tableRecordCount: 299, newRecordCount: 1 }));
  assert.throws(
    () => validateImportCapacity({ tableRecordCount: 299, newRecordCount: 2 }),
    /maksymalnie 300 rekordów/
  );
});

test("import wzorów wysyła cały zatwierdzony zestaw jednym upsertem", async () => {
  const records = [{ source_filename: "a.pdf" }, { source_filename: "b.pdf" }];
  let calls = 0;
  const client = {
    from(table) {
      assert.equal(table, "patterns");
      return {
        upsert(payload, options) {
          calls += 1;
          assert.deepEqual(payload, records);
          assert.deepEqual(options, { onConflict: "source_filename" });
          return {
            async select(columns) {
              assert.equal(columns, "id");
              return { data: [{ id: 1 }, { id: 2 }], error: null };
            },
          };
        },
      };
    },
  };

  assert.equal(await importRecords(client, records), 2);
  assert.equal(calls, 1);
});

test("import odrzuca brak decyzji audytu i pola dowodu przed zapisem", () => {
  assert.throws(
    () => validatePatternAuditManifest([{ source_filename: "a.pdf" }]),
    /brak decyzji audytu/
  );
  assert.throws(
    () => validatePatternAuditManifest([{ source_filename: "a.pdf", publication_status: "pending_review" }]),
    /pending_review/
  );
  assert.throws(
    () => validatePatternAuditManifest([{ source_filename: "a.pdf", publication_status: "hidden", evidence: ["fragment"] }]),
    /pole dowodu/
  );
});

test("import dopuszcza ukryty rekord bez dowodów i jawnie opublikowany syntetyczny", () => {
  assert.doesNotThrow(() => validatePatternAuditManifest([
    { source_filename: "a.pdf", publication_status: "hidden" },
    { source_filename: "demo.synthetic.json", publication_status: "published", source_kind: "synthetic", content_audit_version: "1.0", content_audited_at: "2026-08-09T00:00:00Z" },
  ]));
});
