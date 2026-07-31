const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ACCOUNT_DELETION_PHRASE,
  validateAccountDeletionInput,
} = require("../account-deletion-policy");

test("przyjmuje poprawne hasło i dokładną frazę", () => {
  assert.deepEqual(
    validateAccountDeletionInput({
      password: "BezpieczneHaslo1!",
      confirmation: ACCOUNT_DELETION_PHRASE,
    }),
    { password: "BezpieczneHaslo1!", confirmation: ACCOUNT_DELETION_PHRASE },
  );
});

test("odrzuca błędną frazę niezależnie od wielkości liter i spacji", () => {
  assert.throws(
    () => validateAccountDeletionInput({
      password: "BezpieczneHaslo1!",
      confirmation: " usuń konto ",
    }),
    /USUŃ KONTO/,
  );
});

test("odrzuca brak hasła, frazy i obiekt zamiast danych", () => {
  assert.throws(() => validateAccountDeletionInput(null), /danych/);
  assert.throws(
    () => validateAccountDeletionInput({ confirmation: ACCOUNT_DELETION_PHRASE }),
    /hasło/,
  );
  assert.throws(
    () => validateAccountDeletionInput({ password: "BezpieczneHaslo1!" }),
    /USUŃ KONTO/,
  );
});
