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

test("walidator wymaga dokładnego zestawu sekcji i metadanych dokumentu", () => {
  const cases = [
    ["dowolne identyfikatory sekcji", (document) => {
      document.sections.forEach((section, index) => { section.id = `sekcja-${index}`; });
    }],
    ["błędną datę", (document) => { document.effectiveDate = "09-08-2026"; }],
    ["błędną ścieżkę", (document) => { document.path = "/prawne"; }],
    ["błędny rok copyright", (document) => { document.copyrightYear = "2026"; }],
    ["brak operatora", (document) => { document.operator = {}; }],
    ["błędny e-mail operatora", (document) => { document.operator.email = "kontakt"; }],
  ];

  for (const [description, mutate] of cases) {
    const document = structuredClone(CURRENT_LEGAL_DOCUMENT);
    mutate(document);
    assert.throws(() => assertLegalDocumentShape(document), /prawidł|wymaga|operator|ścieżk|rok|sekcj/i, description);
  }
});

test("walidator odrzuca HTML w tekstach strukturalnych", () => {
  const document = structuredClone(CURRENT_LEGAL_DOCUMENT);
  document.sections[0].blocks[0].text = "<strong>Niebezpieczny HTML</strong>";
  assert.throws(() => assertLegalDocumentShape(document), /HTML|tekst/i);
});

test("dokument jest głęboko niemutowalny", () => {
  try { CURRENT_LEGAL_DOCUMENT.operator.name = "Zmiana"; } catch (error) { assert.ok(error instanceof TypeError); }
  try { CURRENT_LEGAL_DOCUMENT.sections[0].blocks[0].text = "Zmiana"; } catch (error) { assert.ok(error instanceof TypeError); }
  try { CURRENT_LEGAL_DOCUMENT.sections[0].blocks[2].items.push("Zmiana"); } catch (error) { assert.ok(error instanceof TypeError); }
  assert.equal(CURRENT_LEGAL_DOCUMENT.operator.name, "[IMIĘ I NAZWISKO OPERATORA]");
  assert.equal(CURRENT_LEGAL_DOCUMENT.sections[0].blocks[0].text.startsWith("Motek"), true);
});
