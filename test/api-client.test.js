const test = require("node:test");
const assert = require("node:assert/strict");

const { createApiClient, ApiError, RequestError, isResponseEnvelope } = require("../client/api-client");

function response(body, options = {}) {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(options.headers),
    clone() {
      return response(body, options);
    },
    async json() {
      if (options.invalidJson) throw new SyntaxError("invalid json");
      return body;
    },
  };
}

test("przerywa żądanie po przekroczeniu limitu czasu", async () => {
  const client = createApiClient({
    timeoutMs: 10,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }),
  });

  await assert.rejects(client.request("/api/config"), (error) => {
    assert.ok(error instanceof RequestError);
    assert.equal(error.kind, "timeout");
    return true;
  });
});

test("ponawia tylko nieudane odczyty GET", async () => {
  let calls = 0;
  const client = createApiClient({
    timeoutMs: 100,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("network");
      return response({ ok: true });
    },
  });

  assert.deepEqual(await client.request("/api/config"), { ok: true });
  assert.equal(calls, 2);
});

test("nie ponawia zapisu po błędzie sieci", async () => {
  let calls = 0;
  const client = createApiClient({
    timeoutMs: 100,
    fetchImpl: async () => {
      calls += 1;
      throw new TypeError("network");
    },
  });

  await assert.rejects(client.request("/api/yarns", { method: "POST" }), RequestError);
  assert.equal(calls, 1);
});

test("wywołuje onUnauthorized i zgłasza błąd 401", async () => {
  let unauthorized = 0;
  const client = createApiClient({
    fetchImpl: async () => response({ error: "expired" }, { status: 401 }),
    onUnauthorized: () => { unauthorized += 1; },
  });

  await assert.rejects(client.request("/api/yarns"), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    return true;
  });
  assert.equal(unauthorized, 1);
});

test("zapis z nieczytelną odpowiedzią sygnalizuje niepewny wynik", async () => {
  const client = createApiClient({
    fetchImpl: async () => response(null, { status: 200, invalidJson: true }),
  });

  await assert.rejects(client.request("/api/yarns", { method: "POST" }), (error) => {
    assert.ok(error instanceof RequestError);
    assert.equal(error.kind, "response");
    assert.match(error.message, /potwierdzeniem zapisu/);
    return true;
  });
});

test("wyniki równoległych żądań zachowują własne metadane odpowiedzi", async () => {
  const client = createApiClient({
    fetchImpl: async (url) => {
      const marker = url.endsWith("/a") ? "a" : "b";
      return {
        ok: true,
        status: 200,
        headers: new Headers({ etag: `"${marker}"`, "X-Motek-Match-Scope": marker }),
        async json() {
          await new Promise((resolve) => setTimeout(resolve, marker === "a" ? 20 : 0));
          return { marker };
        },
      };
    },
  });

  const [first, second] = await Promise.all([
    client.request("/a"),
    client.request("/b"),
  ]);
  assert.equal(first.response.headers.get("etag"), '"a"');
  assert.equal(first.response.headers.get("X-Motek-Match-Scope"), "a");
  assert.equal(second.response.headers.get("etag"), '"b"');
  assert.equal(second.response.headers.get("X-Motek-Match-Scope"), "b");
  assert.deepEqual(Object.keys(first), ["marker"]);
});

test("204 zachowuje ETag odpowiedzi usuwania", async () => {
  const client = createApiClient({
    fetchImpl: async () => ({
      ok: true,
      status: 204,
      headers: new Headers({ etag: '"yarn-v8"', "X-Motek-Match-Scope": "full" }),
    }),
  });

  const result = await client.request("/api/yarns/7", { method: "DELETE" });
  assert.equal(isResponseEnvelope(result), true);
  assert.equal(result.data, null);
  assert.equal(result.response.headers.get("etag"), '"yarn-v8"');
});
