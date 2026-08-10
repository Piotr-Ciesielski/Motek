const { test } = require("node:test");
const assert = require("node:assert/strict");

const { buildRegistrationAuthPayload } = require("../client-policy");
const { CURRENT_LEGAL_DOCUMENT } = require("../legal-document");

const {
  normalizeAuthEmail,
  normalizeAuthLogin,
  validateAuthPassword,
  buildAuthCookie,
  createAccountDeletionRateLimiter,
  createAuthRateLimiter,
  createRequestRateLimiter,
  shouldUseSecureCookies,
  validateCookieSecurityConfig,
} = require("../server");

test("payload rejestracji przekazuje boolean akceptacji i bieżące wersje prawa", () => {
  const payload = buildRegistrationAuthPayload(
    {
      login: "jan@example.com",
      password: "Haslo123!",
      invitationToken: "invite-token",
      termsAccepted: true,
      termsVersion: CURRENT_LEGAL_DOCUMENT.termsVersion,
      privacyNoticeVersion: CURRENT_LEGAL_DOCUMENT.privacyVersion,
    },
    { legalDocument: CURRENT_LEGAL_DOCUMENT },
  );

  assert.deepEqual(payload, {
    login: "jan@example.com",
    password: "Haslo123!",
    invitationToken: "invite-token",
    termsAccepted: true,
    termsVersion: CURRENT_LEGAL_DOCUMENT.termsVersion,
    privacyNoticeVersion: CURRENT_LEGAL_DOCUMENT.privacyVersion,
  });
  assert.equal(typeof payload.termsAccepted, "boolean");
});

test("payload rejestracji odrzuca nieaktualną wersję dokumentu", () => {
  assert.throws(
    () => buildRegistrationAuthPayload(
      {
        login: "jan@example.com",
        password: "Haslo123!",
        invitationToken: "invite-token",
        termsAccepted: true,
        termsVersion: "0.9",
        privacyNoticeVersion: CURRENT_LEGAL_DOCUMENT.privacyVersion,
      },
      { legalDocument: CURRENT_LEGAL_DOCUMENT },
    ),
    /Odśwież stronę|wersj/i,
  );
});

test("normalizacja Auth trimuje i ujednolica e-mail oraz login jako e-mail", () => {
  assert.equal(normalizeAuthEmail("  JAN+test@Domena.pl  "), "jan+test@domena.pl");
  assert.equal(normalizeAuthLogin("  JAN+test@Domena.pl  "), "jan+test@domena.pl");
});

test("walidacja Auth odrzuca niepoprawny e-mail i login", () => {
  assert.throws(() => normalizeAuthEmail("jan@"), /prawidłowy adres/);
  assert.throws(() => normalizeAuthLogin("ab"), /prawidłowy adres/);
  assert.throws(() => normalizeAuthLogin("Piotr_01"), /prawidłowy adres/);
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

test("limiter żądań blokuje zalewanie endpointu i wygasa", () => {
  let now = 0;
  const limiter = createRequestRateLimiter({
    windowMs: 100,
    maxRequests: 3,
    blockMs: 50,
    maxEntries: 2,
    now: () => now,
  });

  limiter.recordRequest("ip:127.0.0.1");
  limiter.recordRequest("ip:127.0.0.1");
  assert.equal(limiter.getRetryAfterMs("ip:127.0.0.1"), 0);
  limiter.recordRequest("ip:127.0.0.1");
  assert.equal(limiter.getRetryAfterMs("ip:127.0.0.1"), 50);

  now = 150;
  assert.equal(limiter.getRetryAfterMs("ip:127.0.0.1"), 0);
});

test("limiter usuwania konta blokuje po pięciu błędnych hasłach przez 15 minut", () => {
  let now = 0;
  const limiter = createAccountDeletionRateLimiter({ now: () => now });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    limiter.recordFailure("user:user-a");
    assert.equal(limiter.getRetryAfterMs("user:user-a"), 0);
  }

  limiter.recordFailure("user:user-a");
  assert.equal(limiter.getRetryAfterMs("user:user-a"), 15 * 60 * 1000);

  now = 15 * 60 * 1000;
  assert.equal(limiter.getRetryAfterMs("user:user-a"), 0);
});
