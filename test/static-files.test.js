const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { createStaticFileHandler } = require("../server/static-files");

function createResponse() {
  return {
    headers: null,
    status: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}

test("serwuje wyłącznie zasób z jawnej mapy i dobiera bezpieczny content-type", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "motek-static-"));
  await fs.writeFile(path.join(rootDir, "index.html"), "<main>ok</main>");
  const handler = createStaticFileHandler({
    rootDir,
    files: { "/": "index.html" },
  });
  const response = createResponse();

  assert.equal(await handler.handle({ method: "GET" }, response, "/"), true);
  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "text/html; charset=utf-8");
  assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(response.body.toString(), "<main>ok</main>");
});

test("odrzuca ścieżkę spoza allowlisty oraz metody inne niż GET", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "motek-static-"));
  await fs.writeFile(path.join(rootDir, "index.html"), "ok");
  const handler = createStaticFileHandler({
    rootDir,
    files: { "/": "index.html" },
  });

  const unknownResponse = createResponse();
  assert.equal(await handler.handle({ method: "GET" }, unknownResponse, "/../package.json"), false);
  assert.equal(unknownResponse.status, null);

  const methodResponse = createResponse();
  assert.equal(await handler.handle({ method: "POST" }, methodResponse, "/"), false);
  assert.equal(methodResponse.status, null);
});

test("zwraca 404 dla zasobu z mapy, który nie istnieje na dysku", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "motek-static-"));
  const handler = createStaticFileHandler({
    rootDir,
    files: { "/missing.js": "missing.js" },
  });
  const response = createResponse();

  assert.equal(await handler.handle({ method: "GET" }, response, "/missing.js"), true);
  assert.equal(response.status, 404);
  assert.equal(response.headers["Content-Type"], "text/plain; charset=utf-8");
});
