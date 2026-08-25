const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  TECHNIQUES,
  isValidTechnique,
  normalizePatternTechnique,
  parseTechniqueParam,
  matchesPatternTechniqueFilter,
} = require("../technique-policy");

test("polityka technik dopuszcza wyłącznie druty i szydełko", () => {
  assert.deepEqual(TECHNIQUES, ["knitting", "crochet"]);
  assert.equal(isValidTechnique("knitting"), true);
  assert.equal(isValidTechnique("crochet"), true);
  assert.equal(isValidTechnique("weaving"), false);
  assert.equal(isValidTechnique(""), false);
  assert.equal(isValidTechnique(null), false);
});

test("technika wzoru jest normalizowana do null poza dozwolonym zbiorem", () => {
  assert.equal(normalizePatternTechnique("crochet"), "crochet");
  assert.equal(normalizePatternTechnique("CROCHET"), null);
  assert.equal(normalizePatternTechnique(undefined), null);
  assert.equal(normalizePatternTechnique(42), null);
});

test("parametr techniki: brak oznacza brak filtra, pusty i nieznany błąd", () => {
  assert.equal(parseTechniqueParam(null), undefined);
  assert.equal(parseTechniqueParam(undefined), undefined);
  assert.equal(parseTechniqueParam("knitting"), "knitting");
  assert.throws(() => parseTechniqueParam(""), /niedozwoloną wartość/);
  assert.throws(() => parseTechniqueParam("sprzęt"), /niedozwoloną wartość/);
});

test("filtr techniki przepuszcza wszystko tylko przy braku wyboru", () => {
  const knitting = { technique: "knitting" };
  const crochet = { technique: "crochet" };
  const unknown = {};

  assert.equal(matchesPatternTechniqueFilter(knitting, "all"), true);
  assert.equal(matchesPatternTechniqueFilter(crochet, undefined), true);
  assert.equal(matchesPatternTechniqueFilter(knitting, "knitting"), true);
  assert.equal(matchesPatternTechniqueFilter(knitting, "crochet"), false);
  assert.equal(matchesPatternTechniqueFilter(unknown, "crochet"), false);
});
