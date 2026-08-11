const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  createInvitation,
  normalizeExpiry,
  parseArgs,
  purgeRegistrationLogs,
  revokeInvitation,
  validateAppOrigin,
} = require("../scripts/manage-invitations");

function createInvitationClient({ id = "11111111-1111-4111-8111-111111111111" } = {}) {
  const rpcCalls = [];
  return {
    rpcCalls,
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      if (name === "create_registration_invitation") return { data: id, error: null };
      if (name === "revoke_registration_invitation") return { data: true, error: null };
      if (name === "purge_registration_security_logs") return { data: { invitationsDeleted: 2 }, error: null };
      throw new Error(`Nieoczekiwane RPC: ${name}`);
    },
  };
}

test("createInvitation normalizuje dane, zapisuje wyłącznie hash i zwraca link jednorazowy", async () => {
  const client = createInvitationClient();
  const randomBytes = Buffer.alloc(32, 0xab);
  const result = await createInvitation({
    client,
    email: "  User@Example.COM ",
    expiresAt: "2030-01-02T03:04:05Z",
    appOrigin: "https://motek.example",
    now: () => new Date("2029-01-01T00:00:00Z"),
    randomBytesImpl: () => randomBytes,
  });

  const token = randomBytes.toString("hex");
  assert.equal(token.length, 64);
  assert.deepEqual(client.rpcCalls[0], {
    name: "create_registration_invitation",
    args: {
      p_email: "user@example.com",
      p_token_hash: crypto.createHash("sha256").update(token, "utf8").digest("hex"),
      p_expires_at: "2030-01-02T03:04:05.000Z",
    },
  });
  assert.equal(result.id, "11111111-1111-4111-8111-111111111111");
  assert.equal(result.token, token);
  assert.equal((result.invitationUrl.match(new RegExp(token, "g")) || []).length, 1);
  assert.equal(result.invitationUrl.startsWith("https://motek.example/?invitation="), true);
  assert.equal(JSON.stringify(client.rpcCalls[0]).includes(token), false);
});

test("createInvitation wymaga przyszłej daty i dokładnie 32 bajtów losowości", async () => {
  const client = createInvitationClient();
  await assert.rejects(
    createInvitation({
      client,
      email: "user@example.com",
      expiresAt: "2028-01-01T00:00:00Z",
      now: () => new Date("2029-01-01T00:00:00Z"),
      randomBytesImpl: () => Buffer.alloc(32),
    }),
    /przyszłości/i,
  );
  await assert.rejects(
    createInvitation({
      client,
      email: "user@example.com",
      expiresAt: "2030-01-01T00:00:00Z",
      now: () => new Date("2029-01-01T00:00:00Z"),
      randomBytesImpl: () => Buffer.alloc(31),
    }),
    /32 losowych bajtów/i,
  );
});

test("normalizeExpiry wymaga ścisłego ISO 8601 z timezone i odrzuca nieprawidłową datę", () => {
  const now = new Date("2029-01-01T00:00:00Z");

  assert.equal(
    normalizeExpiry("2030-01-02T03:04:05+02:00", now),
    "2030-01-02T01:04:05.000Z",
  );
  for (const value of [
    "2030-01-02",
    "2030-01-02 03:04:05Z",
    "2030-01-02T03:04:05",
    "2030-02-30T03:04:05Z",
  ]) {
    assert.throws(() => normalizeExpiry(value, now), /ISO|poprawną datą/i, value);
  }
});

test("validateAppOrigin odrzuca dane logowania i publiczny HTTP, ale dopuszcza HTTPS oraz lokalny HTTP", () => {
  for (const value of [
    "https://user:password@example.com",
    "http://motek.example",
  ]) {
    assert.throws(() => validateAppOrigin(value), /APP_ORIGIN|origin|HTTP/i, value);
  }

  for (const value of [
    "https://motek.example",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://[::1]:3001",
  ]) {
    assert.doesNotThrow(() => validateAppOrigin(value), value);
  }
});

test("parseArgs rozpoznaje create, revoke i purge oraz odrzuca brakujące argumenty", () => {
  assert.deepEqual(parseArgs(["create", "--email", "a@example.com", "--expires-at", "2030-01-01T00:00:00Z"]), {
    command: "create",
    email: "a@example.com",
    expiresAt: "2030-01-01T00:00:00Z",
  });
  assert.deepEqual(parseArgs(["revoke", "--id", "11111111-1111-4111-8111-111111111111"]), {
    command: "revoke",
    id: "11111111-1111-4111-8111-111111111111",
  });
  assert.deepEqual(parseArgs(["purge"]), { command: "purge" });
  assert.throws(() => parseArgs(["create", "--email", "a@example.com"]), /expires-at/i);
  assert.throws(() => parseArgs(["unknown"]), /Nieznana komenda/i);
});

test("revokeInvitation wywołuje service-only RPC z identyfikatorem", async () => {
  const client = createInvitationClient();
  const result = await revokeInvitation(client, "11111111-1111-4111-8111-111111111111");
  assert.equal(result, true);
  assert.deepEqual(client.rpcCalls, [{
    name: "revoke_registration_invitation",
    args: { p_invitation_id: "11111111-1111-4111-8111-111111111111" },
  }]);
});

test("purgeRegistrationLogs nie przekazuje daty z CLI", async () => {
  const client = createInvitationClient();
  const result = await purgeRegistrationLogs(client);
  assert.deepEqual(result, { invitationsDeleted: 2 });
  assert.deepEqual(client.rpcCalls, [{ name: "purge_registration_security_logs", args: undefined }]);
});
