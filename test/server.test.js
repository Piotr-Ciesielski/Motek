const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.HOST = "127.0.0.1";
process.env.PORT = "0";

const {
  getRuntimeConfig,
  main,
  normalizeCatalogPattern,
  scorePattern,
  selectMatchingYarns,
  shutdown,
  validatePatternCatalogSize,
  validateMatchLimits,
  validateYarn,
  validateYarnStorageCapacity,
} = require("../server");
test("konfiguracja uruchomieniowa bez zmiennych używa lokalnego portu 3001", () => {
  assert.deepEqual(getRuntimeConfig?.({}), {
    host: "127.0.0.1",
    port: 3001,
  });
});

test("konfiguracja uruchomieniowa respektuje jawne HOST i PORT", () => {
  assert.deepEqual(getRuntimeConfig?.({ HOST: "0.0.0.0", PORT: "4321" }), {
    host: "0.0.0.0",
    port: 4321,
  });
});

test("katalog zachowuje wariant mierzony wyłącznie w gramach", () => {
  const pattern = normalizeCatalogPattern({
    id: 1,
    name: "Kolorowe skarpety",
    description: "Test",
    project_type: "socks",
    materials: ["dowolny materiał"],
    matching_requirements: {
      version: 2,
      variants: [{
        id: "kolory",
        label: "S/M/L",
        requirements: [{
          role: "MC",
          measurement_basis: "grams",
          grams_min: 35,
          materials: [],
          material_match: "any_material",
          color_mode: "same",
          weight_classes: ["fingering"],
        }],
      }],
    },
  });

  assert.equal(pattern.matchingRequirements.length, 1);
  assert.equal(pattern.matchingRequirements[0].requirements[0].gramsMin, 35);
  assert.equal(pattern.matchingRequirements[0].requirements[0].metersMin, null);
});

test("walidacja włóczki zachowuje kilka materiałów", () => {
  const yarn = validateYarn({
    name: "Sock",
    color: "zielony",
    materials: ["poliamid", "wełna", "poliamid"],
    weightClass: "fingering",
    length: 400,
    weight: 100,
  });

  assert.deepEqual(yarn.materials, ["wełna", "poliamid"]);
  assert.throws(
    () => validateYarn({
      name: "Pusty",
      color: "biały",
      materials: [],
      weightClass: "dk",
      length: 100,
      weight: 50,
    }),
    /co najmniej jeden materiał/i,
  );
  assert.throws(
    () => validateYarn({
      name: "Nieznany",
      color: "biały",
      materials: ["dowolny materiał"],
      weightClass: "dk",
      length: 100,
      weight: 50,
    }),
    /niedozwolony materiał/i,
  );
});

test("ranking respektuje limity rozmiaru i może użyć kilku motków dla jednej roli", () => {
  assert.doesNotThrow(() => validateYarnStorageCapacity(499));
  assert.throws(() => validateYarnStorageCapacity(500), /500 włóczek/);
  assert.doesNotThrow(() => validatePatternCatalogSize(300));
  assert.throws(() => validatePatternCatalogSize(301), /300 rekordów/);

  assert.throws(
    () => validateMatchLimits(
      Array.from({ length: 251 }, () => ({ matchingRequirements: [{}] }))
    ),
    /zbyt wiele wariantów/
  );

  const selected = selectMatchingYarns(
    {
      yarnsNeeded: 1,
      metersNeeded: 500,
      gramsNeeded: 100,
      materials: ["wełna"],
      weightClasses: ["dk"],
    },
    Array.from({ length: 75 }, (_, id) => ({
      id,
      materials: ["wełna"],
      weightClass: "dk",
      length: 100,
      weight: 20,
    }))
  );
  assert.equal(selected.yarns.length, 75);
  assert.equal(selected.limited, false);

  const result = scorePattern(
    {
      requirements: [
        {
          yarnsNeeded: 1,
          metersNeeded: 500,
          gramsNeeded: 100,
          materials: ["wełna"],
          weightClasses: ["dk"],
        },
      ],
    },
    [
      { id: 1, materials: ["wełna"], weightClass: "dk", length: 300, weight: 60 },
      { id: 2, materials: ["wełna"], weightClass: "dk", length: 250, weight: 50 },
    ]
  );

  assert.equal(result.doable, true);
  assert.equal(result.matchedYarns, 2);

  const impossible = scorePattern(
    {
      requirements: [
        {
          yarnsNeeded: 1,
          metersNeeded: 2_500,
          gramsNeeded: 500,
          materials: ["wełna"],
          weightClasses: ["dk"],
        },
      ],
    },
    Array.from({ length: 20 }, (_, id) => ({
      id,
      materials: ["wełna"],
      weightClass: "dk",
      length: 50,
      weight: 10,
    }))
  );
  assert.equal(impossible.doable, false);
});

test("endpoint release pozostaje niedostępny bez gotowego Supabase", async () => {
  const runtime = await main({
    supabaseConnection: {
      async verify() { throw new Error("database unavailable"); },
    },
    supabaseAuthConfig: {
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test",
    },
    captchaConfig: { enabled: false, provider: null, siteKey: null },
    readinessIntervalMs: 0,
  });
  const baseUrl = `http://${runtime.host}:${runtime.port}`;

  try {
    const response = await fetch(`${baseUrl}/health/release`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "not_ready" });
  } finally {
    await shutdown("release-not-ready-test");
  }
});

test("serwer Motek działa bezpiecznie", async (t) => {
  const supabasePatterns = [
    {
      id: 21,
      name: "Testowy wzór Supabase",
      description: "Opis wzoru pobranego ze zdalnej bazy.",
      project_type: "cardigan",
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
        version: 2,
        variants: [
          {
            id: "m",
            label: "M",
            size: "M",
            yarn_option: "Testowa włóczka",
            requirements: [{
              role: "główna",
              measurement_basis: "meters",
              meters_min: 200,
              grams_min: 80,
              materials: ["wełna"],
              material_match: "all",
              color_mode: "same",
              weight_classes: ["dk"],
            }],
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
    Object.values(syntheticUsers).map((user) => [user.id, {
      id: user.id,
      login: user.id === syntheticUsers["token-user-a"].id ? "uzytkownik_a" : "uzytkownik_b",
      email: user.email,
      status: "active",
    }])
  );
  const syntheticYarns = [];
  const syntheticYarnVersions = Object.fromEntries(
    Object.values(syntheticUsers).map((user) => [user.id, 0])
  );
  const pendingVersionedRpcs = [];
  let versionedRpcBatchScheduled = false;
  let nextSyntheticYarnId = 1;
  const recoveryRequests = [];
  const signUpRequests = [];
  const deletedUserIds = [];

    function createSyntheticQuery(table, token) {
      const filters = [];
      let operation = "select";
      let insertedRow = null;
      let updateValues = null;
      const query = {
        select() {
          if (operation === "delete") {
            const matches = syntheticYarns.filter((row) => filters.every(([field, value]) => row[field] === value));
            matches.forEach((row) => syntheticYarns.splice(syntheticYarns.indexOf(row), 1));
            return Promise.resolve({ data: matches.map((row) => ({ id: row.id })), error: null });
          }
          if (operation === "update") {
            const matches = syntheticYarns.filter((row) => filters.every(([field, value]) => row[field] === value));
            insertedRow = matches[0] || null;
            return query;
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
        update(values) {
          operation = "update";
          updateValues = values;
          return query;
        },
        single() {
          return new Promise((resolve) => {
            setImmediate(() => {
              if (operation === "update" && insertedRow) {
                Object.assign(insertedRow, updateValues);
              }
              resolve(
                insertedRow
                  ? { data: insertedRow, error: null }
                  : { data: null, error: { code: "PGRST116", message: "No rows found" } }
              );
            });
          });
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
        async signUp({ email, options }) {
          signUpRequests.push({ email, options });
          return {
            data: {
              user: {
                id: "33333333-3333-4333-8333-333333333333",
                email,
                user_metadata: {
                  login: options.data.login,
                },
              },
              session: null,
            },
            error: null,
          };
        },
        async signInWithPassword({ email, password }) {
          if (
            email === syntheticUsers["token-user-a"].email &&
            password === "DeleteHaslo1!"
          ) {
            return { data: { user: syntheticUsers["token-user-a"] }, error: null };
          }
          return { data: null, error: new Error("invalid credentials") };
        },
        async resetPasswordForEmail(email, options) {
          recoveryRequests.push({ email, options });
          return { data: {}, error: null };
        },
        async setSession({ access_token, refresh_token }) {
          assert.equal(access_token, token);
          assert.equal(refresh_token, "refresh-user-a");
          return { data: { session: { access_token, refresh_token } }, error: null };
        },
        async updateUser({ password }) {
          assert.equal(password, "NoweHaslo123!");
          return { data: { user: syntheticUsers[token] }, error: null };
        },
      },
      from(table) {
        return createSyntheticQuery(table, token);
      },
      rpc(name, args) {
        const userId = syntheticUsers[token]?.id;
        if (name === "get_yarn_store_version") {
          return Promise.resolve({ data: syntheticYarnVersions[userId] ?? 0, error: null });
        }
        assert.ok(["insert_yarn_versioned", "update_yarn_versioned", "delete_yarn_versioned"].includes(name));
        return new Promise((resolve) => {
          pendingVersionedRpcs.push({ name, args, userId, observedVersion: syntheticYarnVersions[userId], resolve });
          if (versionedRpcBatchScheduled) return;
          versionedRpcBatchScheduled = true;
          setImmediate(() => {
            versionedRpcBatchScheduled = false;
            const batch = pendingVersionedRpcs.splice(0);
            for (const request of batch) {
              const { name: rpcName, args: rpcArgs, userId: rpcUserId } = request;
              if (request.observedVersion !== rpcArgs.p_expected_version || syntheticYarnVersions[rpcUserId] !== request.observedVersion) {
                request.resolve({ data: null, error: { code: "40001", message: "yarn version conflict" } });
                continue;
              }
              if (rpcName === "update_yarn_versioned") {
                const row = syntheticYarns.find((candidate) => candidate.id === rpcArgs.p_id && candidate.user_id === rpcUserId);
                if (!row) {
                  request.resolve({ data: null, error: { code: "P0002", message: "yarn not found" } });
                  continue;
                }
                Object.assign(row, {
                  name: rpcArgs.p_name,
                  color: rpcArgs.p_color,
                  materials: rpcArgs.p_materials,
                  weight_class: rpcArgs.p_weight_class,
                  length_meters: rpcArgs.p_length_meters,
                  weight_grams: rpcArgs.p_weight_grams,
                });
                syntheticYarnVersions[rpcUserId] += 1;
                request.resolve({ data: { yarn: row, version: syntheticYarnVersions[rpcUserId] }, error: null });
                continue;
              }
              if (rpcName === "delete_yarn_versioned") {
                const index = syntheticYarns.findIndex((candidate) => candidate.id === rpcArgs.p_id && candidate.user_id === rpcUserId);
                if (index < 0) {
                  request.resolve({ data: null, error: { code: "P0002", message: "yarn not found" } });
                  continue;
                }
                const [row] = syntheticYarns.splice(index, 1);
                syntheticYarnVersions[rpcUserId] += 1;
                request.resolve({ data: { yarn: row, version: syntheticYarnVersions[rpcUserId] }, error: null });
                continue;
              }
              const userYarns = syntheticYarns.filter((row) => row.user_id === rpcUserId);
              if (userYarns.length >= 500) {
                request.resolve({ data: null, error: { code: "P0001", message: "Magazyn osiągnął limit 500 włóczek na użytkownika." } });
                continue;
              }
              const inserted = {
                id: nextSyntheticYarnId++,
                user_id: rpcUserId,
                name: rpcArgs.p_name,
                color: rpcArgs.p_color,
                materials: rpcArgs.p_materials,
                weight_class: rpcArgs.p_weight_class,
                length_meters: rpcArgs.p_length_meters,
                weight_grams: rpcArgs.p_weight_grams,
              };
              syntheticYarns.push(inserted);
              syntheticYarnVersions[rpcUserId] += 1;
              request.resolve({ data: { yarn: inserted, version: syntheticYarnVersions[rpcUserId] }, error: null });
            }
          });
        });
      },
    };
  }
  const fakeSupabaseConnection = {
    verify: async () => {},
    client: {
      auth: {
        admin: {
          async deleteUser(userId) {
            deletedUserIds.push(userId);
            return { data: { user: { id: userId } }, error: null };
          },
        },
      },
      from(table) {
        assert.equal(table, "patterns");
        return {
          select(columns, options) {
            if (options?.head) {
              assert.equal(columns, "id");
              return Promise.resolve({ count: supabasePatterns.length, error: null });
            }
            assert.match(columns, /meters_per_100g/);
            return {
              range(from, to) {
                return {
                  async order(field, options) {
                    assert.equal(field, "name");
                    assert.deepEqual(options, { ascending: true });
                    return { data: supabasePatterns.slice(from, to + 1), error: null };
                  },
                };
              },
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
    captchaConfig: { enabled: true, provider: "turnstile", siteKey: "public-test-key" },
    metricsEnabled: true,
  });
  const baseUrl = `http://${runtime.host}:${runtime.port}`;

  try {
    await t.test("zgłasza stan zdrowia bez ujawniania szczegółów", async () => {
      const response = await fetch(`${baseUrl}/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "ok" });
      assert.equal(response.headers.get("cache-control"), "no-store");

      const liveResponse = await fetch(`${baseUrl}/health/live`);
      assert.equal(liveResponse.status, 200);
      const readyResponse = await fetch(`${baseUrl}/health/ready`);
      assert.equal(readyResponse.status, 200);
      const releaseResponse = await fetch(`${baseUrl}/health/release`);
      assert.equal(releaseResponse.status, 200);
      assert.deepEqual(await releaseResponse.json(), {
        status: "ready",
        version: "2.0.0-alpha.39",
        commit: "local",
        environment: "local",
      });
      const configResponse = await fetch(`${baseUrl}/api/config`);
      assert.deepEqual(await configResponse.json(), {
        captcha: { enabled: true, provider: "turnstile", siteKey: "public-test-key" },
      });
      const metricsResponse = await fetch(`${baseUrl}/internal/metrics`);
      assert.equal(metricsResponse.status, 200);
      assert.match(await metricsResponse.text(), /motek_readiness 1/);
    });

    await t.test("zwraca zabezpieczoną stronę", async () => {
      const response = await fetch(`${baseUrl}/`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
      assert.match(response.headers.get("content-security-policy"), /challenges\.cloudflare\.com/);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      const pageHtml = await response.text();
      assert.match(pageHtml, /class="inventory-layout"/);
      assert.match(pageHtml, /id="inventoryThemeImage"/);
      assert.match(pageHtml, /class="matches-hero"/);
      assert.match(pageHtml, /id="matchesThemeImage"/);

      const clientPolicyResponse = await fetch(`${baseUrl}/client-policy.js`);
      assert.equal(clientPolicyResponse.status, 200);
      assert.match(
        clientPolicyResponse.headers.get("content-type"),
        /^(?:application|text)\/javascript/
      );
      assert.match(await clientPolicyResponse.text(), /MotekClientPolicy/);

      const materialPolicyResponse = await fetch(`${baseUrl}/material-policy.js`);
      assert.equal(materialPolicyResponse.status, 200);
      assert.match(
        materialPolicyResponse.headers.get("content-type"),
        /^(?:application|text)\/javascript/,
      );
      assert.match(await materialPolicyResponse.text(), /MotekMaterialPolicy/);

      const themePolicyResponse = await fetch(`${baseUrl}/theme-policy.js`);
      assert.equal(themePolicyResponse.status, 200);
      assert.match(
        themePolicyResponse.headers.get("content-type"),
        /^(?:application|text)\/javascript/,
      );
      assert.match(await themePolicyResponse.text(), /MotekThemePolicy/);

      for (const assetName of ["color-yarn-cat.v1.webp", "night-yarn-cat.v1.webp"]) {
        const assetResponse = await fetch(`${baseUrl}/assets/${assetName}`);
        assert.equal(assetResponse.status, 200);
        assert.match(assetResponse.headers.get("content-type"), /^image\/webp/);
        assert.equal(
          assetResponse.headers.get("cache-control"),
          "public, max-age=31536000, immutable",
        );
        assert.ok((await assetResponse.arrayBuffer()).byteLength < 300_000);
      }
    });

    await t.test("wymaga zalogowania do zdalnego magazynu", async () => {
      const response = await fetch(`${baseUrl}/api/yarns`);
      assert.equal(response.status, 401);
    });

    await t.test("obsługuje rejestrację i nie ujawnia szczegółów błędu logowania", async () => {
      const missingCaptchaResponse = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ login: "nowy@example.com", password: "Haslo123!" }),
      });
      assert.equal(missingCaptchaResponse.status, 400);

      const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({
          login: " NOWY@EXAMPLE.COM ",
          password: "Haslo123!",
          captchaToken: "register-token",
        }),
      });
      assert.equal(registerResponse.status, 201);
      assert.deepEqual(await registerResponse.json(), {
        user: {
          id: "33333333-3333-4333-8333-333333333333",
          email: "nowy@example.com",
          emailConfirmed: false,
          metadata: { login: "nowy@example.com" },
        },
        requiresEmailConfirmation: true,
      });
      assert.deepEqual(signUpRequests.at(-1), {
        email: "nowy@example.com",
        options: { data: { login: "nowy@example.com" }, captchaToken: "register-token" },
      });

      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ email: "nowy@example.com", password: "Haslo123!", captchaToken: "login-token" }),
      });
      assert.equal(loginResponse.status, 401);
      assert.deepEqual(await loginResponse.json(), {
        error: "Nieprawidłowy e-mail lub hasło.",
      });
    });

    await t.test("obsługuje żądanie i zmianę hasła bez ujawniania istnienia konta", async () => {
      const resetResponse = await fetch(`${baseUrl}/api/auth/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ email: " A@EXAMPLE.COM " }),
      });
      assert.equal(resetResponse.status, 202);
      assert.match(
        (await resetResponse.json()).message,
        /Jeśli konto z tym adresem istnieje/
      );
      assert.deepEqual(recoveryRequests[0], {
        email: "a@example.com",
        options: { redirectTo: `${baseUrl}/?recovery=1` },
      });

      const recoveryResponse = await fetch(`${baseUrl}/api/auth/recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({
          access_token: "token-user-a",
          refresh_token: "refresh-user-a",
        }),
      });
      assert.equal(recoveryResponse.status, 200);
      const recoveryCookies = recoveryResponse.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";", 1)[0])
        .join("; ");

      const updateResponse = await fetch(`${baseUrl}/api/auth/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: recoveryCookies,
        },
        body: JSON.stringify({ password: "NoweHaslo123!" }),
      });
      assert.equal(updateResponse.status, 200);
      assert.deepEqual(await updateResponse.json(), {
        passwordUpdated: true,
        authenticated: false,
      });
    });

    await t.test("usuwa bieżące konto po ponownym haśle i frazie", async () => {
      const response = await fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: "motek_access_token=token-user-a",
        },
        body: JSON.stringify({
          password: "DeleteHaslo1!",
          confirmation: "USUŃ KONTO",
        }),
      });

      assert.equal(response.status, 204);
      assert.equal(await response.text(), "");
      assert.deepEqual(deletedUserIds, [syntheticUsers["token-user-a"].id]);
      assert.match(response.headers.get("set-cookie"), /motek_access_token=/);
      assert.match(response.headers.get("set-cookie"), /motek_refresh_token=/);
    });

    await t.test("odrzuca usunięcie konta bez sesji i przy błędnym potwierdzeniu", async () => {
      const noSession = await fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ password: "DeleteHaslo1!", confirmation: "USUŃ KONTO" }),
      });
      assert.equal(noSession.status, 401);

      const wrongPhrase = await fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: "motek_access_token=token-user-a",
        },
        body: JSON.stringify({ password: "DeleteHaslo1!", confirmation: "USUN KONTO" }),
      });
      assert.equal(wrongPhrase.status, 400);
      assert.match((await wrongPhrase.json()).error, /USUŃ KONTO/);
      assert.deepEqual(deletedUserIds, [syntheticUsers["token-user-a"].id]);
    });

    await t.test("blokuje szóstą błędną próbę potwierdzenia hasła przy usuwaniu konta", async () => {
      const request = () => fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: "motek_access_token=token-user-b",
        },
        body: JSON.stringify({
          password: "BledneHaslo1!",
          confirmation: "USUŃ KONTO",
        }),
      });

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await request();
        assert.equal(response.status, 400);
        assert.equal(response.headers.get("retry-after"), null);
      }

      const blockedResponse = await request();
      assert.equal(blockedResponse.status, 429);
      assert.equal(blockedResponse.headers.get("retry-after"), "900");
    });

    await t.test("izoluje syntetyczne dane włóczek między użytkownikami", async () => {
      const userACookies = "motek_access_token=token-user-a";
      const userBCookies = "motek_access_token=token-user-b";
      const originHeaders = { Origin: baseUrl };
      let userAVersion = (await fetch(`${baseUrl}/api/yarns`, {
        headers: { Cookie: userACookies },
      })).headers.get("etag");
      assert.match(userAVersion, /^"yarn-v\d+"$/);
      const createResponse = await fetch(`${baseUrl}/api/yarns`, {
        method: "POST",
        headers: { ...originHeaders, "Content-Type": "application/json", Cookie: userACookies, "If-Match": userAVersion },
        body: JSON.stringify({
          name: "Test automatyczny",
          color: "zielony",
          materials: ["wełna", "poliamid"],
          weightClass: "dk",
          length: 250,
          weight: 100,
        }),
      });
      assert.equal(createResponse.status, 201);
      userAVersion = createResponse.headers.get("etag");
      const created = await createResponse.json();
      assert.equal(created.name, "Test automatyczny");
      assert.deepEqual(created.materials, ["wełna", "poliamid"]);

      const updateResponse = await fetch(`${baseUrl}/api/yarns/${created.id}`, {
        method: "PATCH",
        headers: { ...originHeaders, "Content-Type": "application/json", Cookie: userACookies, "If-Match": userAVersion },
        body: JSON.stringify({
          name: "Test automatyczny — zmieniony",
          color: "niebieski",
          materials: ["wełna"],
          weightClass: "dk",
          length: 300,
          weight: 120,
        }),
      });
      assert.equal(updateResponse.status, 200);
      const staleVersion = userAVersion;
      userAVersion = updateResponse.headers.get("etag");
      assert.equal((await updateResponse.json()).name, "Test automatyczny — zmieniony");

      const conflictResponse = await fetch(`${baseUrl}/api/yarns/${created.id}`, {
        method: "PATCH",
        headers: { ...originHeaders, "Content-Type": "application/json", Cookie: userACookies, "If-Match": staleVersion },
        body: JSON.stringify({
          name: "Konflikt z drugiej karty",
          color: "niebieski",
          materials: ["wełna"],
          weightClass: "dk",
          length: 300,
          weight: 120,
        }),
      });
      assert.equal(conflictResponse.status, 409);

      const parallelIfMatch = userAVersion;
      const parallelPatch = () => fetch(`${baseUrl}/api/yarns/${created.id}`, {
        method: "PATCH",
        headers: {
          ...originHeaders,
          "Content-Type": "application/json",
          Cookie: userACookies,
          "If-Match": parallelIfMatch,
        },
        body: JSON.stringify({
          name: "Równoległy zapis",
          color: "fioletowy",
          materials: ["wełna"],
          weightClass: "dk",
          length: 310,
          weight: 125,
        }),
      });
      const [firstParallelPatch, secondParallelPatch] = await Promise.all([
        parallelPatch(),
        parallelPatch(),
      ]);
      assert.deepEqual(
        [firstParallelPatch.status, secondParallelPatch.status].sort((a, b) => a - b),
        [200, 409],
      );
      userAVersion = firstParallelPatch.status === 200
        ? firstParallelPatch.headers.get("etag")
        : secondParallelPatch.headers.get("etag");

      const userAList = await fetch(`${baseUrl}/api/yarns`, { headers: { Cookie: userACookies } });
      assert.deepEqual((await userAList.json()).map((yarn) => yarn.name), ["Równoległy zapis"]);

      const userAMatches = await fetch(`${baseUrl}/api/matches`, { headers: { Cookie: userACookies } });
      const matches = await userAMatches.json();
      assert.equal(userAMatches.status, 200);
      assert.equal(matches.length, 1);
      assert.equal(matches[0].pattern.name, "Testowy wzór Supabase — M");
      assert.equal(matches[0].pattern.baseName, "Testowy wzór Supabase");
      assert.equal(matches[0].pattern.variantLabel, "M");
      assert.equal(matches[0].pattern.patternId, 21);
      assert.equal(matches[0].total, 100);

      const userBList = await fetch(`${baseUrl}/api/yarns`, { headers: { Cookie: userBCookies } });
      assert.deepEqual(await userBList.json(), []);

      const userBMatches = await fetch(`${baseUrl}/api/matches`, { headers: { Cookie: userBCookies } });
      assert.deepEqual(await userBMatches.json(), []);

      const forbiddenDelete = await fetch(`${baseUrl}/api/yarns/${created.id}`, {
        method: "DELETE",
        headers: { ...originHeaders, Cookie: userBCookies, "If-Match": userBList.headers.get("etag") },
      });
      assert.equal(forbiddenDelete.status, 404);

      const forbiddenUpdate = await fetch(`${baseUrl}/api/yarns/${created.id}`, {
        method: "PATCH",
        headers: { ...originHeaders, "Content-Type": "application/json", Cookie: userBCookies, "If-Match": userBList.headers.get("etag") },
        body: JSON.stringify({
          name: "Nieautoryzowana zmiana",
          color: "czerwony",
          materials: ["wełna"],
          weightClass: "dk",
          length: 300,
          weight: 120,
        }),
      });
      assert.equal(forbiddenUpdate.status, 404);

      const deleteResponse = await fetch(`${baseUrl}/api/yarns/${created.id}`, {
        method: "DELETE",
        headers: { ...originHeaders, Cookie: userACookies, "If-Match": userAVersion },
      });
      assert.equal(deleteResponse.status, 204);
      userAVersion = deleteResponse.headers.get("etag");

      for (let id = 0; id < 500; id += 1) {
        syntheticYarns.push({
          id: nextSyntheticYarnId++,
          user_id: syntheticUsers["token-user-a"].id,
          name: `Limit ${id}`,
          color: "zielony",
          materials: ["wełna"],
          weight_class: "dk",
          length_meters: 100,
          weight_grams: 20,
        });
      }
      userAVersion = (await fetch(`${baseUrl}/api/yarns`, {
        headers: { Cookie: userACookies },
      })).headers.get("etag");
      const limitResponse = await fetch(`${baseUrl}/api/yarns`, {
        method: "POST",
        headers: { ...originHeaders, "Content-Type": "application/json", Cookie: userACookies, "If-Match": userAVersion },
        body: JSON.stringify({
          name: "Po limicie",
          color: "zielony",
          materials: ["wełna"],
          weightClass: "dk",
          length: 100,
          weight: 20,
        }),
      });
      assert.equal(limitResponse.status, 409);
      assert.match((await limitResponse.json()).error, /500 włóczek/);
      syntheticYarns.length = 0;

      syntheticProfiles[syntheticUsers["token-user-a"].id].status = "suspended";
      const suspendedResponse = await fetch(`${baseUrl}/api/yarns`, {
        headers: { Cookie: userACookies },
      });
      assert.equal(suspendedResponse.status, 403);
      assert.deepEqual(await suspendedResponse.json(), {
        error: "Konto jest zawieszone lub zablokowane.",
      });

      delete syntheticProfiles[syntheticUsers["token-user-a"].id];
      const missingProfileResponse = await fetch(`${baseUrl}/api/yarns`, {
        headers: { Cookie: userACookies },
      });
      assert.equal(missingProfileResponse.status, 401);
    });

    await t.test("pobiera katalog wzorów z Supabase bez ujawniania sekretów", async () => {
      const oversizedPageResponse = await fetch(`${baseUrl}/api/patterns?limit=51`);
      assert.equal(oversizedPageResponse.status, 400);
      const negativeOffsetResponse = await fetch(`${baseUrl}/api/patterns?offset=-1`);
      assert.equal(negativeOffsetResponse.status, 400);

      const response = await fetch(`${baseUrl}/api/patterns`);
      assert.equal(response.status, 200);
      const page = await response.json();
      assert.deepEqual(page, {
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
        items: [{
        id: 21,
        name: "Testowy wzór Supabase",
        description: "Opis wzoru pobranego ze zdalnej bazy.",
        projectType: "cardigan",
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
            size: "M",
            yarnOption: "Testowa włóczka",
            requirements: [{
              role: "główna",
              measurementBasis: "meters",
              metersMin: 200,
              metersMax: null,
              gramsMin: 80,
              gramsMax: null,
              skeinsMin: null,
              skeinsMax: null,
              materials: ["wełna"],
              materialMatch: "all",
              colorMode: "same",
              weightClasses: ["dk"],
              strandCount: null,
              distinctColorGroup: null,
            }],
          },
        ],
        sourceLanguage: "pl",
        needsReview: false,
        }],
      });
      assert.equal(JSON.stringify(page).includes("sb_secret_"), false);
    });

    await t.test("odrzuca nieprawidłowe i zbyt duże dane", async () => {
      const missingOriginResponse = await fetch(`${baseUrl}/api/yarns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(missingOriginResponse.status, 403);

      const foreignOriginResponse = await fetch(`${baseUrl}/api/yarns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
        body: JSON.stringify({}),
      });
      assert.equal(foreignOriginResponse.status, 403);

      const invalidResponse = await fetch(`${baseUrl}/api/yarns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({
          name: "Błędny test",
          color: "zielony",
          materials: ["nieznany"],
          weightClass: "dk",
          length: -1,
          weight: 100,
        }),
      });
      assert.equal(invalidResponse.status, 400);

      const oversizedResponse = await fetch(`${baseUrl}/api/yarns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ name: "x".repeat(17_000) }),
      });
      assert.equal(oversizedResponse.status, 413);
    });
  } finally {
    await shutdown("test");
  }

  await assert.rejects(fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(1_000) }));
});
