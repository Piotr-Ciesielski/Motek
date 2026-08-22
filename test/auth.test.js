const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const { buildRegistrationAuthPayload } = require("../client-policy");
const { CURRENT_LEGAL_DOCUMENT } = require("../legal-document");

const {
  normalizeAuthEmail,
  normalizeAuthLogin,
  validateAuthPassword,
  buildAuthCookie,
  createAccountDeletionRateLimiter,
  createAuthRateLimiter,
  createAuthRequestRateLimiters,
  createRequestRateLimiter,
  enforceAuthRateLimit,
  enforceRequestRateLimit,
  AUTH_REQUEST_LIMITS,
  recordAuthFailure,
  shouldUseSecureCookies,
  validateCookieSecurityConfig,
} = require("../server");

const appJs = readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("zmiana hasła lokalnie odrzuca niezgodne nowe hasła", () => {
  assert.match(
    appJs,
    /const passwordConfirmation = formValues\.newSecretConfirmation;[\s\S]*?if \(formValues\.newSecret !== passwordConfirmation\) \{[\s\S]*?return;/,
  );
});

const VALID_INVITATION_TOKEN = "A".repeat(64);

test("payload rejestracji przekazuje boolean akceptacji i bieżące wersje prawa", () => {
  const payload = buildRegistrationAuthPayload(
    {
      login: "jan@example.com",
      password: "Haslo123!",
      invitationToken: VALID_INVITATION_TOKEN,
      termsAccepted: true,
      termsVersion: CURRENT_LEGAL_DOCUMENT.termsVersion,
      privacyNoticeVersion: CURRENT_LEGAL_DOCUMENT.privacyVersion,
    },
    { legalDocument: CURRENT_LEGAL_DOCUMENT },
  );

  assert.deepEqual(payload, {
    login: "jan@example.com",
    password: "Haslo123!",
    invitationToken: VALID_INVITATION_TOKEN,
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
        invitationToken: VALID_INVITATION_TOKEN,
        termsAccepted: true,
        termsVersion: "0.9",
        privacyNoticeVersion: CURRENT_LEGAL_DOCUMENT.privacyVersion,
      },
      { legalDocument: CURRENT_LEGAL_DOCUMENT },
    ),
    /Odśwież stronę|wersj/i,
  );
});

test("payload rejestracji odrzuca token zaproszenia bez pełnego linku", () => {
  assert.throws(
    () => buildRegistrationAuthPayload(
      {
        login: "jan@example.com",
        password: "Haslo123!",
        invitationToken: "niepelny-token",
        termsAccepted: true,
        termsVersion: CURRENT_LEGAL_DOCUMENT.termsVersion,
        privacyNoticeVersion: CURRENT_LEGAL_DOCUMENT.privacyVersion,
      },
      { legalDocument: CURRENT_LEGAL_DOCUMENT },
    ),
    /pełny link zaproszenia/i,
  );
});

test("payload rejestracji akceptuje wyłącznie URL-safe token po trimowaniu", () => {
  const payload = buildRegistrationAuthPayload(
    {
      login: "jan@example.com",
      password: "Haslo123!",
      invitationToken: ` ${VALID_INVITATION_TOKEN} `,
      termsAccepted: true,
      termsVersion: CURRENT_LEGAL_DOCUMENT.termsVersion,
      privacyNoticeVersion: CURRENT_LEGAL_DOCUMENT.privacyVersion,
    },
    { legalDocument: CURRENT_LEGAL_DOCUMENT },
  );

  assert.equal(payload.invitationToken, VALID_INVITATION_TOKEN);
  assert.throws(
    () => buildRegistrationAuthPayload(
      {
        login: "jan@example.com",
        password: "Haslo123!",
        invitationToken: `${"A".repeat(63)}!`,
        termsAccepted: true,
        termsVersion: CURRENT_LEGAL_DOCUMENT.termsVersion,
        privacyNoticeVersion: CURRENT_LEGAL_DOCUMENT.privacyVersion,
      },
      { legalDocument: CURRENT_LEGAL_DOCUMENT },
    ),
    /pełny link zaproszenia/i,
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

test("walidacja hasła odrzuca brakujące i puste wartości", () => {
  assert.throws(() => validateAuthPassword(undefined), /8 do 256/);
  assert.throws(() => validateAuthPassword(null), /8 do 256/);
  assert.throws(() => validateAuthPassword(""), /8 do 256/);
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

test("limity żądań Auth mają osobne progi i okna", () => {
  assert.deepEqual(AUTH_REQUEST_LIMITS, {
    login: { windowMs: 60 * 1000, maxRequests: 10, blockMs: 60 * 1000 },
    register: { windowMs: 60 * 1000, maxRequests: 3, blockMs: 60 * 1000 },
    "password-reset-request": {
      windowMs: 15 * 60 * 1000,
      maxRequests: 3,
      blockMs: 15 * 60 * 1000,
    },
    "password-change": {
      windowMs: 15 * 60 * 1000,
      maxRequests: 30,
      blockMs: 15 * 60 * 1000,
    },
    recovery: { windowMs: 10 * 60 * 1000, maxRequests: 5, blockMs: 10 * 60 * 1000 },
  });
});

test("każdy limiter Auth odrzuca po swoim progu", () => {
  const limiters = createAuthRequestRateLimiters({ now: () => 0 });
  for (const [operation, limits] of Object.entries(AUTH_REQUEST_LIMITS)) {
    const limiter = limiters[operation];
    for (let index = 0; index < limits.maxRequests; index += 1) {
      limiter.recordRequest(`ip:${operation}`);
    }
    assert.equal(limiter.getRetryAfterMs(`ip:${operation}`), limits.blockMs, operation);
  }
});

test("lockout nieudanych prób Auth zwiększa metrykę operacji", () => {
  assert.equal(typeof enforceAuthRateLimit, "function");
  assert.equal(typeof recordAuthFailure, "function");
  if (typeof enforceAuthRateLimit !== "function" || typeof recordAuthFailure !== "function") return;

  const keys = ["ip:198.51.100.99", "email:lockout-test@example.com"];
  const response = { headers: new Map(), setHeader(name, value) { this.headers.set(name, value); } };
  const observedOperations = [];
  const metrics = { observeAuthRateLimitRejection(operation) { observedOperations.push(operation); } };
  for (let attempt = 0; attempt < 5; attempt += 1) recordAuthFailure(keys);

  assert.throws(
    () => enforceAuthRateLimit(keys, response, "login", metrics),
    (error) => error.status === 429,
  );
  assert.equal(response.headers.get("Retry-After"), "900");
  assert.deepEqual(observedOperations, ["login"]);
});

test("limit Auth odpowiada 429 i Retry-After po przekroczeniu progu", () => {
  assert.equal(typeof createAuthRequestRateLimiters, "function");
  assert.equal(typeof enforceRequestRateLimit, "function");
  if (typeof createAuthRequestRateLimiters !== "function" || typeof enforceRequestRateLimit !== "function") return;

  let now = 0;
  const limiter = createAuthRequestRateLimiters({ now: () => now }).login;
  const response = { headers: new Map(), setHeader(name, value) { this.headers.set(name, value); } };
  const observedOperations = [];
  const metrics = { observeAuthRateLimitRejection(operation) { observedOperations.push(operation); } };
  for (let index = 0; index < AUTH_REQUEST_LIMITS.login.maxRequests; index += 1) {
    limiter.recordRequest("ip:127.0.0.1");
  }

  assert.throws(
    () => enforceRequestRateLimit(["ip:127.0.0.1"], limiter, response, "login", metrics),
    (error) => error.status === 429,
  );
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.deepEqual(observedOperations, ["login"]);
});

test("reset hasła limituje wspólnie po IP i e-mailu, a recovery wyłącznie po IP", () => {
  let now = 0;
  const limiters = createAuthRequestRateLimiters({ now: () => now });
  const response = { headers: new Map(), setHeader(name, value) { this.headers.set(name, value); } };

  for (let index = 0; index < AUTH_REQUEST_LIMITS["password-reset-request"].maxRequests; index += 1) {
    enforceRequestRateLimit(
      ["ip:127.0.0.1", "email:a@example.com"],
      limiters["password-reset-request"],
      response,
      "password-reset-request",
    );
  }
  assert.throws(
    () => enforceRequestRateLimit(
      ["ip:203.0.113.8", "email:a@example.com"],
      limiters["password-reset-request"],
      response,
      "password-reset-request",
    ),
    (error) => error.status === 429,
  );
  assert.throws(
    () => enforceRequestRateLimit(
      ["ip:127.0.0.1", "email:b@example.com"],
      limiters["password-reset-request"],
      response,
      "password-reset-request",
    ),
    (error) => error.status === 429,
  );

  now = AUTH_REQUEST_LIMITS["password-reset-request"].blockMs;
  enforceRequestRateLimit(
    ["ip:127.0.0.1", "email:b@example.com"],
    limiters["password-reset-request"],
    response,
    "password-reset-request",
  );

  now = 0;
  const recoveryResponse = { headers: new Map(), setHeader(name, value) { this.headers.set(name, value); } };
  for (let index = 0; index < AUTH_REQUEST_LIMITS.recovery.maxRequests; index += 1) {
    enforceRequestRateLimit(["ip:127.0.0.1"], limiters.recovery, recoveryResponse, "recovery");
  }
  assert.throws(
    () => enforceRequestRateLimit(["ip:127.0.0.1"], limiters.recovery, recoveryResponse, "recovery"),
    (error) => error.status === 429,
  );
  assert.equal(recoveryResponse.headers.get("Retry-After"), "600");
  enforceRequestRateLimit(["ip:203.0.113.8"], limiters.recovery, recoveryResponse, "recovery");
});
