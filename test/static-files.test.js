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

test("zwraca 304 po If-None-Match z tymi samymi nagłówkami cache i bez treści", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "motek-static-"));
  await fs.writeFile(path.join(rootDir, "index.html"), "<main>ok</main>");
  const handler = createStaticFileHandler({
    rootDir,
    files: { "/": "index.html" },
  });

  const first = createResponse();
  await handler.handle({ method: "GET", headers: {} }, first, "/");
  assert.equal(first.status, 200);
  const etag = first.headers.ETag;
  assert.match(etag, /^"[0-9a-f]{64}"$/);

  const second = createResponse();
  await handler.handle(
    { method: "GET", headers: { "if-none-match": `"inny", ${etag}` } },
    second,
    "/"
  );
  assert.equal(second.status, 304);
  assert.equal(second.headers["Cache-Control"], first.headers["Cache-Control"]);
  assert.equal(second.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(second.body, undefined);
});

test("JS z query v= lub rev= jest immutable, a bez query no-cache", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "motek-static-"));
  await fs.writeFile(path.join(rootDir, "app.js"), "console.log(1);");
  const handler = createStaticFileHandler({
    rootDir,
    files: { "/app.js": "app.js" },
  });
  const immutable = "public, max-age=31536000, immutable";

  for (const query of ["?v=2.0.0-alpha.39", "?v=2.0.0-alpha.39&rev=72dca17"]) {
    const response = createResponse();
    await handler.handle({ method: "GET", headers: {} }, response, `/app.js${query}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers["Cache-Control"], immutable);
  }

  const plain = createResponse();
  await handler.handle({ method: "GET", headers: {} }, plain, "/app.js");
  assert.equal(plain.headers["Cache-Control"], "no-cache");

  const otherQuery = createResponse();
  await handler.handle({ method: "GET", headers: {} }, otherQuery, "/app.js?x=1");
  assert.equal(otherQuery.headers["Cache-Control"], "no-cache");
});

test("HTML zawsze no-cache, nawet z query wersjonującym", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "motek-static-"));
  await fs.writeFile(path.join(rootDir, "index.html"), "<main>ok</main>");
  const handler = createStaticFileHandler({
    rootDir,
    files: { "/": "index.html" },
  });

  const versioned = createResponse();
  await handler.handle({ method: "GET", headers: {} }, versioned, "/?v=1");
  assert.equal(versioned.headers["Cache-Control"], "no-cache");

  const plain = createResponse();
  await handler.handle({ method: "GET", headers: {} }, plain, "/");
  assert.equal(plain.headers["Cache-Control"], "no-cache");
});

test("treść z cache jest identyczna przy kolejnym żądaniu", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "motek-static-"));
  const content = "body { color: rebeccapurple; }";
  await fs.writeFile(path.join(rootDir, "styles.css"), content);
  const handler = createStaticFileHandler({
    rootDir,
    files: { "/styles.css": "styles.css" },
  });

  const first = createResponse();
  const second = createResponse();
  await handler.handle({ method: "GET", headers: {} }, first, "/styles.css?v=1");
  await handler.handle({ method: "GET", headers: {} }, second, "/styles.css?v=1");
  assert.equal(first.body.toString(), content);
  assert.equal(second.body.toString(), first.body.toString());
  assert.equal(second.headers.ETag, first.headers.ETag);
});
