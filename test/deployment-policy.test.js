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
    /NODE_ENV, APP_ORIGIN, COOKIE_SECURE, HOST, TRUST_PROXY, CAPTCHA_ENABLED, CAPTCHA_PROVIDER, CAPTCHA_SITE_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY/,
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
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "secret-key",
    SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  };
  assert.doesNotThrow(() => validateDeploymentConfig(env));
  assert.deepEqual(readCaptchaConfig(env), {
    enabled: true,
    provider: "turnstile",
    siteKey: "public-site-key",
  });
});

test("production odrzuca niebezpieczną konfigurację bez ujawniania wartości", () => {
  const secretLikeValue = "do-not-print-this";
  assert.throws(
    () => validateDeploymentConfig({ DEPLOYMENT_ENV: "production", CAPTCHA_SITE_KEY: secretLikeValue }),
    (error) =>
      error.message.includes("NODE_ENV") &&
      error.message.includes("APP_ORIGIN") &&
      error.message.includes("SUPABASE_SECRET_KEY") &&
      !error.message.includes(secretLikeValue),
  );
});

test("production akceptuje kompletną bezpieczną konfigurację", () => {
  assert.doesNotThrow(() =>
    validateDeploymentConfig({
      DEPLOYMENT_ENV: "production",
      NODE_ENV: "production",
      APP_ORIGIN: "https://motek.example.test",
      COOKIE_SECURE: "true",
      HOST: "0.0.0.0",
      TRUST_PROXY: "true",
      CAPTCHA_ENABLED: "true",
      CAPTCHA_PROVIDER: "turnstile",
      CAPTCHA_SITE_KEY: "public-site-key",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEY: "secret-key",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    }),
  );
});

test("błąd konfiguracji nie ujawnia wartości", () => {
  const secretLikeValue = "do-not-print-this";
  assert.throws(
    () => validateDeploymentConfig({ DEPLOYMENT_ENV: "staging", CAPTCHA_SITE_KEY: secretLikeValue }),
    (error) => !error.message.includes(secretLikeValue),
  );
});
