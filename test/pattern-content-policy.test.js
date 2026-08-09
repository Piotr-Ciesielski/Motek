const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
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

test("wynik nie współdzieli zagnieżdżonych danych wejściowych", () => {
  const fields = [{ name: "name", basis: "neutral_fact", decision: "hide", source_reference: "x", value: "neutral" }];
  const manifest = { audit_version: "1.0", records: [{ source_filename: "a", status: "hidden", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields }] };
  const result = validatePatternAuditManifest([{ source_filename: "a" }], manifest);
  fields[0].value = "zmienione";
  fields.push({ name: "extra", basis: "neutral_fact", decision: "hide", source_reference: "x" });
  assert.equal(result.records[0].fields[0].value, "neutral");
  assert.equal(result.records[0].fields.length, 1);
});

test("publikacja PDF wymaga adresu HTTPS", () => {
  const entry = { source_filename: "a", status: "published", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields: [{ name: "name", basis: "neutral_fact", decision: "publish", source_reference: "x" }] };
  assert.throws(() => validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "1.0", records: [{ ...entry, official_source_url: "http://example.com" }] }), /https/);
});

test("generator rozpoznaje trzy rekordy syntetyczne po nazwie", () => {
  execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "build-pattern-content-audit.js"), "--replace"]);
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pattern-content-audit.json"), "utf8"));
  assert.equal(manifest.records.filter((record) => record.source_kind === "synthetic").length, 3);
  assert.equal(manifest.records.filter((record) => record.source_filename.endsWith(".synthetic.json")).every((record) => record.source_kind === "synthetic"), true);
});

test("odrzuca instruktaż w dowolnym stringu rekordu", () => {
  assert.throws(() => validatePatternAuditManifest([{ source_filename: "Instrukcja wykonania.pdf" }], { audit_version: "1.0", records: [{ source_filename: "Instrukcja wykonania.pdf", status: "hidden", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields: [] }] }), /instrukcj/i);
});

test("odrzuca brakujący lub nieobiektowy manifest kontrolowanym TypeError", () => {
  for (const manifest of [undefined, null, "manifest"]) {
    assert.throws(() => validatePatternAuditManifest([], manifest), TypeError);
  }
  assert.throws(() => validatePatternAuditManifest(null, {}), TypeError);
});
