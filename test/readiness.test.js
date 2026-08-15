const test = require("node:test");
const assert = require("node:assert/strict");
const { main, shutdown } = require("../server");

test("liveness działa, gdy Supabase jest czasowo niedostępne", async () => {
  const runtime = await main({
    supabaseConnection: {
      async verify() { throw new Error("database unavailable"); },
    },
    supabaseAuthConfig: {
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test",
    },
    captchaConfig: { enabled: false, provider: null, siteKey: null },
    readinessIntervalMs: 0,
  });
  const baseUrl = `http://${runtime.host}:${runtime.port}`;
  try {
    assert.equal((await fetch(`${baseUrl}/health/live`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/health/ready`)).status, 503);
    assert.equal((await fetch(`${baseUrl}/`)).status, 503);
  } finally {
    await shutdown("readiness-test");
  }
});

test("produkcja uruchamia sesję przed uzupełnieniem manifestu publikacji prawnej", async () => {
  const keys = [
    "DEPLOYMENT_ENV",
    "NODE_ENV",
    "APP_ORIGIN",
    "COOKIE_SECURE",
    "HOST",
    "PORT",
    "TRUST_PROXY",
    "CAPTCHA_ENABLED",
    "CAPTCHA_PROVIDER",
    "CAPTCHA_SITE_KEY",
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    DEPLOYMENT_ENV: "production",
    NODE_ENV: "production",
    APP_ORIGIN: "https://www.rysia.org",
    COOKIE_SECURE: "true",
    HOST: "0.0.0.0",
    PORT: "0",
    TRUST_PROXY: "true",
    CAPTCHA_ENABLED: "true",
    CAPTCHA_PROVIDER: "turnstile",
    CAPTCHA_SITE_KEY: "public-test-key",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "service-role-test-key",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  });

  let runtime;
  try {
    runtime = await main({
      supabaseConnection: { async verify() {} },
      supabaseAuthConfig: {
        url: "https://project.supabase.co",
        publishableKey: "sb_publishable_test",
      },
      captchaConfig: { enabled: true, provider: "turnstile", siteKey: "public-test-key" },
      readinessIntervalMs: 0,
    });
    const response = await fetch(`http://127.0.0.1:${runtime.port}/health/ready`);
    assert.equal(response.status, 200);
  } finally {
    await shutdown("production-legal-readiness-test");
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
