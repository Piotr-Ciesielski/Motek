const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeAuthEmail,
  normalizeAuthLogin,
  validateAuthPassword,
} = require("../server");

test("normalizacja Auth trimuje i ujednolica e-mail oraz login", () => {
  assert.equal(normalizeAuthEmail("  JAN+test@Domena.pl  "), "jan+test@domena.pl");
  assert.equal(normalizeAuthLogin("  Piotr_01  "), "piotr_01");
});

test("walidacja Auth odrzuca niepoprawny e-mail i login", () => {
  assert.throws(() => normalizeAuthEmail("jan@"), /prawidłowy adres/);
  assert.throws(() => normalizeAuthLogin("ab"), /3-30/);
  assert.throws(() => normalizeAuthLogin("jan😀"), /3-30/);
});

test("walidacja hasła wymaga podstawowej różnorodności znaków", () => {
  assert.equal(validateAuthPassword("Hasłó123!"), "Hasłó123!");
  assert.throws(() => validateAuthPassword("password"), /małą i wielką/);
  assert.throws(() => validateAuthPassword("Aa1      "), /wyłącznie ze spacji|znak specjalny/);
});
