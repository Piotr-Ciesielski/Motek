const test = require("node:test");
const assert = require("node:assert/strict");
const { createLegalAccessService } = require("../legal-access-service");

const legalDocument = Object.freeze({ termsVersion: "1.0", privacyVersion: "1.0" });

function createService() {
  const calls = [];
  const service = createLegalAccessService({
    legalDocument,
    serviceClient: {
      async rpc(name, args) {
        calls.push({ name, args });
        if (name === "get_account_access_state") {
          return {
            data: {
              currentTermsVersion: "1.0",
              currentPrivacyVersion: "1.0",
              acceptedVersion: null,
              acceptanceRequired: true,
            },
            error: null,
          };
        }
        return { data: "2026-08-09T12:00:00.000Z", error: null };
      },
    },
  });
  return { calls, service };
}

test("normalizuje stan prawny konta do kontraktu sesji", async () => {
  const { calls, service } = createService();

  const state = await service.getAccountAccessState("user-1");

  assert.deepEqual(state, {
    currentVersion: "1.0",
    acceptedVersion: null,
    acceptanceRequired: true,
  });
  assert.deepEqual(calls, [{
    name: "get_account_access_state",
    args: { p_user_id: "user-1" },
  }]);
});

test("zapisuje aktualną akceptację i zwraca stabilny wynik", async () => {
  const { calls, service } = createService();

  const acceptance = await service.recordTermsAcceptance("user-1", "1.0", "1.0");

  assert.deepEqual(acceptance, {
    acceptedVersion: "1.0",
    acceptedAt: "2026-08-09T12:00:00.000Z",
  });
  assert.deepEqual(calls, [{
    name: "record_terms_acceptance",
    args: { p_user_id: "user-1", p_terms_version: "1.0", p_privacy_version: "1.0" },
  }]);
});

test("odrzuca próbę zapisania nieaktualnej wersji przed wywołaniem RPC", async () => {
  const { calls, service } = createService();

  await assert.rejects(
    () => service.recordTermsAcceptance("user-1", "0.9", "1.0"),
    /aktualną wersję dokumentów/i,
  );
  assert.deepEqual(calls, []);
});
