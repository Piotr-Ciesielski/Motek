const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeAuthEmail,
  normalizeAuthLogin,
  validateAuthPassword,
  buildAuthCookie,
  shouldUseSecureCookies,
  validateCookieSecurityConfig,
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

test("produkcja wymaga jawnego Secure dla ciasteczek sesji", () => {
  assert.throws(
    () => validateCookieSecurityConfig({ NODE_ENV: "production", COOKIE_SECURE: "false" }),
    /COOKIE_SECURE=true/
  );
  assert.throws(
    () => validateCookieSecurityConfig({ NODE_ENV: "production" }),
    /COOKIE_SECURE=true/
  );
  assert.doesNotThrow(() =>
    validateCookieSecurityConfig({ NODE_ENV: "production", COOKIE_SECURE: "true" })
  );
});

test("Secure jest sterowane konfiguracją transportu", () => {
  assert.equal(shouldUseSecureCookies({ NODE_ENV: "development", COOKIE_SECURE: "true" }), true);
  assert.equal(shouldUseSecureCookies({ NODE_ENV: "production", COOKIE_SECURE: "false" }), false);
  assert.match(
    buildAuthCookie("motek_access_token", "token", 60, { NODE_ENV: "production", COOKIE_SECURE: "true" }),
    /; HttpOnly; SameSite=Lax; Max-Age=60; Secure$/
  );
});
