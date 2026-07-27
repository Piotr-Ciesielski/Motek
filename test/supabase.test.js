const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  createSupabaseAuthClient,
  createSupabaseConnection,
  readSupabaseAuthConfig,
  readSupabaseConfig,
  verifySupabaseDataApi,
} = require("../supabase");

test("konfiguracja Supabase Auth używa wyłącznie klucza publishable", () => {
  const config = readSupabaseAuthConfig({
    SUPABASE_URL: "https://projekt.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  });

  assert.equal(config.url, "https://projekt.supabase.co");
  assert.equal(config.publishableKey, "sb_publishable_test");
  assert.throws(
    () => readSupabaseAuthConfig({ SUPABASE_URL: "https://projekt.supabase.co" }),
    /niepełna/
  );
  assert.throws(
    () =>
      readSupabaseAuthConfig({
        SUPABASE_URL: "https://projekt.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_secret_test",
      }),
    /publicznym/
  );
  assert.ok(createSupabaseAuthClient(config));
});

test("parser konfiguracji rozpoznaje brak ustawień przed startem aplikacji", () => {
  assert.equal(readSupabaseConfig({}), null);
});

test("konfiguracja Supabase wymaga obu wartości", () => {
  assert.throws(
    () => readSupabaseConfig({ SUPABASE_URL: "https://projekt.supabase.co" }),
    /niepełna/
  );
});

test("konfiguracja odrzuca klucz przeznaczony dla frontendu", () => {
  assert.throws(
    () =>
      readSupabaseConfig({
        SUPABASE_URL: "https://projekt.supabase.co",
        SUPABASE_SECRET_KEY: "sb_publishable_test",
      }),
    /sb_secret_/
  );
});

test("sprawdzenie połączenia przekazuje sekret tylko w nagłówku apikey", async () => {
  const secretKey = "sb_secret_test";
  let capturedRequest;

  const connection = createSupabaseConnection({
    env: {
      SUPABASE_URL: "https://projekt.supabase.co",
      SUPABASE_SECRET_KEY: secretKey,
    },
    fetchImpl: async (url, options) => {
      capturedRequest = { url, options };
      return {
        ok: true,
        status: 200,
        body: { cancel: async () => {} },
      };
    },
  });

  assert.ok(connection.client);
  await connection.verify();
  assert.equal(capturedRequest.url, "https://projekt.supabase.co/rest/v1/");
  assert.equal(capturedRequest.options.headers.apikey, secretKey);
  assert.equal(capturedRequest.options.headers.Authorization, undefined);
});

test("błąd połączenia nie ujawnia sekretnego klucza", async () => {
  const secretKey = "sb_secret_nie_pokazuj";

  await assert.rejects(
    verifySupabaseDataApi(
      {
        url: "https://projekt.supabase.co",
        secretKey,
      },
      async () => ({ ok: false, status: 401 })
    ),
    (error) => {
      assert.doesNotMatch(error.message, new RegExp(secretKey));
      assert.match(error.message, /HTTP 401/);
      return true;
    }
  );
});
