const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.HOST = "127.0.0.1";
process.env.PORT = "0";
process.env.IDLE_SESSION_SECRET = "test-idle-session-secret";

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
  getIdleTimeoutSeconds,
  buildIdleActivityCookie,
  parseIdleActivityCookie,
  buildRecoveryGrantCookie,
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

test("sesja Auth wymaga obecności prawidłowego ciasteczka aktywności", () => {
  const env = { NODE_ENV: "test", IDLE_SESSION_SECRET: "test-idle-secret" };
  const cookie = buildIdleActivityCookie(1_700_000_000, env);
  const value = cookie.split(";", 1)[0].split("=", 2)[1];

  assert.equal(parseIdleActivityCookie(undefined, env, 1_700_000_100), null);
  assert.equal(parseIdleActivityCookie(value, env, 1_700_000_100), 1_700_000_000);
});

test("grant odzyskiwania używa osobnego sekretu, wiąże użytkownika, wygasa i odrzuca zmieniony podpis", () => {
  const env = {
    IDLE_SESSION_SECRET: "test-idle-secret",
    RECOVERY_GRANT_SECRET: "test-recovery-secret",
  };
  const cookie = buildRecoveryGrantCookie("user-1", {
    jti: "grant-jti-test",
    timestamp: 1_700_000_000,
    env,
  });
  const value = cookie.split(";", 1)[0].split("=", 2)[1];

  assert.equal(value.split(".").length, 4);
  assert.equal(parseRecoveryGrantCookie(value, "user-1", 1_700_000_100, env), true);
  assert.equal(
    parseRecoveryGrantCookie(value, "user-1", 1_700_000_100, { IDLE_SESSION_SECRET: env.IDLE_SESSION_SECRET }),
    false,
  );
  assert.equal(parseRecoveryGrantCookie(value, "user-2", 1_700_000_100, env), false);
  assert.equal(parseRecoveryGrantCookie(value, "user-1", 1_700_000_601, env), false);

  const [rawUserId, jti, timestamp, signature] = value.split(".");
  const signatureAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const lastSignatureIndex = signatureAlphabet.indexOf(signature.at(-1));
  const tamperedSignature = `${signature.slice(0, -1)}${signatureAlphabet[lastSignatureIndex ^ 16]}`;
  assert.equal(
    parseRecoveryGrantCookie(
      `${rawUserId}.${jti}.${timestamp}.${tamperedSignature}`,
      "user-1",
      1_700_000_100,
      env,
    ),
    false,
  );
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

test("walidacja włóczki wymaga co najmniej 1 metra i 1 grama", () => {
  for (const field of ["length", "weight"]) {
    assert.throws(
      () => validateYarn({
        name: "Za mało",
        color: "biały",
        materials: ["wełna"],
        weightClass: "dk",
        length: field === "length" ? 0 : 1,
        weight: field === "weight" ? 0 : 1,
      }),
      new RegExp(`Pole ${field} musi być liczbą całkowitą od 1 do 1000000\\.`),
    );
  }
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
  const syntheticLegalStates = Object.fromEntries(
    Object.values(syntheticUsers).map((user) => [user.id, {
      currentTermsVersion: "1.0",
      currentPrivacyVersion: "1.0",
      acceptedVersion: "1.0",
      acceptanceRequired: false,
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
  const exchangedRecoveryCodes = [];
  const recoveryGrantRpcs = [];
  const recoveryGrantState = {
    claimed: false,
    claimResult: true,
    claimError: null,
    releaseResult: true,
    releaseError: null,
    consumeResult: true,
    updateUserCalls: 0,
    updateUserError: null,
  };
  const recoveryGrantEvents = [];
  const recoveryGrantCalls = [];
  const recoveryGrants = new Map();
  const signOutScopes = [];
  const signUpRequests = [];
  const automaticRegistrationFinalizations = [];
  const issuedSignupConfirmationTokens = [];
  const usedSignupConfirmationTokens = new Set();
  const expiredConfirmationTokens = {
    access_token: "expired-signup-access-token",
    refresh_token: "expired-signup-refresh-token",
  };
  const confirmedSignupUser = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "nowy@example.com",
    email_confirmed_at: "2026-08-06T00:00:00.000Z",
    user_metadata: { login: "nowy@example.com" },
  };
  const deletedUserIds = [];
  const deletionVerificationAttempts = [];
  let profileResultOverride = null;
  let profileQueryFailure = null;
  let authenticatedProfileAccessDenied = false;
  let signOutFailure = null;

  function sessionCookies(accessToken, refreshToken) {
    const idleActivity = buildIdleActivityCookie(Math.floor(Date.now() / 1000))
      .split(";", 1)[0]
      .split("=", 2)[1];
    return [
      `motek_access_token=${accessToken}`,
      refreshToken ? `motek_refresh_token=${refreshToken}` : null,
      `motek_idle_activity=${idleActivity}`,
    ].filter(Boolean).join("; ");
  }

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
        if (table === "profiles" && profileQueryFailure) return Promise.reject(profileQueryFailure);
        if (table === "profiles" && profileResultOverride) return Promise.resolve(profileResultOverride);
        if (table === "profiles" && authenticatedProfileAccessDenied && _token !== "service-role") {
          return Promise.resolve({ data: null, error: null });
        }
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
          if (issuedSignupConfirmationTokens.some(({ access_token }) => access_token === accessToken)) {
            return { data: { user: confirmedSignupUser }, error: null };
          }
          const user = syntheticUsers[accessToken];
          return user ? { data: { user }, error: null } : { data: null, error: new Error("invalid token") };
        },
        async signOut({ scope } = {}) {
          if (signOutFailure instanceof Error) throw signOutFailure;
          signOutScopes.push({ token, scope });
          return signOutFailure || { error: null };
        },
        async signUp({ email, options }) {
          signUpRequests.push({ email, options });
          issuedSignupConfirmationTokens.push({
            access_token: `signup-access-token-${issuedSignupConfirmationTokens.length + 1}`,
            refresh_token: `signup-refresh-token-${issuedSignupConfirmationTokens.length + 1}`,
          });
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
        async signInWithPassword(credentials) {
          const { email, password } = credentials;
          if (
            email === syntheticUsers["token-user-a"].email &&
            password === "DeleteHaslo1!"
          ) {
            deletionVerificationAttempts.push(credentials);
            return {
              data: {
                user: syntheticUsers["token-user-a"],
                session: { access_token: "token-user-a", refresh_token: "refresh-user-a" },
              },
              error: null,
            };
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
          const signupConfirmationTokens = issuedSignupConfirmationTokens.find((tokens) => (
          tokens.access_token === access_token && tokens.refresh_token === refresh_token
          ));
          if (signupConfirmationTokens) {
            if (usedSignupConfirmationTokens.has(access_token)) {
              return { data: { session: null, user: null }, error: new Error("token already used") };
            }
            usedSignupConfirmationTokens.add(access_token);
            return {
              data: {
                session: { access_token, refresh_token },
              },
              error: null,
            };
          }
          if (
            access_token === expiredConfirmationTokens.access_token
            && refresh_token === expiredConfirmationTokens.refresh_token
          ) {
            return { data: { session: null, user: null }, error: new Error("token expired") };
          }
          assert.equal(access_token, token);
          assert.equal(refresh_token, "refresh-user-a");
          return { data: { session: { access_token, refresh_token } }, error: null };
        },
        async updateUser({ password }) {
          assert.equal(password, "NoweHaslo123!");
          recoveryGrantState.updateUserCalls += 1;
          recoveryGrantEvents.push({ name: "updateUser" });
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
          const claimed = recoveryGrantState.claimResult === true && !recoveryGrantState.claimed;
          if (claimed) recoveryGrantState.claimed = true;
          return Promise.resolve({ data: claimed, error: recoveryGrantState.claimError });
        }
        if (name === "release_auth_recovery_grant") {
          recoveryGrantRpcs.push({ name, args, userId });
          recoveryGrantEvents.push({ name, args });
          if (!recoveryGrantState.releaseError && recoveryGrantState.releaseResult === true) {
            recoveryGrantState.claimed = false;
          }
          return Promise.resolve({ data: recoveryGrantState.releaseResult, error: recoveryGrantState.releaseError });
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
                request.resolve({ data: null, error: { code: "P0003", message: "yarn version conflict" } });
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
      rpc(name, args) {
        if (name === "get_account_access_state") {
          return Promise.resolve({ data: syntheticLegalStates[args.p_user_id], error: null });
        }
        if (name === "reserve_registration_invitation") {
          return Promise.resolve({ data: "invitation-1", error: null });
        }
        if (name === "attach_registration_user") {
          return Promise.resolve({ data: true, error: null });
        }
        if (name === "finalize_invited_registration") {
          return Promise.resolve({ data: "2026-08-09T12:00:00.000Z", error: null });
        }
        if (name === "release_registration_reservation") {
          return Promise.resolve({ data: true, error: null });
        }
        if (name === "record_terms_acceptance") {
          const state = syntheticLegalStates[args.p_user_id];
          if (state) {
            state.acceptedVersion = args.p_terms_version;
            state.acceptanceRequired = false;
          }
          return Promise.resolve({ data: "2026-08-09T12:00:00.000Z", error: null });
        }
        if (name === "finalize_automatic_registration") {
          automaticRegistrationFinalizations.push(args);
          return Promise.resolve({ data: "2026-08-09T12:00:00.000Z", error: null });
        }
        if (name === "create_auth_recovery_grant") {
          recoveryGrantCalls.push(args);
          recoveryGrants.set(args.p_jti_hash, {
            userId: args.p_user_id,
            expiresAt: args.p_expires_at,
            claimed: false,
            used: false,
          });
          return Promise.resolve({ data: true, error: null });
        }
        if (name === "claim_auth_recovery_grant") {
          const grant = recoveryGrants.get(args.p_jti_hash);
          const usable = grant
            && grant.userId === args.p_user_id
            && !grant.claimed
            && !grant.used
            && Date.parse(grant.expiresAt) > Date.now();
          if (usable) grant.claimed = true;
          return Promise.resolve({ data: Boolean(usable), error: null });
        }
        if (name === "release_auth_recovery_grant") {
          const grant = recoveryGrants.get(args.p_jti_hash);
          const released = grant?.userId === args.p_user_id && grant.claimed && !grant.used;
          if (released) grant.claimed = false;
          return Promise.resolve({ data: Boolean(released), error: null });
        }
        if (name === "consume_auth_recovery_grant") {
          const grant = recoveryGrants.get(args.p_jti_hash);
          const usable = grant
            && grant.userId === args.p_user_id
            && grant.claimed
            && !grant.used
            && Date.parse(grant.expiresAt) > Date.now();
          if (usable) grant.used = true;
          return Promise.resolve({ data: Boolean(usable), error: null });
        }
        assert.fail(`Nieoczekiwane RPC klienta serwerowego: ${name}`);
      },
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
    await t.test("utrzymuje sesję przed akceptacją aktualnego regulaminu", async () => {
      const legalState = syntheticLegalStates[syntheticUsers["token-user-a"].id];
      const previousAcceptedVersion = legalState.acceptedVersion;
      const previousAcceptanceRequired = legalState.acceptanceRequired;
      authenticatedProfileAccessDenied = true;
      legalState.acceptedVersion = null;
      legalState.acceptanceRequired = true;
      try {
        const response = await fetch(`${baseUrl}/api/auth/session`, {
          headers: { Cookie: sessionCookies("token-user-a") },
        });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.authenticated, true);
        assert.equal(body.legal.acceptanceRequired, true);
      } finally {
        authenticatedProfileAccessDenied = false;
        legalState.acceptedVersion = previousAcceptedVersion;
        legalState.acceptanceRequired = previousAcceptanceRequired;
      }
    });

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

    await t.test("kończy sesję bez prawidłowej aktywności mimo ważnego tokenu", async () => {
      const missingActivity = await fetch(`${baseUrl}/api/yarns`, {
        headers: { Cookie: "motek_access_token=token-user-a" },
      });
      assert.equal(missingActivity.status, 401);
      assert.match(missingActivity.headers.get("set-cookie"), /motek_access_token=.*Max-Age=0/);
      assert.match(missingActivity.headers.get("set-cookie"), /motek_idle_activity=.*Max-Age=0/);

      const invalidActivity = await fetch(`${baseUrl}/api/yarns`, {
        headers: { Cookie: "motek_access_token=token-user-a; motek_idle_activity=invalid.signature" },
      });
      assert.equal(invalidActivity.status, 401);
      assert.match(invalidActivity.headers.get("set-cookie"), /motek_access_token=.*Max-Age=0/);

      const expiredActivity = buildIdleActivityCookie(0).split(";", 1)[0].split("=", 2)[1];
      const expiredResponse = await fetch(`${baseUrl}/api/yarns`, {
        headers: { Cookie: `motek_access_token=token-user-a; motek_idle_activity=${expiredActivity}` },
      });
      assert.equal(expiredResponse.status, 401);
      assert.match(expiredResponse.headers.get("set-cookie"), /motek_idle_activity=.*Max-Age=0/);
    });

    await t.test("wylogowanie wygasza ciasteczka mimo błędu Supabase", async () => {
      signOutFailure = new Error("Supabase niedostępne");
      try {
        const response = await fetch(`${baseUrl}/api/auth/logout`, {
          method: "POST",
          headers: { Origin: baseUrl, Cookie: sessionCookies("token-user-a") },
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { authenticated: false });
        assert.match(response.headers.get("set-cookie"), /motek_access_token=.*Max-Age=0/);
        assert.match(response.headers.get("set-cookie"), /motek_refresh_token=.*Max-Age=0/);
        assert.match(response.headers.get("set-cookie"), /motek_idle_activity=.*Max-Age=0/);
      } finally {
        signOutFailure = null;
      }
    });

    await t.test("zachowuje sesję podczas przejściowego błędu profilu", async () => {
      profileQueryFailure = Object.assign(new Error("Przekroczono czas oczekiwania"), { code: "ETIMEDOUT" });
      try {
        const timeoutResponse = await fetch(`${baseUrl}/api/yarns`, {
          headers: { Cookie: sessionCookies("token-user-a") },
        });
        assert.equal(timeoutResponse.status, 503);
        assert.equal(timeoutResponse.headers.get("set-cookie"), null);
      } finally {
        profileQueryFailure = null;
      }

      profileResultOverride = { data: null, error: { message: "Supabase niedostępne", status: 503 } };
      try {
        const unavailableResponse = await fetch(`${baseUrl}/api/yarns`, {
          headers: { Cookie: sessionCookies("token-user-a") },
        });
        assert.equal(unavailableResponse.status, 503);
        assert.equal(unavailableResponse.headers.get("set-cookie"), null);
      } finally {
        profileResultOverride = null;
      }
    });

    await t.test("kończy sesję, gdy profil nie istnieje lub nie jest aktywny", async () => {
      profileResultOverride = { data: null, error: null };
      try {
        const missingProfile = await fetch(`${baseUrl}/api/yarns`, {
          headers: { Cookie: sessionCookies("token-user-a") },
        });
        assert.equal(missingProfile.status, 401);
        assert.match(missingProfile.headers.get("set-cookie"), /motek_access_token=.*Max-Age=0/);
      } finally {
        profileResultOverride = null;
      }

      syntheticProfiles[syntheticUsers["token-user-a"].id].status = "suspended";
      try {
        const inactiveProfile = await fetch(`${baseUrl}/api/yarns`, {
          headers: { Cookie: sessionCookies("token-user-a") },
        });
        assert.equal(inactiveProfile.status, 403);
        assert.match(inactiveProfile.headers.get("set-cookie"), /motek_access_token=.*Max-Age=0/);
      } finally {
        syntheticProfiles[syntheticUsers["token-user-a"].id].status = "active";
      }
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
          termsAccepted: true,
          termsVersion: "1.0",
          privacyNoticeVersion: "1.0",
        }),
      });
      assert.equal(registerResponse.status, 201);
      assert.deepEqual(automaticRegistrationFinalizations.at(-1), {
        p_user_id: "33333333-3333-4333-8333-333333333333",
        p_terms_version: "1.0",
        p_privacy_version: "1.0",
      });
      assert.deepEqual(await registerResponse.json(), {
        user: {
          id: "33333333-3333-4333-8333-333333333333",
          email: "nowy@example.com",
          emailConfirmed: false,
          metadata: { login: "nowy@example.com" },
        },
        requiresEmailConfirmation: true,
        idleTimeoutMs: 2 * 60 * 60 * 1000,
      });
      assert.deepEqual(signUpRequests.at(-1), {
        email: "nowy@example.com",
        options: {
          data: { login: "nowy@example.com" },
          captchaToken: "register-token",
          emailRedirectTo: `${baseUrl}/?confirmed=1`,
        },
      });

      const successfulLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({
          email: "a@example.com",
          password: "DeleteHaslo1!",
          captchaToken: "valid-login-token",
        }),
      });
      assert.equal(successfulLogin.status, 200);
      assert.equal((await successfulLogin.json()).idleTimeoutMs, 2 * 60 * 60 * 1000);

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

    await t.test("potwierdza tokeny wydane podczas rejestracji i ustawia sesję", async () => {
      const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({
          login: "potwierdzenie@example.com",
          password: "Haslo123!",
          captchaToken: "register-confirmation-token",
          termsAccepted: true,
          termsVersion: "1.0",
          privacyNoticeVersion: "1.0",
        }),
      });
      assert.equal(registerResponse.status, 201);
      assert.equal((await registerResponse.json()).requiresEmailConfirmation, true);

      const confirmationTokens = issuedSignupConfirmationTokens.at(-1);
      assert.ok(confirmationTokens);
      const confirmation = await fetch(`${baseUrl}/api/auth/confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify(confirmationTokens),
      });

      assert.equal(confirmation.status, 200);
      assert.deepEqual(await confirmation.json(), {
        user: {
          id: "33333333-3333-4333-8333-333333333333",
          email: "nowy@example.com",
          emailConfirmed: true,
          metadata: { login: "nowy@example.com" },
        },
        idleTimeoutMs: 2 * 60 * 60 * 1000,
      });
      assert.match(confirmation.headers.get("set-cookie"), new RegExp(`motek_access_token=${confirmationTokens.access_token}`));
      assert.match(confirmation.headers.get("set-cookie"), new RegExp(`motek_refresh_token=${confirmationTokens.refresh_token}`));
      assert.match(confirmation.headers.get("set-cookie"), /motek_idle_activity=/);

      const reused = await fetch(`${baseUrl}/api/auth/confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify(confirmationTokens),
      });
      assert.equal(reused.status, 400);
      assert.deepEqual(await reused.json(), {
        error: "Link potwierdzający jest nieprawidłowy lub wygasł.",
      });
    });

    await t.test("zwraca neutralny błąd dla osobnego wygasłego tokenu potwierdzenia", async () => {
      const expired = await fetch(`${baseUrl}/api/auth/confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify(expiredConfirmationTokens),
      });

      assert.equal(expired.status, 400);
      assert.deepEqual(await expired.json(), {
        error: "Link potwierdzający jest nieprawidłowy lub wygasł.",
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

      const ordinarySessionResponse = await fetch(`${baseUrl}/api/auth/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: sessionCookies("token-user-a", "refresh-user-a"),
        },
        body: JSON.stringify({ password: "NoweHaslo123!" }),
      });
      assert.equal(ordinarySessionResponse.status, 400);

      const recoveryResponse = await fetch(`${baseUrl}/api/auth/recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ code: "recovery-code" }),
      });
      assert.equal(recoveryResponse.status, 200);
      assert.equal((await recoveryResponse.clone().json()).idleTimeoutMs, 2 * 60 * 60 * 1000);
      assert.deepEqual(exchangedRecoveryCodes, ["recovery-code"]);
      const recoveryCookies = recoveryResponse.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";", 1)[0])
        .join("; ");
      const recoveryGrantMatch = recoveryCookies.match(/(?:^|; )motek_recovery_grant=([^;]+)/);
      assert.ok(recoveryGrantMatch, "recovery ustanawia krótkotrwały grant w HttpOnly cookie");
      const recoveryGrantValue = decodeURIComponent(recoveryGrantMatch[1]);
      const [recoveryGrantUserId, recoveryGrantJti, recoveryGrantTimestamp, recoveryGrantSignature] = recoveryGrantValue.split(".");
      assert.equal(recoveryGrantUserId, syntheticUsers["token-user-a"].id);
      assert.equal(recoveryGrantJti, "grant-jti-user-a");
      assert.equal(Number.isSafeInteger(Number(recoveryGrantTimestamp)), true);
      assert.equal(typeof recoveryGrantSignature, "string");
      assert.deepEqual(recoveryGrantRpcs[0], {
        name: "create_auth_recovery_grant",
        args: {},
        userId: syntheticUsers["token-user-a"].id,
      });

      const activityResponse = await fetch(`${baseUrl}/api/auth/activity`, {
        method: "POST",
        headers: { Origin: baseUrl, Cookie: recoveryCookies },
        body: "{}",
      });
      assert.equal(activityResponse.status, 200);
      assert.deepEqual(await activityResponse.json(), { authenticated: true });
      assert.match(activityResponse.headers.get("set-cookie"), /motek_idle_activity=/);

      const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Cookie: recoveryCookies },
      });
      assert.equal(sessionResponse.status, 200);
      assert.equal((await sessionResponse.json()).idleTimeoutMs, 2 * 60 * 60 * 1000);

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
      assert.equal(signOutScopes.at(-1).scope, "global");
      assert.deepEqual(await updateResponse.json(), {
        passwordUpdated: true,
        authenticated: false,
      });
      assert.match(updateResponse.headers.get("set-cookie"), /motek_recovery_grant=.*Max-Age=0/);
      assert.match(updateResponse.headers.get("set-cookie"), /motek_access_token=.*Max-Age=0/);
      assert.match(updateResponse.headers.get("set-cookie"), /motek_refresh_token=.*Max-Age=0/);
      assert.ok(signOutScopes.some((call) => call.scope === "global"), "zmiana hasła unieważnia pozostałe sesje");

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

      await passwordT.test("zwraca 503 po błędzie claim bez zmiany hasła", async () => {
        recoveryGrantState.claimed = false;
        recoveryGrantState.claimError = new Error("claim failed");
        recoveryGrantEvents.length = 0;
        try {
          const updateUserCallsBefore = recoveryGrantState.updateUserCalls;
          const response = await passwordRequest();

          assert.equal(response.status, 503);
          assert.deepEqual(await response.json(), {
            error: "Odzyskiwanie hasła jest chwilowo niedostępne. Spróbuj ponownie później.",
          });
          assert.equal(recoveryGrantState.updateUserCalls, updateUserCallsBefore);
          assert.equal(recoveryGrantEvents.some(({ name }) => name === "consume_auth_recovery_grant"), false);
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
        recoveryGrantState.releaseError = new Error("release failed");
        recoveryGrantEvents.length = 0;
        try {
          const response = await passwordRequest();

          assert.equal(response.status, 400);
          assert.deepEqual(recoveryGrantEvents.map(({ name }) => name), [
            "claim_auth_recovery_grant",
            "updateUser",
            "release_auth_recovery_grant",
          ]);
          assert.equal(recoveryGrantState.claimed, true);
        } finally {
          recoveryGrantState.updateUserError = null;
          recoveryGrantState.releaseError = null;
          recoveryGrantState.claimed = false;
          recoveryGrantEvents.length = 0;
        }
      });

      await passwordT.test("zwraca 503 i zatrzymuje grant po błędzie consume", async () => {
        recoveryGrantState.claimed = false;
        recoveryGrantState.consumeResult = false;
        recoveryGrantEvents.length = 0;
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
        } finally {
          recoveryGrantState.consumeResult = true;
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
    });

    await t.test("usuwa bieżące konto po ponownym haśle i frazie", async () => {
      const response = await fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Cookie: sessionCookies("token-user-a"),
        },
        body: JSON.stringify({
          password: "DeleteHaslo1!",
          confirmation: "USUŃ KONTO",
          captchaToken: "delete-account-token",
        }),
      });

      assert.equal(response.status, 204);
      assert.equal(await response.text(), "");
      assert.deepEqual(deletedUserIds, [syntheticUsers["token-user-a"].id]);
      assert.deepEqual(deletionVerificationAttempts.at(-1), {
        email: syntheticUsers["token-user-a"].email,
        password: "DeleteHaslo1!",
        options: { captchaToken: "delete-account-token" },
      });
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
          Cookie: sessionCookies("token-user-a"),
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
          Cookie: sessionCookies("token-user-b"),
        },
        body: JSON.stringify({
          password: "BledneHaslo1!",
          confirmation: "USUŃ KONTO",
          captchaToken: "delete-account-token",
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
      const userACookies = sessionCookies("token-user-a");
      const userBCookies = sessionCookies("token-user-b");
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
      const patternHeaders = { Cookie: sessionCookies("token-user-a") };
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
