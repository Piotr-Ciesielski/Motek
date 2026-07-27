const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.HOST = "127.0.0.1";
process.env.PORT = "0";

const { main, shutdown } = require("../server");

test("serwer Motek działa bezpiecznie", async (t) => {
  const supabasePatterns = [
    {
      id: 21,
      name: "Testowy wzór Supabase",
      description: "Opis wzoru pobranego ze zdalnej bazy.",
      materials: ["wełna", "jedwab"],
      meters_per_100g: 400,
      yarn_requirements: [
        {
          role: "główna",
          materials: ["wełna"],
          meters_per_100g: 400,
        },
      ],
      matching_requirements: {
        variants: [
          {
            id: "m",
            label: "M",
            yarns_needed: 1,
            meters_needed: 200,
            grams_needed: 80,
            materials: ["wełna"],
            weight_classes: ["dk"],
            colors: "dowolny",
          },
        ],
      },
      source_language: "pl",
      needs_review: false,
    },
  ];
  const syntheticUsers = {
    "token-user-a": { id: "11111111-1111-4111-8111-111111111111", email: "a@example.com" },
    "token-user-b": { id: "22222222-2222-4222-8222-222222222222", email: "b@example.com" },
  };
  const syntheticProfiles = Object.fromEntries(
    Object.values(syntheticUsers).map((user) => [user.id, { id: user.id, login: user.id === syntheticUsers["token-user-a"].id ? "uzytkownik_a" : "uzytkownik_b", email: user.email }])
  );
  const syntheticYarns = [];
  let nextSyntheticYarnId = 1;

  function createSyntheticQuery(table, token) {
    const filters = [];
    let operation = "select";
    let insertedRow = null;
    const query = {
      select() {
        if (operation === "delete") {
          const matches = syntheticYarns.filter((row) => filters.every(([field, value]) => row[field] === value));
          matches.forEach((row) => syntheticYarns.splice(syntheticYarns.indexOf(row), 1));
          return Promise.resolve({ data: matches.map((row) => ({ id: row.id })), error: null });
        }
        return query;
      },
      eq(field, value) {
        filters.push([field, value]);
        return query;
      },
      order() {
        const rows = table === "yarns"
          ? syntheticYarns.filter((row) => filters.every(([field, value]) => row[field] === value))
          : [];
        return Promise.resolve({ data: rows, error: null });
      },
      maybeSingle() {
        const rows = table === "profiles"
          ? Object.values(syntheticProfiles).filter((row) => filters.every(([field, value]) => row[field] === value))
          : [];
        return Promise.resolve({ data: rows[0] || null, error: null });
      },
      insert(row) {
        operation = "insert";
        insertedRow = { ...row, id: nextSyntheticYarnId++ };
        syntheticYarns.push(insertedRow);
        return query;
      },
      single() {
        return Promise.resolve({ data: insertedRow, error: null });
      },
      delete() {
        operation = "delete";
        return query;
      },
    };
    return query;
  }

  function fakeSupabaseAuthClientFactory(config, token) {
    return {
      auth: {
        async getUser(accessToken) {
          const user = syntheticUsers[accessToken];
          return user ? { data: { user }, error: null } : { data: null, error: new Error("invalid token") };
        },
        async signOut() {},
      },
      from(table) {
        return createSyntheticQuery(table, token);
      },
    };
  }
  const fakeSupabaseConnection = {
    verify: async () => {},
    client: {
      from(table) {
        assert.equal(table, "patterns");
        return {
          select(columns) {
            assert.match(columns, /meters_per_100g/);
            return {
              async order(field, options) {
                assert.equal(field, "name");
                assert.deepEqual(options, { ascending: true });
                return { data: supabasePatterns, error: null };
              },
            };
          },
        };
      },
    },
  };
  const runtime = await main({
    supabaseConnection: fakeSupabaseConnection,
    supabaseAuthConfig: { url: "https://projekt.supabase.co", publishableKey: "sb_publishable_test" },
    supabaseAuthClientFactory: fakeSupabaseAuthClientFactory,
  });
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

    await t.test("wymaga zalogowania do zdalnego magazynu", async () => {
      const response = await fetch(`${baseUrl}/api/yarns`);
      assert.equal(response.status, 401);
    });

    await t.test("izoluje syntetyczne dane włóczek między użytkownikami", async () => {
      const userACookies = "motek_access_token=token-user-a";
      const userBCookies = "motek_access_token=token-user-b";
      const createResponse = await fetch(`${baseUrl}/api/yarns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userACookies },
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

      const userAList = await fetch(`${baseUrl}/api/yarns`, { headers: { Cookie: userACookies } });
      assert.deepEqual((await userAList.json()).map((yarn) => yarn.name), ["Test automatyczny"]);

      const userAMatches = await fetch(`${baseUrl}/api/matches`, { headers: { Cookie: userACookies } });
      const matches = await userAMatches.json();
      assert.equal(userAMatches.status, 200);
      assert.equal(matches.length, 1);
      assert.equal(matches[0].pattern.name, "Testowy wzór Supabase — M");
      assert.equal(matches[0].total, 100);

      const userBList = await fetch(`${baseUrl}/api/yarns`, { headers: { Cookie: userBCookies } });
      assert.deepEqual(await userBList.json(), []);

      const userBMatches = await fetch(`${baseUrl}/api/matches`, { headers: { Cookie: userBCookies } });
      assert.deepEqual(await userBMatches.json(), []);

      const forbiddenDelete = await fetch(`${baseUrl}/api/yarns/${created.id}`, {
        method: "DELETE",
        headers: { Cookie: userBCookies },
      });
      assert.equal(forbiddenDelete.status, 404);

      const deleteResponse = await fetch(`${baseUrl}/api/yarns/${created.id}`, {
        method: "DELETE",
        headers: { Cookie: userACookies },
      });
      assert.equal(deleteResponse.status, 204);
    });

    await t.test("pobiera katalog wzorów z Supabase bez ujawniania sekretów", async () => {
      const response = await fetch(`${baseUrl}/api/patterns`);
      assert.equal(response.status, 200);
      const patterns = await response.json();
      assert.equal(patterns.length, 1);
      assert.deepEqual(patterns[0], {
        id: 21,
        name: "Testowy wzór Supabase",
        description: "Opis wzoru pobranego ze zdalnej bazy.",
        materials: ["wełna", "jedwab"],
        metersPer100g: 400,
        yarnRequirements: [
          {
            role: "główna",
            materials: ["wełna"],
            meters_per_100g: 400,
          },
        ],
        matchingRequirements: [
          {
            id: "m",
            label: "M",
            yarnsNeeded: 1,
            metersNeeded: 200,
            gramsNeeded: 80,
            materials: ["wełna"],
            weightClasses: ["dk"],
            colors: "dowolny",
          },
        ],
        sourceLanguage: "pl",
        needsReview: false,
      });
      assert.equal(JSON.stringify(patterns).includes("sb_secret_"), false);
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
  }

  await assert.rejects(fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(1_000) }));
});
