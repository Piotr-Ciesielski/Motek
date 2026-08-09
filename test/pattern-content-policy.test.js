const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validatePatternAuditManifest,
  toPublicationFields,
} = require("../pattern-content-policy");

test("odrzuca rekord bez decyzji audytowej", () => {
  assert.throws(
    () => validatePatternAuditManifest(
      [{ source_filename: "a.pdf" }],
      { audit_version: "1.0", records: [] },
    ),
    /a\.pdf.*decyzji audytowej/,
  );
});

test("ukryty rekord PDF nie przechowuje treści źródłowej", () => {
  const result = validatePatternAuditManifest(
    [{ source_filename: "a.pdf" }],
    { audit_version: "1.0", records: [{ source_filename: "a.pdf", status: "hidden", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields: [] }] },
  );
  assert.equal(result.records[0].status, "hidden");
  assert.equal(toPublicationFields(result.records[0]).publication_status, "hidden");
});

test("publikacja wymaga podstawy każdego pola", () => {
  assert.throws(
    () => validatePatternAuditManifest(
      [{ source_filename: "demo" }],
      { audit_version: "1.0", records: [{ source_filename: "demo", status: "published", source_kind: "synthetic", audited_at: "2026-08-09T00:00:00Z", fields: [] }] },
    ),
    /podstawy pola/,
  );
});

test("odrzuca nieznane pola dowodowe i publikację bez źródła", () => {
  assert.throws(
    () => validatePatternAuditManifest(
      [{ source_filename: "demo" }],
      { audit_version: "1.0", records: [{ source_filename: "demo", status: "published", source_kind: "synthetic", audited_at: "2026-08-09T00:00:00Z", fields: [{ name: "name", basis: "synthetic", decision: "publish" }], excerpt: "tekst" }] },
    ),
    /niedozwolone|źródła/,
  );
});

test("odrzuca nieznany rekord i duplikat źródła", () => {
  assert.throws(() => validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "1.0", records: [{ source_filename: "b", status: "hidden", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields: [] }] }), /nieznany/);
  assert.throws(() => validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "1.0", records: [{ source_filename: "a", status: "hidden", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields: [] }, { source_filename: "a", status: "hidden", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields: [] }] }), /duplikat/);
});

test("odrzuca błędny status, wersję, datę i pustą podstawę", () => {
  const base = { source_filename: "a", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields: [] };
  assert.throws(() => validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "1.0", records: [{ ...base, status: "review" }] }), /status/);
  assert.throws(() => validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "", records: [{ ...base, status: "hidden" }] }), /audit_version/);
  assert.throws(() => validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "1.0", records: [{ ...base, status: "hidden", audited_at: "" }] }), /audited_at/);
  assert.throws(() => validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "1.0", records: [{ ...base, status: "published", source_kind: "synthetic", fields: [{ name: "name", basis: "", decision: "publish", source_reference: "synthetic" }] }] }), /podstawy/);
});

test("odrzuca instruktażowy opis", () => {
  assert.throws(() => validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "1.0", records: [{ source_filename: "a", status: "hidden", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields: [{ name: "description", basis: "neutral_fact", decision: "hide", source_reference: "x", value: "Instrukcja wykonania" }] }] }), /instrukcj/i);
});

test("manifest wynikowy jest zamrożony", () => {
  const result = validatePatternAuditManifest([{ source_filename: "a.pdf" }], { audit_version: "1.0", records: [{ source_filename: "a.pdf", status: "hidden", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields: [] }] });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.records), true);
});
