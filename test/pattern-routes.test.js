const test = require("node:test");
const assert = require("node:assert/strict");

const { createPatternRouter } = require("../server/pattern-routes");

test("pattern router returns false for an unsupported route", async () => {
  const router = createPatternRouter({
    sendJson() {
      throw new Error("sendJson nie powinien zostać wywołany");
    },
    requireAuthenticatedSession() {
      throw new Error("sesja nie powinna być wymagana");
    },
    getCatalogPatterns() {
      throw new Error("katalog nie powinien zostać pobrany");
    },
    getSupabaseMatches() {
      throw new Error("dopasowania nie powinny zostać pobrane");
    },
    parsePatternPage() {
      throw new Error("paginacja nie powinna zostać odczytana");
    },
  });

  const handled = await router.handle(
    { method: "GET" },
    {},
    new URL("http://localhost/api/unknown"),
  );

  assert.equal(handled, false);
});

test("pattern router serves the catalog with parsed pagination", async () => {
  const calls = [];
  const router = createPatternRouter({
    sendJson(_res, status, payload) {
      calls.push(["sendJson", status, payload]);
    },
    parsePatternPage(url) {
      calls.push(["parsePatternPage", url.pathname]);
      return { limit: 10, offset: 20 };
    },
    getCatalogPatterns(page) {
      calls.push(["getCatalogPatterns", page]);
      return { items: ["pattern"], total: 21, ...page };
    },
    requireAuthenticatedSession() {
      throw new Error("sesja nie powinna być wymagana");
    },
    getSupabaseMatches() {
      throw new Error("dopasowania nie powinny zostać pobrane");
    },
  });

  const handled = await router.handle(
    { method: "GET" },
    {},
    new URL("http://localhost/api/patterns?limit=10&offset=20"),
  );

  assert.deepEqual(calls, [
    ["parsePatternPage", "/api/patterns"],
    ["getCatalogPatterns", { limit: 10, offset: 20 }],
    ["sendJson", 200, { items: ["pattern"], total: 21, limit: 10, offset: 20 }],
  ]);
  assert.equal(handled, true);
});

test("pattern router passes the public catalog payload unchanged", async () => {
  const payload = { items: [{ name: "Jawny wzór", description: null }], total: 1 };
  let sent;
  const router = createPatternRouter({
    sendJson(_res, status, body) { sent = [status, body]; },
    parsePatternPage() { return { limit: 10, offset: 0 }; },
    getCatalogPatterns() { return payload; },
    requireAuthenticatedSession() {},
    getSupabaseMatches() {},
  });
  await router.handle({ method: "GET" }, {}, new URL("http://localhost/api/patterns"));
  assert.deepEqual(sent, [200, payload]);
});

test("pattern router serves authenticated matches and reports scope", async () => {
  const calls = [];
  const response = {
    setHeader(name, value) {
      calls.push(["setHeader", name, value]);
    },
  };
  const router = createPatternRouter({
    sendJson(_res, status, payload) {
      calls.push(["sendJson", status, payload]);
    },
    requireAuthenticatedSession(req, res) {
      calls.push(["requireAuthenticatedSession", req, res]);
      return { user: { id: "user-1" } };
    },
    getSupabaseMatches(session) {
      calls.push(["getSupabaseMatches", session]);
      return { matches: ["match"], limited: true };
    },
    getCatalogPatterns() {
      throw new Error("katalog nie powinien zostać pobrany");
    },
  });

  const request = { method: "GET" };
  const handled = await router.handle(
    request,
    response,
    new URL("http://localhost/api/matches"),
  );

  assert.equal(calls[0][0], "requireAuthenticatedSession");
  assert.equal(calls[0][1], request);
  assert.equal(calls[0][2], response);
  assert.deepEqual(calls.slice(1), [
    ["getSupabaseMatches", { user: { id: "user-1" } }],
    ["setHeader", "X-Motek-Match-Scope", "subset"],
    ["sendJson", 200, ["match"]],
  ]);
  assert.equal(handled, true);
});
