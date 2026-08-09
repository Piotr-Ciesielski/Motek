const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CURRENT_LEGAL_DOCUMENT,
  assertLegalDocumentShape,
  formatCopyrightNotice,
} = require("../legal-document");

test("dokument ma stabilną wersję i trzy wymagane sekcje", () => {
  assert.doesNotThrow(() => assertLegalDocumentShape(CURRENT_LEGAL_DOCUMENT));
  assert.match(CURRENT_LEGAL_DOCUMENT.termsVersion, /^\d+\.\d+$/);
  assert.equal(CURRENT_LEGAL_DOCUMENT.privacyVersion, "1.0");
  assert.deepEqual(
    CURRENT_LEGAL_DOCUMENT.sections.map(({ id }) => id),
    ["regulamin", "prywatnosc", "prawa-autorskie"],
  );
});

test("nota copyright ma dokładny format produktu", () => {
  assert.equal(
    formatCopyrightNotice(CURRENT_LEGAL_DOCUMENT),
    "© 2026 Motek — [IMIĘ I NAZWISKO OPERATORA]. Wszelkie prawa zastrzeżone.",
  );
});

test("walidator odrzuca niepoprawny kształt sekcji i bloków", () => {
  const cases = [
    ["sekcję bez id", { id: undefined }],
    ["duplikat identyfikatora", { duplicateId: true }],
    ["pusty tytuł", { title: "" }],
    ["niepoprawną wersję", { termsVersion: "v1" }],
    ["blok z nieznanym typem", { blockType: "html" }],
  ];

  for (const [description, override] of cases) {
    const document = structuredClone(CURRENT_LEGAL_DOCUMENT);
    if (override.duplicateId) {
      document.sections[1].id = document.sections[0].id;
    } else if (override.blockType) {
      document.sections[0].blocks.push({ type: override.blockType, text: "x" });
    } else {
      Object.assign(document, override);
      if (override.id === undefined) delete document.sections[0].id;
    }
    assert.throws(
      () => assertLegalDocumentShape(document),
      /prawidł|nieznan|unikal|tytuł|wersj|niepustym/i,
      description,
    );
  }
});
