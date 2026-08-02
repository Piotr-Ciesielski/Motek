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
