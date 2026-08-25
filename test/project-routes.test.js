const test = require("node:test");
const assert = require("node:assert/strict");

const { createProjectRouter } = require("../server/project-routes");

function createHarness(overrides = {}) {
  const calls = [];
  const response = {
    setHeader(name, value) {
      calls.push(["setHeader", name, value]);
    },
  };
  const session = { user: { id: "user-1" } };
  const activeProject = {
    id: 5,
    patternId: 21,
    variantId: "m",
    status: "active",
    version: 3,
    yarns: [],
  };
  const dependencies = {
    sendJson(_res, status, payload) {
      calls.push(["sendJson", status, payload]);
    },
    requireAuthenticatedSession(req, res) {
      calls.push(["requireAuthenticatedSession", req, res]);
      return session;
    },
    requireCurrentYarnVersion(req) {
      calls.push(["requireCurrentYarnVersion", req]);
      if (req.headers["if-match"] !== '"yarn-v7"') {
        const error = new Error("precondition");
        error.status = 428;
        throw error;
      }
      return 7;
    },
    validateProjectStartPayload(body) {
      calls.push(["validateProjectStartPayload", body]);
      return { patternId: 21, variantId: "m" };
    },
    requireCurrentProjectVersion(req) {
      calls.push(["requireCurrentProjectVersion", req]);
      const match = /^"project-v(\d+)"$/.exec(req.headers["if-match"] || "");
      if (!match) {
        const error = new Error("precondition");
        error.status = 428;
        throw error;
      }
      return Number(match[1]);
    },
    validateProjectProgressPayload(body) {
      calls.push(["validateProjectProgressPayload", body]);
      return body;
    },
    updateSupabaseActiveProject(currentSession, patch, expectedVersion) {
      calls.push(["updateSupabaseActiveProject", currentSession, patch, expectedVersion]);
      return { ...activeProject, version: expectedVersion + 1 };
    },
    getProjectCollectionVersion(version) {
      return `"project-v${version}"`;
    },
    getSupabaseActiveProject(currentSession) {
      calls.push(["getSupabaseActiveProject", currentSession]);
      return activeProject;
    },
    createSupabaseActiveProject(currentSession, patternId, variantId, expectedYarnVersion) {
      calls.push(["createSupabaseActiveProject", currentSession, patternId, variantId, expectedYarnVersion]);
      return { ...activeProject, version: 1 };
    },
    readBody(req) {
      calls.push(["readBody", req]);
      return req.body;
    },
    enforceRequestRateLimit(keys, limiter, res) {
      calls.push(["enforceRequestRateLimit", keys, limiter, res]);
    },
    yarnWriteRateLimiter: { name: "yarn-limiter" },
    ...overrides,
  };
  return { router: createProjectRouter(dependencies), calls, response, session };
}

test("router projektu zwraca aktywny projekt z ETag i nagłówkiem wersji", async () => {
  const { router, calls, response, session } = createHarness();
  const request = { method: "GET", headers: {} };

  assert.equal(
    await router.handle(request, response, new URL("http://localhost/api/projects/active")),
    true,
  );
  assert.deepEqual(calls, [
    ["requireAuthenticatedSession", request, response],
    ["getSupabaseActiveProject", session],
    ["setHeader", "ETag", '"project-v3"'],
    ["setHeader", "X-Motek-Project-Version", '"project-v3"'],
    ["sendJson", 200, { ...{ id: 5, patternId: 21, variantId: "m", status: "active", version: 3, yarns: [] } }],
  ]);
});

test("router projektu zwraca 204 bez ETag przy braku aktywnego projektu", async () => {
  const { router, calls, response, session } = createHarness({
    getSupabaseActiveProject(currentSession) {
      calls.push(["getSupabaseActiveProject", currentSession]);
      return null;
    },
  });
  const request = { method: "GET", headers: {} };

  assert.equal(
    await router.handle(request, response, new URL("http://localhost/api/projects/active")),
    true,
  );
  assert.deepEqual(calls, [
    ["requireAuthenticatedSession", request, response],
    ["getSupabaseActiveProject", session],
    ["sendJson", 204, null],
  ]);
});

test("router projektu startuje projekt po warunku magazynu i limicie", async () => {
  const { router, calls, response, session } = createHarness();
  const request = {
    method: "POST",
    headers: { "if-match": '"yarn-v7"' },
    body: { patternId: 21, variantId: "m" },
  };

  assert.equal(await router.handle(request, response, new URL("http://localhost/api/projects")), true);
  assert.deepEqual(calls, [
    ["readBody", request],
    ["validateProjectStartPayload", { patternId: 21, variantId: "m" }],
    ["requireAuthenticatedSession", request, response],
    ["enforceRequestRateLimit", ["user:user-1"], { name: "yarn-limiter" }, response],
    ["requireCurrentYarnVersion", request],
    ["createSupabaseActiveProject", session, 21, "m", 7],
    ["setHeader", "ETag", '"project-v1"'],
    ["setHeader", "X-Motek-Project-Version", '"project-v1"'],
    ["sendJson", 201, { id: 5, patternId: 21, variantId: "m", status: "active", version: 1, yarns: [] }],
  ]);
});

test("router projektu zapisuje postęp po warunku wersji projektu", async () => {
  const { router, calls, response, session } = createHarness();
  const patch = { progressUnit: "row", progressCount: 7, note: "Idzie.", toolSizeMm: 3.5, gauge: null };
  const request = { method: "PATCH", headers: { "if-match": '"project-v3"' }, body: patch };

  assert.equal(
    await router.handle(request, response, new URL("http://localhost/api/projects/active")),
    true,
  );
  assert.deepEqual(calls, [
    ["readBody", request],
    ["validateProjectProgressPayload", patch],
    ["requireAuthenticatedSession", request, response],
    ["enforceRequestRateLimit", ["user:user-1"], { name: "yarn-limiter" }, response],
    ["requireCurrentProjectVersion", request],
    ["updateSupabaseActiveProject", session, patch, 3],
    ["setHeader", "ETag", '"project-v4"'],
    ["setHeader", "X-Motek-Project-Version", '"project-v4"'],
    ["sendJson", 200, { id: 5, patternId: 21, variantId: "m", status: "active", version: 4, yarns: [] }],
  ]);
});

test("router projektu wymaga poprawnego nagłówka wersji przy zapisie postępu", async () => {
  const { router, calls, response } = createHarness();
  for (const ifMatch of [undefined, "project-v3", '"yarn-v3"', '"project-vX"']) {
    calls.length = 0;
    const request = { method: "PATCH", headers: { "if-match": ifMatch } };
    await assert.rejects(
      router.handle(request, response, new URL("http://localhost/api/projects/active")),
      (error) => error.status === 428,
    );
    assert.ok(!calls.some(([name]) => name === "updateSupabaseActiveProject"));
  }
});

test("router projektu nie ponawia zapisu konfliktu wersji", async () => {
  let updates = 0;
  const { router, response } = createHarness({
    updateSupabaseActiveProject() {
      updates += 1;
      const error = new Error("conflict");
      error.status = 409;
      throw error;
    },
  });
  const request = { method: "PATCH", headers: { "if-match": '"project-v2"' } };

  await assert.rejects(
    router.handle(request, response, new URL("http://localhost/api/projects/active")),
    (error) => error.status === 409,
  );
  assert.equal(updates, 1);
});

test("router projektu nie dotyka innych ścieżek", async () => {
  const { router, calls, response } = createHarness();
  assert.equal(
    await router.handle({ method: "GET", headers: {} }, response, new URL("http://localhost/api/projects")),
    false,
  );
  assert.equal(
    await router.handle({ method: "PATCH", headers: {} }, response, new URL("http://localhost/api/projects")),
    false,
  );
  assert.equal(
    await router.handle({ method: "DELETE", headers: {} }, response, new URL("http://localhost/api/projects/active")),
    false,
  );
  assert.equal(calls.length, 0);
});
