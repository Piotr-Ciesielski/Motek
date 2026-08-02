const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeCaptchaToken,
  readCaptchaConfig,
  validateDeploymentConfig,
} = require("../deployment-policy");

test("token CAPTCHA jest wymagany tylko po włączeniu ochrony", () => {
  assert.equal(normalizeCaptchaToken(undefined, false), null);
  assert.equal(normalizeCaptchaToken(" token ", true), "token");
  assert.throws(() => normalizeCaptchaToken("", true), /CAPTCHA/);
  assert.throws(() => normalizeCaptchaToken("x".repeat(2049), true), /CAPTCHA/);
});

test("lokalne środowisko działa bez CAPTCHA", () => {
  assert.doesNotThrow(() => validateDeploymentConfig({ DEPLOYMENT_ENV: "local" }));
  assert.deepEqual(readCaptchaConfig({ CAPTCHA_ENABLED: "false" }), {
    enabled: false,
    provider: null,
    siteKey: null,
  });
});

test("staging wymaga bezpiecznego transportu i Turnstile", () => {
  assert.throws(
    () => validateDeploymentConfig({ DEPLOYMENT_ENV: "staging" }),
    /NODE_ENV, APP_ORIGIN, COOKIE_SECURE, HOST, TRUST_PROXY, CAPTCHA_ENABLED, CAPTCHA_PROVIDER, CAPTCHA_SITE_KEY/,
  );
  const env = {
    DEPLOYMENT_ENV: "staging",
    NODE_ENV: "production",
    APP_ORIGIN: "https://staging.example.test",
    COOKIE_SECURE: "true",
    HOST: "0.0.0.0",
    TRUST_PROXY: "true",
    CAPTCHA_ENABLED: "true",
    CAPTCHA_PROVIDER: "turnstile",
    CAPTCHA_SITE_KEY: "public-site-key",
  };
  assert.doesNotThrow(() => validateDeploymentConfig(env));
  assert.deepEqual(readCaptchaConfig(env), {
    enabled: true,
    provider: "turnstile",
    siteKey: "public-site-key",
  });
});

test("błąd konfiguracji nie ujawnia wartości", () => {
  const secretLikeValue = "do-not-print-this";
  assert.throws(
    () => validateDeploymentConfig({ DEPLOYMENT_ENV: "staging", CAPTCHA_SITE_KEY: secretLikeValue }),
    (error) => !error.message.includes(secretLikeValue),
  );
});
