const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.HOST = "127.0.0.1";
process.env.PORT = "0";
process.env.IDLE_SESSION_SECRET = "test-idle-session-secret";

const {
  getRuntimeConfig,
  main,
  normalizeCatalogPattern,
  getCatalogPatterns,
  scorePattern,
  selectMatchingYarns,
  shutdown,
  validatePatternCatalogSize,
  validateMatchLimits,
  validateYarn,
  validateYarnStorageCapacity,
  getIdleTimeoutSeconds,
  buildIdleActivityCookie,
  parseIdleActivityCookie,
  parseRecoveryGrantCookie,
} = require("../server");

test("limit bezczynności ma domyślnie 2 godziny i respektuje konfigurację", () => {
  assert.equal(getIdleTimeoutSeconds({}), 7200);
  assert.equal(getIdleTimeoutSeconds({ AUTH_IDLE_TIMEOUT_SECONDS: "900" }), 900);
  assert.throws(
    () => getIdleTimeoutSeconds({ AUTH_IDLE_TIMEOUT_SECONDS: "0" }),
    /dodatnią liczbą całkowitą/i,
  );
});

test("podpisane ciasteczko aktywności odrzuca zmieniony timestamp", () => {
  const env = { NODE_ENV: "test", IDLE_SESSION_SECRET: "test-idle-secret" };
  const cookie = buildIdleActivityCookie(1_700_000_000, env);
  assert.equal(parseIdleActivityCookie(cookie.split(";")[0].split("=")[1], env, 1_700_000_100), 1_700_000_000);
  const tampered = cookie.replace("1700000000", "1700000001");
  assert.equal(parseIdleActivityCookie(tampered.split(";")[0].split("=")[1], env, 1_700_000_100), null);
});

test("grant odzyskiwania jest związany z użytkownikiem i wygasa", () => {
  const server = require("../server");
  const cookie = server.buildRecoveryGrantCookie?.("user-1", {
    jti: "grant-jti-test",
    timestamp: 1_700_000_000,
  });
  const value = cookie.split(";")[0].split("=").slice(1).join("=");
  assert.equal(parseRecoveryGrantCookie(value, "user-1", 1_700_000_100), true);
  assert.equal(parseRecoveryGrantCookie(value, "user-2", 1_700_000_100), false);
  assert.equal(parseRecoveryGrantCookie(value, "user-1", 1_700_000_601), false);
});
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

test("publiczny DTO katalogu nie ujawnia źródeł ani audytu i odrzuca nieszyfrowany link", () => {
  const pattern = normalizeCatalogPattern({
    id: 7,
    name: "Jawny wzór",
    description: null,
    official_source_url: "http://example.com/source",
    source_filename: "private.pdf",
    source_sha256: "secret-hash",
    content_audit_version: "1.0",
    content_audited_at: "2026-08-09T00:00:00Z",
    matching_requirements: { version: 2, variants: [] },
  });

  assert.equal(pattern.description, null);
  assert.equal(pattern.officialSourceUrl, null);
  assert.equal("source_filename" in pattern, false);
  assert.equal("source_sha256" in pattern, false);
  assert.equal("content_audit_version" in pattern, false);

  const httpsPattern = normalizeCatalogPattern({
    id: 8,
    name: "Źródło HTTPS",
    description: null,
    official_source_url: "https://example.com/pattern?ref=motek",
    matching_requirements: { version: 2, variants: [] },
  });
  assert.equal(httpsPattern.officialSourceUrl, "https://example.com/pattern?ref=motek");
});

test("getCatalogPatterns mapuje HTTPS official_source_url i filtruje published", async () => {
  const calls = [];
  const result = (value) => {
    const promise = Promise.resolve(value);
    promise.eq = (field, expected) => {
      calls.push(["eq", field, expected]);
      return promise;
    };
    promise.range = (from, to) => {
      calls.push(["range", from, to]);
      return promise;
    };
    promise.order = (field, options) => {
      calls.push(["order", field, options]);
      return promise;
    };
    return promise;
  };
  const connection = {
    client: {
      from(table) {
        assert.equal(table, "patterns");
        return {
          select(fields, options) {
            calls.push(["select", fields, options]);
            return result(fields === "id"
              ? { count: 1, error: null }
              : {
                data: [{
                  id: 1,
                  name: "Jawny wzór",
                  description: null,
                  official_source_url: "https://example.com/pattern?ref=motek",
                  matching_requirements: { version: 2, variants: [] },
                }],
                error: null,
              });
          },
        };
      },
    },
  };

  const page = await getCatalogPatterns({ limit: 10, offset: 0 }, connection);
  assert.equal(page.items[0].officialSourceUrl, "https://example.com/pattern?ref=motek");
  assert.equal(calls.filter(([name]) => name === "eq").length, 2);
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
    "token-user-stale": { id: "44444444-4444-4444-8444-444444444444", email: "stale@example.com" },
  };
  const syntheticProfiles = Object.fromEntries(
    Object.values(syntheticUsers).map((user) => [user.id, {
      id: user.id,
      login: user.id === syntheticUsers["token-user-a"].id ? "uzytkownik_a" : "uzytkownik_b",
      email: user.email,
      status: "active",
    }])
  );
  const syntheticLegalStates = {
    [syntheticUsers["token-user-a"].id]: {
      currentTermsVersion: "1.0",
      currentPrivacyVersion: "1.0",
      acceptedVersion: "1.0",
      acceptanceRequired: false,
    },
    [syntheticUsers["token-user-b"].id]: {
      currentTermsVersion: "1.0",
      currentPrivacyVersion: "1.0",
      acceptedVersion: "1.0",
      acceptanceRequired: false,
    },
    [syntheticUsers["token-user-stale"].id]: {
      currentTermsVersion: "1.0",
      currentPrivacyVersion: "1.0",
      acceptedVersion: null,
      acceptanceRequired: true,
    },
  };
  const syntheticYarns = [];
  const syntheticYarnVersions = Object.fromEntries(
    Object.values(syntheticUsers).map((user) => [user.id, 0])
  );
  const pendingVersionedRpcs = [];
  let versionedRpcBatchScheduled = false;
  let nextSyntheticYarnId = 1;
  const recoveryRequests = [];
  const exchangedRecoveryCodes = [];
  const recoveryGrantRpcs = [];
  const recoveryGrantState = {
    claimed: false,
    claimResult: true,
    claimError: null,
    releaseResult: true,
    consumeResult: true,
    updateUserCalls: 0,
    updateUserError: null,
    signOutError: null,
    verifyPasswordCalls: 0,
    verifyPasswordError: null,
    signInWithPasswordArgs: [],
  };
  const recoveryGrantEvents = [];
  const passwordChangeEvents = [];
  const authClientFactoryTokens = [];
  const signOutScopes = [];
  const signUpRequests = [];
  const deletedUserIds = [];
  const serviceProfileReads = [];

    function createSyntheticQuery(table, _token) {
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
    authClientFactoryTokens.push(token);
    return {
      auth: {
        async getUser(accessToken) {
          const user = syntheticUsers[accessToken];
          return user ? { data: { user }, error: null } : { data: null, error: new Error("invalid token") };
        },
        async signOut(options) {
          signOutScopes.push(options);
          passwordChangeEvents.push({ name: "signOut", args: options });
          if (recoveryGrantState.signOutError) throw recoveryGrantState.signOutError;
        },
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
          recoveryGrantState.verifyPasswordCalls += 1;
          recoveryGrantState.signInWithPasswordArgs.push({ email, password });
          passwordChangeEvents.push({ name: "signInWithPassword", args: { email, password } });
          if (recoveryGrantState.verifyPasswordError) {
            return { data: null, error: recoveryGrantState.verifyPasswordError };
          }
          if (
            (email === syntheticUsers["token-user-a"].email && password === "DeleteHaslo1!") ||
            (email === syntheticUsers["token-user-a"].email && password === "  DeleteHaslo1!  ") ||
            (email === syntheticUsers["token-user-stale"].email && password === "DeleteStale1!")
          ) {
            const user = email === syntheticUsers["token-user-stale"].email
              ? syntheticUsers["token-user-stale"]
              : syntheticUsers["token-user-a"];
            return { data: { user }, error: null };
          }
          return { data: null, error: new Error("invalid credentials") };
        },
        async resetPasswordForEmail(email, options) {
          recoveryRequests.push({ email, options });
          return { data: {}, error: null };
        },
        async exchangeCodeForSession(code) {
          exchangedRecoveryCodes.push(code);
          return {
            data: {
              user: syntheticUsers["token-user-a"],
              session: { access_token: "token-user-a", refresh_token: "refresh-user-a" },
            },
            error: null,
          };
        },
        async setSession({ access_token, refresh_token }) {
          assert.equal(access_token, token);
          assert.equal(refresh_token, "refresh-user-a");
          return { data: { session: { access_token, refresh_token } }, error: null };
        },
        async updateUser({ password }) {
          assert.equal(password, "NoweHaslo123!");
          recoveryGrantState.updateUserCalls += 1;
          recoveryGrantEvents.push({ name: "updateUser" });
          passwordChangeEvents.push({ name: "updateUser", args: { password } });
          return { data: { user: syntheticUsers[token] }, error: recoveryGrantState.updateUserError };
        },
      },
      from(table) {
        return createSyntheticQuery(table, token);
      },
      rpc(name, args) {
        const userId = syntheticUsers[token]?.id;
        if (name === "create_auth_recovery_grant") {
          recoveryGrantRpcs.push({ name, args, userId });
          return Promise.resolve({ data: "grant-jti-user-a", error: null });
        }
        if (name === "consume_auth_recovery_grant") {
          recoveryGrantRpcs.push({ name, args, userId });
          recoveryGrantEvents.push({ name, args });
          return Promise.resolve({ data: recoveryGrantState.consumeResult, error: null });
        }
        if (name === "claim_auth_recovery_grant") {
          recoveryGrantRpcs.push({ name, args, userId });
          recoveryGrantEvents.push({ name, args });
          if (recoveryGrantState.claimError) {
            return Promise.resolve({ data: null, error: recoveryGrantState.claimError });
          }
          const claimed = recoveryGrantState.claimResult === true && !recoveryGrantState.claimed;
          if (claimed) recoveryGrantState.claimed = true;
          return Promise.resolve({ data: claimed, error: null });
        }
        if (name === "release_auth_recovery_grant") {
          recoveryGrantRpcs.push({ name, args, userId });
          recoveryGrantEvents.push({ name, args });
          recoveryGrantState.claimed = false;
          return Promise.resolve({ data: recoveryGrantState.releaseResult, error: null });
        }
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
        if (table === "profiles") {
          serviceProfileReads.push(true);
          return createSyntheticQuery(table, "service-role");
        }
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
      async rpc(name, args) {
        if (name === "get_account_access_state") {
          return { data: syntheticLegalStates[args.p_user_id], error: null };
        }
        if (name === "reserve_registration_invitation") {
          return { data: "invitation-1", error: null };
        }
        if (name === "attach_registration_user") {
          return { data: true, error: null };
        }
        if (name === "finalize_invited_registration") {
          return { data: "2026-08-09T12:00:00.000Z", error: null };
        }
        if (name === "release_registration_reservation") {
          return { data: true, error: null };
        }
        if (name === "record_terms_acceptance") {
          const state = syntheticLegalStates[args.p_user_id];
          state.acceptedVersion = args.p_terms_version;
          state.acceptanceRequired = false;
          return { data: "2026-08-09T12:00:00.000Z", error: null };
        }
        throw new Error(`Unexpected service RPC ${name}`);
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
  const idleActivityCookie = buildIdleActivityCookie(Math.floor(Date.now() / 1000))
    .split(";", 1)[0];
  const syntheticAuthCookies = (token) => `motek_access_token=${token}; ${idleActivityCookie}`;

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
        version: "2.0.0-alpha.38",
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
      assert.match(
        response.headers.get("content-security-policy"),
        /connect-src[^;]*https:\/\/challenges\.cloudflare\.com/
      );
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
      assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
      assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
      assert.equal(response.headers.get("strict-transport-security"), null);
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
          invitationToken: "a".repeat(64),
          termsAccepted: true,
          termsVersion: "1.0",
          privacyNoticeVersion: "1.0",
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
        options: {
          data: { login: "nowy@example.com" },
          captchaToken: "register-token",
          emailRedirectTo: `${baseUrl}/?confirmed=1`,
        },
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

    await t.test("obsługuje żądanie i zmianę hasła bez ujawniania istnienia konta", async (passwordT) => {
      const resetResponse = await fetch(`${baseUrl}/api/auth/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ email: " A@EXAMPLE.COM ", captchaToken: "reset-token" }),
      });
      assert.equal(resetResponse.status, 202);
      assert.match(
        (await resetResponse.json()).message,
        /Jeśli konto z tym adresem istnieje/
      );
      assert.deepEqual(recoveryRequests[0], {
        email: "a@example.com",
        options: { redirectTo: `${baseUrl}/?recovery=1`, captchaToken: "reset-token" },
      });

      const recoveryResponse = await fetch(`${baseUrl}/api/auth/recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ code: "recovery-code" }),
      });
      assert.equal(recoveryResponse.status, 200);
      assert.deepEqual(exchangedRecoveryCodes, ["recovery-code"]);
      assert.deepEqual(recoveryGrantRpcs, [
        {
          name: "create_auth_recovery_grant",
          args: {},
          userId: syntheticUsers["token-user-a"].id,
        },
      ]);
      const recoveryCookies = recoveryResponse.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";", 1)[0])
        .join("; ");

      const activityResponse = await fetch(`${baseUrl}/api/auth/activity`, {
        method: "POST",
        headers: { Origin: baseUrl, Cookie: recoveryCookies },
        body: "{}",
      });
      assert.equal(activityResponse.status, 200);
      assert.deepEqual(await activityResponse.json(), { authenticated: true });
      assert.match(activityResponse.headers.get("set-cookie"), /motek_idle_activity=/);

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
      assert.deepEqual(recoveryGrantRpcs.at(-1), {
        name: "consume_auth_recovery_grant",
        args: { grant_jti: "grant-jti-user-a" },
        userId: syntheticUsers["token-user-a"].id,
      });
      assert.deepEqual(recoveryGrantEvents.slice(-3).map(({ name }) => name), [
        "claim_auth_recovery_grant",
        "updateUser",
        "consume_auth_recovery_grant",
      ]);
      assert.equal(recoveryGrantState.updateUserCalls, 1);
      assert.deepEqual(signOutScopes.at(-1), { scope: "global" });
      assert.deepEqual(await updateResponse.json(), {
        passwordUpdated: true,
        authenticated: false,
      });

      const passwordRequest = () => fetch(`${baseUrl}/api/auth/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: recoveryCookies,
        },
        body: JSON.stringify({ password: "NoweHaslo123!" }),
      });

      await passwordT.test("odrzuca zajęty grant bez zmiany hasła", async () => {
        recoveryGrantState.claimed = true;
        recoveryGrantEvents.length = 0;
        try {
          const updateUserCallsBefore = recoveryGrantState.updateUserCalls;
          const response = await passwordRequest();

          assert.equal(response.status, 400);
          assert.deepEqual(await response.json(), {
            error: "Ten link został już wykorzystany albo wygasł. Rozpocznij odzyskiwanie hasła ponownie.",
          });
          assert.equal(recoveryGrantState.updateUserCalls, updateUserCallsBefore);
          assert.equal(recoveryGrantEvents.some(({ name }) => name === "consume_auth_recovery_grant"), false);
        } finally {
          recoveryGrantState.claimed = false;
          recoveryGrantEvents.length = 0;
        }
      });

      await passwordT.test("zwraca 503 przy błędzie RPC claim bez zmiany hasła", async () => {
        recoveryGrantState.claimed = false;
        recoveryGrantState.claimError = new Error("claim failed");
        recoveryGrantEvents.length = 0;
        try {
          const updateUserCallsBefore = recoveryGrantState.updateUserCalls;
          const response = await passwordRequest();

          assert.equal(response.status, 503);
          assert.deepEqual(await response.json(), {
            error: "Nie udało się bezpiecznie zweryfikować linku odzyskiwania. Spróbuj ponownie.",
          });
          assert.equal(recoveryGrantState.updateUserCalls, updateUserCallsBefore);
        } finally {
          recoveryGrantState.claimError = null;
          recoveryGrantState.claimed = false;
          recoveryGrantEvents.length = 0;
        }
      });

      await passwordT.test("atomowo przyznaje grant tylko jednemu równoległemu żądaniu zmiany hasła", async () => {
        recoveryGrantState.claimed = false;
        recoveryGrantEvents.length = 0;
        const updateUserCallsBefore = recoveryGrantState.updateUserCalls;
        try {
          const responses = await Promise.all([passwordRequest(), passwordRequest()]);
          const eventNames = recoveryGrantEvents.map(({ name }) => name);

          assert.equal(recoveryGrantState.updateUserCalls - updateUserCallsBefore, 1);
          assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
          assert.equal(eventNames.filter((name) => name === "consume_auth_recovery_grant").length, 1);
        } finally {
          recoveryGrantState.claimed = false;
          recoveryGrantEvents.length = 0;
        }
      });

      await passwordT.test("zwalnia grant po błędzie zmiany hasła", async () => {
        recoveryGrantState.claimed = false;
        recoveryGrantState.updateUserError = new Error("update failed");
        recoveryGrantEvents.length = 0;
        try {
          const response = await passwordRequest();

          assert.equal(response.status, 400);
          assert.deepEqual(recoveryGrantEvents.map(({ name }) => name), [
            "claim_auth_recovery_grant",
            "updateUser",
            "release_auth_recovery_grant",
          ]);
          assert.equal(recoveryGrantState.claimed, false);
        } finally {
          recoveryGrantState.updateUserError = null;
          recoveryGrantState.claimed = false;
          recoveryGrantEvents.length = 0;
        }
      });

      await passwordT.test("zwraca 503 i zatrzymuje grant po błędzie consume", async () => {
        recoveryGrantState.claimed = false;
        recoveryGrantState.consumeResult = false;
        recoveryGrantEvents.length = 0;
        signOutScopes.length = 0;
        try {
          const response = await passwordRequest();
          const eventNames = recoveryGrantEvents.map(({ name }) => name);

          assert.equal(response.status, 503);
          assert.deepEqual(await response.json(), {
            error: "Hasło zostało zmienione. Nie udało się bezpiecznie zakończyć procesu. Zaloguj się nowym hasłem. Jeśli logowanie nie zadziała, rozpocznij odzyskiwanie ponownie.",
          });
          assert.equal(eventNames.filter((name) => name === "consume_auth_recovery_grant").length, 1);
          assert.equal(eventNames.includes("release_auth_recovery_grant"), false);
          assert.equal(recoveryGrantState.claimed, true);
          assert.deepEqual(signOutScopes, [{ scope: "global" }]);
          for (const cookieName of [
            "motek_access_token",
            "motek_refresh_token",
            "motek_idle_activity",
            "motek_recovery_grant",
          ]) {
            const cookie = response.headers
              .getSetCookie()
              .find((value) => value.startsWith(`${cookieName}=`) && /Max-Age=0/.test(value));
            assert.ok(cookie, `Brak cookie ${cookieName}`);
          }
        } finally {
          recoveryGrantState.consumeResult = true;
          recoveryGrantState.claimed = false;
          recoveryGrantEvents.length = 0;
          signOutScopes.length = 0;
        }
      });

      await passwordT.test("czyści cookies po wyjątku globalnego wylogowania", async () => {
        recoveryGrantState.claimed = false;
        recoveryGrantState.signOutError = new Error("sign out failed");
        recoveryGrantEvents.length = 0;
        try {
          const response = await passwordRequest();

          assert.equal(response.status, 500);
          assert.deepEqual(await response.json(), {
            error: "Wewnętrzny błąd serwera.",
          });
          assert.deepEqual(recoveryGrantEvents.map(({ name }) => name), [
            "claim_auth_recovery_grant",
            "updateUser",
            "consume_auth_recovery_grant",
          ]);
          for (const cookieName of [
            "motek_access_token",
            "motek_refresh_token",
            "motek_idle_activity",
            "motek_recovery_grant",
          ]) {
            const cookie = response.headers
              .getSetCookie()
              .find((value) => value.startsWith(`${cookieName}=`) && /Max-Age=0/.test(value));
            assert.ok(cookie, `Brak cookie ${cookieName}`);
          }
        } finally {
          recoveryGrantState.signOutError = null;
          recoveryGrantState.claimed = false;
          recoveryGrantEvents.length = 0;
        }
      });

      await passwordT.test("nie odnawia sesji po usunięciu cookie bezczynności", async () => {
        const tokenCookies = recoveryCookies
          .split("; ")
          .filter((cookie) => !cookie.startsWith("motek_idle_activity="))
          .join("; ");
        const response = await fetch(`${baseUrl}/api/auth/activity`, {
          method: "POST",
          headers: { Origin: baseUrl, Cookie: tokenCookies },
          body: "{}",
        });
        assert.equal(response.status, 401);
        assert.match(response.headers.get("set-cookie"), /motek_idle_activity=;/);
      });

      await passwordT.test("nie pozwala zmienić hasła ze zwykłej sesji", async () => {
        const normalSessionCookies = [
          "motek_access_token=token-user-a",
          "motek_refresh_token=refresh-token-user-a",
          recoveryCookies.split("; ").find((cookie) => cookie.startsWith("motek_idle_activity=")),
        ].filter(Boolean).join("; ");
        const response = await fetch(`${baseUrl}/api/auth/password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: baseUrl,
            Cookie: normalSessionCookies,
          },
          body: JSON.stringify({ password: "NoweHaslo123!" }),
        });
        assert.equal(response.status, 400);
      });

    });

    await t.test("zwykła zmiana hasła wymaga ponownego uwierzytelnienia i bezpiecznie kończy sesję", async (passwordT) => {
      const sessionCookies = syntheticAuthCookies("token-user-a");
      const changePasswordRequest = (overrides = {}) => fetch(`${baseUrl}/api/auth/password/change`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          ...(overrides.cookie ? { Cookie: overrides.cookie } : {}),
        },
        body: JSON.stringify({
          currentPassword: "DeleteHaslo1!",
          password: "NoweHaslo123!",
          ...overrides.body,
        }),
      });
      const resetPasswordChangeState = () => {
        recoveryGrantState.verifyPasswordCalls = 0;
        recoveryGrantState.verifyPasswordError = null;
        recoveryGrantState.signInWithPasswordArgs.length = 0;
        recoveryGrantState.updateUserCalls = 0;
        recoveryGrantState.updateUserError = null;
        recoveryGrantState.signOutError = null;
        authClientFactoryTokens.length = 0;
        passwordChangeEvents.length = 0;
        signOutScopes.length = 0;
      };
      const secretPattern = /DeleteHaslo1!|NoweHaslo123!|token-user-a|refresh-token/;
      const requestWithCapturedOutput = async (configure = () => {}) => {
        resetPasswordChangeState();
        configure();
        const capturedLogs = [];
        const consoleMethods = ["error", "warn", "log"];
        const originalConsoleMethods = Object.fromEntries(
          consoleMethods.map((method) => [method, console[method]])
        );
        for (const method of consoleMethods) {
          console[method] = (...args) => capturedLogs.push(`${method}: ${args.join(" ")}`);
        }
        try {
          const response = await changePasswordRequest({ cookie: sessionCookies });
          const body = await response.text();
          return {
            response,
            body,
            capturedText: `${body}\n${capturedLogs.join("\n")}`,
          };
        } finally {
          for (const method of consoleMethods) {
            console[method] = originalConsoleMethods[method];
          }
        }
      };
      const assertJsonErrorBody = (response, body, expectedStatus) => {
        assert.equal(response.status, expectedStatus);
        assert.match(response.headers.get("content-type") ?? "", /^application\/json(?:;|$)/);
        const parsedBody = JSON.parse(body);
        assert.equal(typeof parsedBody.error, "string");
        assert.ok(parsedBody.error.length > 0);
        return parsedBody;
      };
      const assertJsonErrorResponse = async (response, expectedStatus) => {
        assert.equal(response.status, expectedStatus);
        assert.match(response.headers.get("content-type") ?? "", /^application\/json(?:;|$)/);
        const parsedBody = await response.json();
        assert.equal(typeof parsedBody.error, "string");
        assert.ok(parsedBody.error.length > 0);
        return parsedBody;
      };

      await passwordT.test("zwraca potwierdzenie po poprawnej zmianie hasła", async () => {
        const { response, body, capturedText } = await requestWithCapturedOutput();

        assert.equal(response.status, 200);
        assert.deepEqual(JSON.parse(body), { passwordUpdated: true, authenticated: false });
        assert.deepEqual(passwordChangeEvents.map(({ name }) => name), ["signInWithPassword", "updateUser", "signOut"]);
        assert.deepEqual(recoveryGrantState.signInWithPasswordArgs, [{
          email: syntheticUsers["token-user-a"].email,
          password: "DeleteHaslo1!",
        }]);
        assert.deepEqual(authClientFactoryTokens, [undefined, undefined, "token-user-a"]);
        assert.deepEqual(signOutScopes, [{ scope: "global" }]);
        assert.doesNotMatch(capturedText, secretPattern);
      });

      await passwordT.test("weryfikuje bieżące hasło z zachowaniem znaczących spacji", async () => {
        resetPasswordChangeState();
        const response = await changePasswordRequest({
          cookie: sessionCookies,
          body: { currentPassword: "  DeleteHaslo1!  " },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(recoveryGrantState.signInWithPasswordArgs, [{
          email: syntheticUsers["token-user-a"].email,
          password: "  DeleteHaslo1!  ",
        }]);
        assert.deepEqual(authClientFactoryTokens, [undefined, undefined, "token-user-a"]);
      });

      await passwordT.test("odrzuca brak sesji przed weryfikacją hasła", async () => {
        resetPasswordChangeState();
        const response = await changePasswordRequest();

        await assertJsonErrorResponse(response, 401);
        assert.equal(recoveryGrantState.verifyPasswordCalls, 0);
      });

      await passwordT.test("odrzuca brak bieżącego hasła bez wywołania Auth", async () => {
        resetPasswordChangeState();
        const response = await changePasswordRequest({ cookie: sessionCookies, body: { currentPassword: undefined } });

        await assertJsonErrorResponse(response, 400);
        assert.equal(recoveryGrantState.verifyPasswordCalls, 0);
      });

      await passwordT.test("odrzuca puste bieżące hasło bez wywołania Auth", async () => {
        resetPasswordChangeState();
        const response = await changePasswordRequest({ cookie: sessionCookies, body: { currentPassword: "" } });

        await assertJsonErrorResponse(response, 400);
        assert.equal(recoveryGrantState.verifyPasswordCalls, 0);
      });

      await passwordT.test("nie zmienia hasła po błędnej weryfikacji starego hasła", async () => {
        resetPasswordChangeState();
        recoveryGrantState.verifyPasswordError = new Error("invalid credentials");
        const response = await changePasswordRequest({ cookie: sessionCookies });

        const errorBody = await assertJsonErrorResponse(response, 401);
        assert.equal(errorBody.error, "Nie udało się zmienić hasła. Spróbuj ponownie.");
        assert.equal(recoveryGrantState.updateUserCalls, 0);
        assert.deepEqual(passwordChangeEvents.map(({ name }) => name), ["signInWithPassword"]);
      });

      await passwordT.test("odrzuca niepoprawne nowe hasło przed wywołaniem Auth", async () => {
        resetPasswordChangeState();
        const response = await changePasswordRequest({ cookie: sessionCookies, body: { password: "niepoprawne" } });

        await assertJsonErrorResponse(response, 400);
        assert.equal(recoveryGrantState.verifyPasswordCalls, 0);
        assert.equal(recoveryGrantState.updateUserCalls, 0);
      });

      await passwordT.test("odrzuca brak nowego hasła bez wywołania Auth", async () => {
        resetPasswordChangeState();
        const response = await changePasswordRequest({ cookie: sessionCookies, body: { password: undefined } });

        await assertJsonErrorResponse(response, 400);
        assert.equal(recoveryGrantState.verifyPasswordCalls, 0);
        assert.equal(recoveryGrantState.updateUserCalls, 0);
      });

      await passwordT.test("nie wylogowuje globalnie po błędzie updateUser", async () => {
        resetPasswordChangeState();
        recoveryGrantState.updateUserError = new Error("update failed");
        const response = await changePasswordRequest({ cookie: sessionCookies });

        await assertJsonErrorResponse(response, 400);
        assert.equal(recoveryGrantState.updateUserCalls, 1);
        assert.deepEqual(signOutScopes, []);
      });

      await passwordT.test("czyści cookies po błędzie globalnego wylogowania", async () => {
        resetPasswordChangeState();
        recoveryGrantState.signOutError = new Error("sign out failed");
        const response = await changePasswordRequest({ cookie: sessionCookies });

        const errorBody = await assertJsonErrorResponse(response, 503);
        assert.doesNotMatch(errorBody.error, secretPattern);
        assert.equal(recoveryGrantState.updateUserCalls, 1);
        assert.deepEqual(passwordChangeEvents.map(({ name }) => name), ["signInWithPassword", "updateUser", "signOut"]);
        for (const cookieName of ["motek_access_token", "motek_refresh_token", "motek_idle_activity"]) {
          const cookie = response.headers.getSetCookie().find((value) => value.startsWith(`${cookieName}=`) && /Max-Age=0/.test(value));
          assert.ok(cookie, `Brak cookie ${cookieName}`);
        }
      });

      await passwordT.test("nie ujawnia sekretów po błędzie weryfikacji hasła", async () => {
        const { response, body, capturedText } = await requestWithCapturedOutput(() => {
          recoveryGrantState.verifyPasswordError = new Error("invalid credentials");
        });

        const errorBody = assertJsonErrorBody(response, body, 401);
        assert.doesNotMatch(errorBody.error, secretPattern);
        assert.doesNotMatch(capturedText, secretPattern);
      });

      await passwordT.test("nie ujawnia sekretów po błędzie updateUser", async () => {
        const { response, body, capturedText } = await requestWithCapturedOutput(() => {
          recoveryGrantState.updateUserError = new Error("update failed");
        });

        const errorBody = assertJsonErrorBody(response, body, 400);
        assert.doesNotMatch(errorBody.error, secretPattern);
        assert.doesNotMatch(capturedText, secretPattern);
      });

      await passwordT.test("nie ujawnia sekretów po błędzie globalnego wylogowania", async () => {
        try {
          const { response, body, capturedText } = await requestWithCapturedOutput(() => {
            recoveryGrantState.signOutError = new Error("sign out failed");
          });

          const errorBody = assertJsonErrorBody(response, body, 503);
          assert.doesNotMatch(errorBody.error, secretPattern);
          assert.doesNotMatch(capturedText, secretPattern);
        } finally {
          resetPasswordChangeState();
        }
      });
    });

    await t.test("pokazuje stan regulaminu i blokuje starej zgodzie dostęp do danych", async () => {
      const currentSessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Cookie: syntheticAuthCookies("token-user-a") },
      });
      assert.equal(currentSessionResponse.status, 200);
      assert.deepEqual((await currentSessionResponse.json()).legal, {
        currentVersion: "1.0",
        acceptedVersion: "1.0",
        acceptanceRequired: false,
      });

      const staleSessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Cookie: syntheticAuthCookies("token-user-stale") },
      });
      assert.equal(staleSessionResponse.status, 200);
      assert.deepEqual((await staleSessionResponse.json()).legal, {
        currentVersion: "1.0",
        acceptedVersion: null,
        acceptanceRequired: true,
      });
      assert.equal(serviceProfileReads.length >= 1, true, "profil stara zgoda jest czytany zaufanym klientem");

      const yarnsResponse = await fetch(`${baseUrl}/api/yarns`, {
        headers: { Cookie: syntheticAuthCookies("token-user-stale") },
      });
      assert.equal(yarnsResponse.status, 403);

      const patternsResponse = await fetch(`${baseUrl}/api/patterns`, {
        headers: { Cookie: syntheticAuthCookies("token-user-stale") },
      });
      assert.equal(patternsResponse.status, 403);

      const staleVersionResponse = await fetch(`${baseUrl}/api/legal/acceptance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: syntheticAuthCookies("token-user-stale"),
        },
        body: JSON.stringify({ version: "0.9" }),
      });
      assert.equal(staleVersionResponse.status, 409);

      const acceptanceResponse = await fetch(`${baseUrl}/api/legal/acceptance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: syntheticAuthCookies("token-user-stale"),
        },
        body: JSON.stringify({ version: "1.0" }),
      });
      assert.equal(acceptanceResponse.status, 200);
      assert.deepEqual(await acceptanceResponse.json(), {
        acceptedVersion: "1.0",
        acceptedAt: "2026-08-09T12:00:00.000Z",
      });

      const staleYarnsAfterAcceptance = await fetch(`${baseUrl}/api/yarns`, {
        headers: { Cookie: syntheticAuthCookies("token-user-stale") },
      });
      assert.equal(staleYarnsAfterAcceptance.status, 200);

      const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: { Origin: baseUrl, Cookie: syntheticAuthCookies("token-user-stale") },
      });
      assert.equal(logoutResponse.status, 200);
    });

    await t.test("usuwa bieżące konto po ponownym haśle i frazie", async () => {
      const response = await fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: syntheticAuthCookies("token-user-a"),
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
          Cookie: syntheticAuthCookies("token-user-a"),
        },
        body: JSON.stringify({ password: "DeleteHaslo1!", confirmation: "USUN KONTO" }),
      });
      assert.equal(wrongPhrase.status, 400);
      assert.match((await wrongPhrase.json()).error, /USUŃ KONTO/);
      assert.deepEqual(deletedUserIds, [syntheticUsers["token-user-a"].id]);
    });

    await t.test("pozwala usunąć konto bez aktualnej zgody", async () => {
      const response = await fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: syntheticAuthCookies("token-user-stale"),
        },
        body: JSON.stringify({
          password: "DeleteStale1!",
          confirmation: "USUŃ KONTO",
        }),
      });

      assert.equal(response.status, 204);
      assert.equal(await response.text(), "");
      assert.equal(deletedUserIds.at(-1), syntheticUsers["token-user-stale"].id);
    });

    await t.test("blokuje szóstą błędną próbę potwierdzenia hasła przy usuwaniu konta", async () => {
      const request = () => fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: syntheticAuthCookies("token-user-b"),
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
      const userACookies = syntheticAuthCookies("token-user-a");
      const userBCookies = syntheticAuthCookies("token-user-b");
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
      syntheticProfiles[syntheticUsers["token-user-a"].id] = {
        id: syntheticUsers["token-user-a"].id,
        login: "uzytkownik_a",
        email: "a@example.com",
        status: "active",
      };
      const patternHeaders = { Cookie: syntheticAuthCookies("token-user-a") };
      const oversizedPageResponse = await fetch(`${baseUrl}/api/patterns?limit=51`, { headers: patternHeaders });
      assert.equal(oversizedPageResponse.status, 400);
      const negativeOffsetResponse = await fetch(`${baseUrl}/api/patterns?offset=-1`, { headers: patternHeaders });
      assert.equal(negativeOffsetResponse.status, 400);

      const response = await fetch(`${baseUrl}/api/patterns`, { headers: patternHeaders });
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
        officialSourceUrl: null,
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
