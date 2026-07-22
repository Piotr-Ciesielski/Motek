const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const tempDir = path.join(os.tmpdir(), `motek-test-${process.pid}-${Date.now()}`);
process.env.HOST = "127.0.0.1";
process.env.PORT = "0";
process.env.DATABASE_FILE = path.join(tempDir, "motek-test.sqlite");

const { main, shutdown } = require("../server");

test("serwer Motek działa bezpiecznie", async (t) => {
  await fs.mkdir(tempDir, { recursive: true });
  const runtime = await main();
  const baseUrl = `http://${runtime.host}:${runtime.port}`;

  try {
    await t.test("zgłasza stan zdrowia bez ujawniania szczegółów", async () => {
      const response = await fetch(`${baseUrl}/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "ok" });
      assert.equal(response.headers.get("cache-control"), "no-store");
    });

    await t.test("zwraca zabezpieczoną stronę", async () => {
      const response = await fetch(`${baseUrl}/`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    });

    await t.test("zapisuje i usuwa poprawną włóczkę w osobnej bazie", async () => {
      const createResponse = await fetch(`${baseUrl}/api/yarns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test automatyczny",
          color: "zielony",
          material: "wełna",
          weightClass: "dk",
          length: 250,
          weight: 100,
        }),
      });
      assert.equal(createResponse.status, 201);
      const created = await createResponse.json();
      assert.equal(created.name, "Test automatyczny");

      const deleteResponse = await fetch(`${baseUrl}/api/yarns/${created.id}`, { method: "DELETE" });
      assert.equal(deleteResponse.status, 204);
    });

    await t.test("odrzuca nieprawidłowe i zbyt duże dane", async () => {
      const invalidResponse = await fetch(`${baseUrl}/api/yarns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Błędny test",
          color: "zielony",
          material: "nieznany",
          weightClass: "dk",
          length: -1,
          weight: 100,
        }),
      });
      assert.equal(invalidResponse.status, 400);

      const oversizedResponse = await fetch(`${baseUrl}/api/yarns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x".repeat(17_000) }),
      });
      assert.equal(oversizedResponse.status, 413);
    });
  } finally {
    await shutdown("test");
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  await assert.rejects(fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(1_000) }));
});
