const test = require("node:test");
const assert = require("node:assert/strict");

const { createPatternRouter } = require("../server/pattern-routes");
const {
  createRequestRateLimiter,
  enforceRequestRateLimit,
  getMatchRateLimitKeys,
} = require("../server");
const {
  parseTechniqueParam,
} = require("../technique-policy");

function createServerLikeParseTechnique() {
  return (url) => {
    try {
      return parseTechniqueParam(url.searchParams.get("technique"));
    } catch {
      const error = new Error("Parametr techniki ma niedozwoloną wartość.");
      error.status = 400;
      throw error;
    }
  };
}

test("limiter dopasowań używa adresu połączenia i zwraca Retry-After", () => {
  let now = 0;
  const limiter = createRequestRateLimiter({
    windowMs: 60_000,
    maxRequests: 1,
    blockMs: 30_000,
    now: () => now,
  });
  const headers = new Map();
  const response = { setHeader(name, value) { headers.set(name, value); } };
  const request = {
    headers: { "x-forwarded-for": "198.51.100.11" },
    socket: { remoteAddress: "::ffff:203.0.113.10" },
  };
  const keys = getMatchRateLimitKeys(request, { user: { id: "user-1" } });

  assert.deepEqual(keys, ["ip:203.0.113.10", "user:user-1"]);
  enforceRequestRateLimit(keys, limiter, response);
  now = 1;
  assert.throws(
    () => enforceRequestRateLimit(keys, limiter, response),
    (error) => error.status === 429,
  );
  assert.equal(headers.get("Retry-After"), "30");
});

test("pattern router returns false for an unsupported route", async () => {
  const router = createPatternRouter({
    sendJson() {
      throw new Error("sendJson nie powinien zostać wywołany");
    },
    requireCurrentTermsSession() {
      throw new Error("sesja nie powinna być wymagana");
    },
    getCatalogPatterns() {
      throw new Error("katalog nie powinien zostać pobrany");
    },
    getSupabaseMatches() {
      throw new Error("dopasowania nie powinny zostać pobrane");
    },
    enforceRequestRateLimit() {
      throw new Error("limit nie powinien być sprawdzany");
    },
    getMatchRateLimitKeys() {
      throw new Error("klucz limitu nie powinien być wyliczany");
    },
    matchRateLimiter: {},
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

test("pattern router przekazuje technikę do katalogu i dopasowań", async () => {
  const calls = [];
  const response = { setHeader() {} };
  const router = createPatternRouter({
    sendJson(_res, status, payload) {
      calls.push(["sendJson", status, payload]);
    },
    parseTechniqueParam: createServerLikeParseTechnique(),
    parsePatternPage(url) {
      const limit = Number(url.searchParams.get("limit"));
      return { limit, offset: 0 };
    },
    getCatalogPatterns(page) {
      calls.push(["getCatalogPatterns", page]);
      return { items: [], total: 0, ...page };
    },
    requireCurrentTermsSession() {
      return { user: { id: "user-1" } };
    },
    getSupabaseMatches(_session, options) {
      calls.push(["getSupabaseMatches", options]);
      return { matches: [], limited: false };
    },
    getMatchRateLimitKeys() {
      return ["ip:127.0.0.1"];
    },
    enforceRequestRateLimit() {},
    matchRateLimiter: {},
  });

  await router.handle(
    { method: "GET" },
    response,
    new URL("http://localhost/api/patterns?limit=50&technique=crochet"),
  );
  await router.handle(
    { method: "GET" },
    response,
    new URL("http://localhost/api/patterns?limit=50"),
  );
  await router.handle(
    { method: "GET" },
    response,
    new URL("http://localhost/api/matches?diagnostics=1&technique=knitting"),
  );

  assert.deepEqual(calls, [
    ["getCatalogPatterns", { limit: 50, offset: 0, technique: "crochet" }],
    ["sendJson", 200, { items: [], total: 0, limit: 50, offset: 0, technique: "crochet" }],
    ["getCatalogPatterns", { limit: 50, offset: 0 }],
    ["sendJson", 200, { items: [], total: 0, limit: 50, offset: 0 }],
    ["getSupabaseMatches", { technique: "knitting" }],
    ["sendJson", 200, []],
  ]);
});

test("pattern router odrzuca pusty i nieznany parametr techniki na obu ścieżkach", async () => {
  const router = createPatternRouter({
    sendJson() {
      throw new Error("sendJson nie powinien zostać wywołany");
    },
    parseTechniqueParam: createServerLikeParseTechnique(),
    getCatalogPatterns() {
      throw new Error("katalog nie powinien zostać pobrany");
    },
    getSupabaseMatches() {
      throw new Error("dopasowania nie powinny zostać pobrane");
    },
    requireCurrentTermsSession() {
      return { user: { id: "user-1" } };
    },
    getMatchRateLimitKeys() {
      return ["ip:127.0.0.1"];
    },
    enforceRequestRateLimit() {},
    matchRateLimiter: {},
  });

  for (const [path, value] of [
    ["/api/patterns?technique=", ""],
    ["/api/patterns?technique=sprz%C4%99t", "sprzęt"],
    ["/api/matches?technique=", ""],
    ["/api/matches?technique=wool", "wool"],
  ]) {
    await assert.rejects(
      () => router.handle({ method: "GET" }, {}, new URL(`http://localhost${path}`)),
      (error) => error.status === 400,
      `ścieżka ${path} powinna zwrócić błąd 400 dla wartości „${value}”`,
    );
  }
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
    requireCurrentTermsSession() {
      return { user: { id: "user-1" } };
    },
    getSupabaseMatches() {
      throw new Error("dopasowania nie powinny zostać pobrane");
    },
    enforceRequestRateLimit() {
      throw new Error("limit nie powinien być sprawdzany");
    },
    getMatchRateLimitKeys() {
      throw new Error("klucz limitu nie powinien być wyliczany");
    },
    matchRateLimiter: {},
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
    requireCurrentTermsSession() {},
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
    requireCurrentTermsSession(req, res) {
      calls.push(["requireCurrentTermsSession", req, res]);
      return { user: { id: "user-1" } };
    },
    getSupabaseMatches(session) {
      calls.push(["getSupabaseMatches", session]);
      return { matches: ["match"], limited: true };
    },
    getMatchRateLimitKeys(req, session) {
      calls.push(["getMatchRateLimitKeys", req, session]);
      return ["ip:127.0.0.1", "user:user-1"];
    },
    enforceRequestRateLimit(keys, limiter, res) {
      calls.push(["enforceRequestRateLimit", keys, limiter, res]);
    },
    matchRateLimiter: { name: "match-limiter" },
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

  assert.equal(calls[0][0], "requireCurrentTermsSession");
  assert.equal(calls[0][1], request);
  assert.equal(calls[0][2], response);
  assert.deepEqual(calls.slice(1), [
    ["getMatchRateLimitKeys", request, { user: { id: "user-1" } }],
    ["enforceRequestRateLimit", ["ip:127.0.0.1", "user:user-1"], { name: "match-limiter" }, response],
    ["getSupabaseMatches", { user: { id: "user-1" } }],
    ["setHeader", "X-Motek-Match-Scope", "subset"],
    ["sendJson", 200, ["match"]],
  ]);
  assert.equal(handled, true);
});
