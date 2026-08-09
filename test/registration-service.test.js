const test = require("node:test");
const assert = require("node:assert/strict");
const { registerInvitedUser } = require("../registration-service");

const legalDocument = Object.freeze({ termsVersion: "1.0", privacyVersion: "1.0" });
const input = {
  email: " User@Example.com ",
  password: "StrongPassword!1",
  invitationToken: "a".repeat(64),
  termsVersion: "1.0",
  privacyVersion: "1.0",
  captchaToken: "captcha-token",
};

function createDependencies({ reserveError, finalizeError, deleteError } = {}) {
  const events = [];
  const rpcCalls = [];
  const deletedUsers = [];
  const dependencies = {
    events,
    rpcCalls,
    deletedUsers,
    authClient: {
      auth: {
        async signUp(payload) {
          events.push("signUp");
          dependencies.signUpPayload = payload;
          return { data: { user: { id: "user-1", email: payload.email }, session: { access_token: "session" } }, error: null };
        },
      },
    },
    adminClient: {
      auth: {
        admin: {
          async deleteUser(userId) {
            events.push("delete-user");
            deletedUsers.push(userId);
            return deleteError ? { data: null, error: deleteError } : { data: {}, error: null };
          },
        },
      },
    },
    serviceClient: {
      async rpc(name, parameters) {
        rpcCalls.push({ name, parameters });
        if (name === "reserve_registration_invitation") {
          events.push("reserve");
          if (reserveError) return { data: null, error: reserveError };
          return { data: "invitation-1", error: null };
        }
        if (name === "attach_registration_user") {
          events.push("attach-user");
          return { data: true, error: null };
        }
        if (name === "finalize_invited_registration") {
          events.push("finalize");
          if (finalizeError) return { data: null, error: finalizeError };
          return { data: new Date().toISOString(), error: null };
        }
        if (name === "release_registration_reservation") {
          events.push("release");
          return { data: true, error: null };
        }
        throw new Error(`Unexpected RPC ${name}`);
      },
    },
    legalDocument,
    async hashInvitationToken(token) {
      events.push("hash");
      assert.equal(token, input.invitationToken);
      return "b".repeat(64);
    },
  };
  return dependencies;
}

test("wykonuje rejestrację w kolejności rezerwacja, Auth, attach, finalizacja", async () => {
  const dependencies = createDependencies();
  const result = await registerInvitedUser(input, dependencies);

  assert.deepEqual(dependencies.events, ["hash", "reserve", "signUp", "attach-user", "finalize"]);
  assert.equal(result.session.access_token, "session");
  assert.deepEqual(dependencies.signUpPayload.options, {
    data: { login: "user@example.com" },
    captchaToken: "captcha-token",
  });
  assert.equal(dependencies.rpcCalls[0].parameters.p_email, "user@example.com");
});

test("nie wywołuje signUp po odrzuceniu rezerwacji", async () => {
  const dependencies = createDependencies({ reserveError: new Error("sekret zaproszenia") });
  await assert.rejects(() => registerInvitedUser(input, dependencies), /Nie udało się ukończyć rejestracji/);
  assert.deepEqual(dependencies.events, ["hash", "reserve"]);
});

test("nie zwraca sesji przed finalizacją i sprząta utworzone konto", async () => {
  const dependencies = createDependencies({ finalizeError: new Error("błąd finalizacji") });
  await assert.rejects(() => registerInvitedUser(input, dependencies), /Nie udało się ukończyć rejestracji/);
  assert.deepEqual(dependencies.events, ["hash", "reserve", "signUp", "attach-user", "finalize", "delete-user", "release"]);
  assert.deepEqual(dependencies.deletedUsers, ["user-1"]);
});

test("nie zwalnia rezerwacji po niepotwierdzonym usunięciu konta", async () => {
  const dependencies = createDependencies({ finalizeError: new Error("błąd"), deleteError: new Error("delete failed") });
  await assert.rejects(() => registerInvitedUser(input, dependencies));
  assert.deepEqual(dependencies.events, ["hash", "reserve", "signUp", "attach-user", "finalize", "delete-user"]);
});

test("może zakończyć finalizację bez wcześniejszej sesji Auth", async () => {
  const dependencies = createDependencies();
  dependencies.authClient.auth.signUp = async () => ({
    data: { user: { id: "user-1", email: "user@example.com" }, session: null },
    error: null,
  });
  const result = await registerInvitedUser(input, dependencies);
  assert.equal(result.session, null);
  assert.ok(result.user);
});
