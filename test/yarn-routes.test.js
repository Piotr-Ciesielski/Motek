const test = require("node:test");
const assert = require("node:assert/strict");

const { createYarnRouter } = require("../server/yarn-routes");

const validYarn = {
  name: "Merino",
  color: "Granat",
  materials: ["wełna"],
  weightClass: "dk",
  length: 200,
  weight: 100,
};

function createHarness(overrides = {}) {
  const calls = [];
  const response = {
    setHeader(name, value) {
      calls.push(["setHeader", name, value]);
    },
  };
  const session = { user: { id: "user-1" } };
  const dependencies = {
    ApiError: class ApiError extends Error {
      constructor(status, message) {
        super(message);
        this.status = status;
      }
    },
    sendJson(_res, status, payload) {
      calls.push(["sendJson", status, payload]);
    },
    getYarnCollectionVersion(version) {
      return `"yarn-v${version}"`;
    },
    getSupabaseYarns(currentSession) {
      calls.push(["getSupabaseYarns", currentSession]);
      return [{ id: 1, ...validYarn }];
    },
    getSupabaseYarnVersion(currentSession) {
      calls.push(["getSupabaseYarnVersion", currentSession]);
      return 7;
    },
    insertSupabaseYarn(currentSession, yarn) {
      calls.push(["insertSupabaseYarn", currentSession, yarn]);
      return { yarn: { id: 2, ...yarn }, version: 8 };
    },
    updateSupabaseYarn(currentSession, id, yarn) {
      calls.push(["updateSupabaseYarn", currentSession, id, yarn]);
      return { yarn: { id, ...yarn }, version: 9 };
    },
    deleteSupabaseYarn(currentSession, id, expectedVersion) {
      calls.push(["deleteSupabaseYarn", currentSession, id, expectedVersion]);
      return { version: 10 };
    },
    sendYarnMutationResponse(_res, status, mutation) {
      calls.push(["sendYarnMutationResponse", status, mutation]);
    },
    requireAuthenticatedSession(req, res) {
      calls.push(["requireAuthenticatedSession", req, res]);
      return session;
    },
    requireCurrentYarnVersion(req) {
      calls.push(["requireCurrentYarnVersion", req]);
      return 7;
    },
    validateYarn(body) {
      calls.push(["validateYarn", body]);
      return { ...body };
    },
    readBody(req) {
      calls.push(["readBody", req]);
      return validYarn;
    },
    enforceRequestRateLimit(keys, limiter, res) {
      calls.push(["enforceRequestRateLimit", keys, limiter, res]);
    },
    yarnWriteRateLimiter: { name: "yarn-limiter" },
    ...overrides,
  };
  return { router: createYarnRouter(dependencies), calls, response, session };
}

test("yarn router returns inventory with collection ETag", async () => {
  const { router, calls, response, session } = createHarness();
  const request = { method: "GET", headers: {} };

  assert.equal(await router.handle(request, response, new URL("http://localhost/api/yarns")), true);
  assert.deepEqual(calls, [
    ["requireAuthenticatedSession", request, response],
    ["getSupabaseYarns", session],
    ["getSupabaseYarnVersion", session],
    ["setHeader", "ETag", '"yarn-v7"'],
    ["sendJson", 200, [{ id: 1, ...validYarn }]],
  ]);
});

test("yarn router preserves authenticated POST version and user rate limit", async () => {
  const { router, calls, response, session } = createHarness();
  const request = { method: "POST", headers: { "if-match": '"yarn-v7"' } };

  assert.equal(await router.handle(request, response, new URL("http://localhost/api/yarns")), true);
  assert.equal(calls.find(([name]) => name === "sendYarnMutationResponse")[1], 201);
  const inserted = calls.find(([name]) => name === "insertSupabaseYarn");
  assert.deepEqual(inserted[1], session);
  assert.equal(inserted[2].expectedVersion, 7);
  assert.deepEqual(calls.find(([name]) => name === "enforceRequestRateLimit")[1], ["user:user-1"]);
});

test("yarn router validates id before PATCH and DELETE dependencies", async () => {
  const { router, calls, response } = createHarness();
  const request = { method: "PATCH", headers: {} };

  await assert.rejects(
    router.handle(request, response, new URL("http://localhost/api/yarns/nope")),
    (error) => error.status === 400,
  );
  assert.equal(calls.length, 0);
});

test("yarn router sends DELETE mutation as 204 with If-Match version", async () => {
  const { router, calls, response, session } = createHarness();
  const request = { method: "DELETE", headers: { "if-match": '"yarn-v7"' } };

  assert.equal(await router.handle(request, response, new URL("http://localhost/api/yarns/12")), true);
  assert.deepEqual(calls, [
    ["requireAuthenticatedSession", request, response],
    ["enforceRequestRateLimit", ["user:user-1"], { name: "yarn-limiter" }, response],
    ["requireCurrentYarnVersion", request],
    ["deleteSupabaseYarn", session, 12, 7],
    ["sendYarnMutationResponse", 204, { version: 10 }],
  ]);
});

test("yarn router leaves other routes untouched", async () => {
  const { router, calls, response } = createHarness();
  assert.equal(await router.handle({ method: "GET" }, response, new URL("http://localhost/api/yarns/1")), false);
  assert.equal(calls.length, 0);
});
