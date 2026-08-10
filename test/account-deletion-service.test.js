const { test } = require("node:test");
const assert = require("node:assert/strict");
const { deleteSupabaseAccount } = require("../account-deletion-service");

const session = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "a@example.com",
  },
};

test("weryfikuje hasło dla bieżącego użytkownika przed usunięciem", async () => {
  const passwordAttempts = [];
  const deletedUserIds = [];

  await deleteSupabaseAccount({
    session,
    password: "BezpieczneHaslo1!",
    authClient: {
      auth: {
        async signInWithPassword(credentials) {
          passwordAttempts.push(credentials);
          return { data: { user: session.user }, error: null };
        },
      },
    },
    adminClient: {
      auth: {
        admin: {
          async deleteUser(userId) {
            deletedUserIds.push(userId);
            return { data: { user: session.user }, error: null };
          },
        },
      },
    },
  });

  assert.deepEqual(passwordAttempts, [{
    email: "a@example.com",
    password: "BezpieczneHaslo1!",
  }]);
  assert.deepEqual(deletedUserIds, [session.user.id]);
});

test("pozwala usunąć konto bez aktualnej akceptacji prawnej", async () => {
  const staleSession = {
    user: session.user,
    legal: {
      currentVersion: "2.0",
      acceptedVersion: "1.0",
      acceptanceRequired: true,
    },
  };
  let deletedUserId = null;

  await deleteSupabaseAccount({
    session: staleSession,
    password: "BezpieczneHaslo1!",
    authClient: {
      auth: {
        async signInWithPassword() {
          return { data: { user: session.user }, error: null };
        },
      },
    },
    adminClient: {
      auth: {
        admin: {
          async deleteUser(userId) {
            deletedUserId = userId;
            return { data: { user: session.user }, error: null };
          },
        },
      },
    },
  });

  assert.equal(deletedUserId, session.user.id);
});

test("nie usuwa użytkownika po błędnym haśle", async () => {
  let deleteCalls = 0;

  await assert.rejects(
    deleteSupabaseAccount({
      session,
      password: "BledneHaslo1!",
      authClient: {
        auth: {
          async signInWithPassword() {
            return { data: { user: null }, error: new Error("invalid credentials") };
          },
        },
      },
      adminClient: {
        auth: {
          admin: {
            async deleteUser() {
              deleteCalls += 1;
              return { data: null, error: null };
            },
          },
        },
      },
    }),
    /Nie udało się potwierdzić hasła/,
  );

  assert.equal(deleteCalls, 0);
});

test("nie usuwa użytkownika, gdy ponowne logowanie zwróci inne konto", async () => {
  let deleteCalls = 0;

  await assert.rejects(
    deleteSupabaseAccount({
      session,
      password: "BezpieczneHaslo1!",
      authClient: {
        auth: {
          async signInWithPassword() {
            return {
              data: {
                user: { id: "22222222-2222-4222-8222-222222222222", email: "b@example.com" },
              },
              error: null,
            };
          },
        },
      },
      adminClient: {
        auth: {
          admin: {
            async deleteUser() {
              deleteCalls += 1;
              return { data: null, error: null };
            },
          },
        },
      },
    }),
    /Nie udało się potwierdzić hasła/,
  );

  assert.equal(deleteCalls, 0);
});
