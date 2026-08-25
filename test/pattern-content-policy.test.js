const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  validatePatternAuditManifest,
  toPublicationFields,
  buildManualPatternDraft,
} = require("../pattern-content-policy");
const { normalizeMatchingDocument } = require("../matching-policy");

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

test("publikacja wymaga techniki, a nieznana wartość jest odrzucana", () => {
  const base = { source_filename: "a", status: "published", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", official_source_url: "https://example.com/pattern", fields: [{ name: "name", basis: "neutral_fact", decision: "publish", source_reference: "x" }] };
  assert.throws(
    () => validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "1.0", records: [base] }),
    /wymaga techniki/,
  );
  assert.throws(
    () => validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "1.0", records: [{ ...base, technique: "szydełko" }] }),
    /Nieprawidłowa technika/,
  );
  const result = validatePatternAuditManifest([{ source_filename: "a" }], { audit_version: "1.0", records: [{ ...base, technique: "crochet" }] });
  assert.equal(result.records[0].technique, "crochet");
});

test("rekord ukryty może mieć technikę albo ją pominąć", () => {
  const hiddenBase = { source_filename: "h.pdf", status: "hidden", source_kind: "pdf", audited_at: "2026-08-09T00:00:00Z", fields: [] };
  assert.equal(
    validatePatternAuditManifest([{ source_filename: "h.pdf" }], { audit_version: "1.0", records: [hiddenBase] }).records[0].technique,
    null,
  );
  assert.equal(
    validatePatternAuditManifest([{ source_filename: "h.pdf" }], { audit_version: "1.0", records: [{ ...hiddenBase, technique: "knitting" }] }).records[0].technique,
    "knitting",
  );
});

test("generator rozpoznaje trzy rekordy syntetyczne po nazwie", () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "motek-pattern-audit-"));
  const outputPath = path.join(tempDirectory, "manifest.json");
  try {
    execFileSync(process.execPath, [
      path.join(__dirname, "..", "scripts", "build-pattern-content-audit.js"),
      "--replace",
      "--output",
      outputPath,
    ]);
    const manifest = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(manifest.records.filter((record) => record.source_kind === "synthetic").length, 3);
    assert.equal(manifest.records.filter((record) => record.source_filename.endsWith(".synthetic.json")).every((record) => record.source_kind === "synthetic"), true);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
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

function manualPatternInput(overrides = {}) {
  return {
    name: "Czapka na szydełku",
    projectType: "head_accessory",
    technique: "crochet",
    materials: ["bawełna"],
    variantLabel: "Podstawowy",
    requirements: [
      {
        role: "kolor główny",
        measurementBasis: "grams",
        quantityMin: 100,
        materialMatch: "any_material",
        materials: [],
        colorMode: "same",
        weightClasses: ["dk"],
      },
    ],
    ...overrides,
  };
}

test("buduje draft wzoru ręcznego jako pending_review z dokumentem wymagań v2", () => {
  const draft = buildManualPatternDraft(manualPatternInput(), { newId: () => "abc-1" });
  assert.equal(draft.publication_status, "pending_review");
  assert.equal(draft.needs_review, true);
  assert.equal(draft.source_filename, "manual:abc-1");
  assert.equal(draft.content_audit_version, null);
  assert.equal(draft.description, null);
  assert.deepEqual(
    draft.matching_requirements,
    {
      version: 2,
      variants: [
        {
          id: "reczne-zgloszenie",
          label: "Podstawowy",
          requirements: [
            {
              role: "kolor główny",
              measurement_basis: "grams",
              grams_min: 100,
              materials: [],
              material_match: "any_material",
              color_mode: "same",
              weight_classes: ["dk"],
            },
          ],
        },
      ],
    },
  );
});

test("draft ręczny przechodzi walidację matchera i triggera (format snake_case)", () => {
  const draft = buildManualPatternDraft(manualPatternInput({
    requirements: [
      {
        role: "kolor główny",
        measurementBasis: "meters",
        quantityMin: 300,
        quantityMax: 350,
        materialMatch: "any",
        materials: ["bawełna", "akryl"],
        colorMode: "any",
        weightClasses: ["dk", "sport"],
      },
    ],
  }));
  const variant = normalizeMatchingDocument(draft.matching_requirements)[0];
  assert.equal(variant.requirements[0].metersMin, 300);
  assert.equal(variant.requirements[0].metersMax, 350);
  assert.deepEqual(variant.requirements[0].weightClasses, ["dk", "sport"]);
});

test("payload użytkownika nie może nadpisać statusu, audytu ani źródła", () => {
  const draft = buildManualPatternDraft(manualPatternInput({
    publication_status: "published",
    needs_review: false,
    source_filename: "podrzucony.pdf",
    content_audit_version: "9.9",
    matching_requirements: { version: 1 },
    technique: "crochet",
  }), { newId: () => "safe-1" });
  assert.equal(draft.publication_status, "pending_review");
  assert.equal(draft.needs_review, true);
  assert.equal(draft.source_filename, "manual:safe-1");
  assert.equal(draft.content_audit_version, null);
});

test("odrzuca niepełny lub błędny formularz wzoru ręcznego", () => {
  assert.throws(() => buildManualPatternDraft(manualPatternInput({ name: "  " })), /nazwa/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({ name: "x".repeat(201) })), /200 znaków/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({ description: "instrukcja wykonania" })), /instrukcji/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({ projectType: "magic" })), /typ projektu/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({ technique: "spinning" })), /technikę/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({ materials: ["smok"] })), /Materiały/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({ metersPer100g: -5 })), /metraż/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({ sourceUrl: "http://example.com" })), /HTTPS/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({ requirements: [] })), /1 do 8 ról/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({
    requirements: [{ role: "główny", measurementBasis: "grams", quantityMin: 10, quantityMax: 5, materialMatch: "any_material", colorMode: "same", weightClasses: ["dk"] }],
  })), /mniejsza od minimalnej/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({
    requirements: [{ role: "główny", measurementBasis: "grams", quantityMin: 10, materialMatch: "any_material", colorMode: "same", weightClasses: [] }],
  })), /grubość/);
  assert.throws(() => buildManualPatternDraft(manualPatternInput({
    requirements: [{ role: "główny", measurementBasis: "grams", quantityMin: 10, materialMatch: "all", materials: [], colorMode: "same", weightClasses: ["dk"] }],
  })), /jeden materiał/);
});
