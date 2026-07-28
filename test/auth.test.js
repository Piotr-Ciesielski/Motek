const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeAuthEmail,
  normalizeAuthLogin,
  validateAuthPassword,
  buildAuthCookie,
  createAuthRateLimiter,
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

test("rate limiter blokuje serię nieudanych prób i wygasa po czasie", () => {
  let now = 0;
  const limiter = createAuthRateLimiter({
    windowMs: 100,
    maxFailures: 3,
    blockMs: 50,
    now: () => now,
  });

  limiter.recordFailure("ip:127.0.0.1");
  limiter.recordFailure("ip:127.0.0.1");
  assert.equal(limiter.getRetryAfterMs("ip:127.0.0.1"), 0);
  limiter.recordFailure("ip:127.0.0.1");
  assert.equal(limiter.getRetryAfterMs("ip:127.0.0.1"), 50);

  now = 50;
  assert.equal(limiter.getRetryAfterMs("ip:127.0.0.1"), 0);
  now = 100;
  limiter.recordFailure("ip:127.0.0.1");
  assert.equal(limiter.getRetryAfterMs("ip:127.0.0.1"), 0);
});

test("rate limiter usuwa wygasłe wpisy i nie przekracza limitu pamięci", () => {
  let now = 0;
  const limiter = createAuthRateLimiter({
    windowMs: 100,
    maxFailures: 2,
    blockMs: 50,
    maxEntries: 2,
    now: () => now,
  });

  limiter.recordFailure("email:a@example.com");
  limiter.recordFailure("email:b@example.com");
  assert.equal(limiter.size(), 2);

  limiter.recordFailure("email:c@example.com");
  assert.equal(limiter.size(), 2);
  assert.equal(limiter.getRetryAfterMs("email:a@example.com"), 0);

  now = 100;
  assert.equal(limiter.size(), 0);
});
