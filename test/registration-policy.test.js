const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeInvitationToken,
  validateRegistrationLegalInput,
} = require("../registration-policy");

const CURRENT_LEGAL_DOCUMENT = Object.freeze({
  termsVersion: "1.0",
  privacyVersion: "1.0",
});
const VALID_TOKEN = "a".repeat(64);

test("normalizuje poprawny token zaproszenia przez trimowanie", () => {
  assert.equal(normalizeInvitationToken(`  ${VALID_TOKEN}  `), VALID_TOKEN);
});

test("odrzuca token bez dokładnie 64 znaków URL-safe", () => {
  for (const token of ["a".repeat(63), "a".repeat(65), "a".repeat(63) + "=", "a".repeat(63) + " ", null]) {
    assert.throws(() => normalizeInvitationToken(token), /token zaproszenia/i);
  }
});

test("odrzuca rejestrację bez jawnej akceptacji", () => {
  for (const termsAccepted of [false, "true", 1, null]) {
    assert.throws(() => validateRegistrationLegalInput({
      termsAccepted,
      termsVersion: "1.0",
      privacyNoticeVersion: "1.0",
      invitationToken: VALID_TOKEN,
    }, CURRENT_LEGAL_DOCUMENT), /zaakceptuj regulamin/);
  }
});

test("odrzuca starą wersję dokumentu", () => {
  assert.throws(() => validateRegistrationLegalInput({
    termsAccepted: true,
    termsVersion: "0.9",
    privacyNoticeVersion: "1.0",
    invitationToken: VALID_TOKEN,
  }, CURRENT_LEGAL_DOCUMENT), /aktualną wersję/);
});

test("odrzuca inną wersję informacji o prywatności", () => {
  assert.throws(() => validateRegistrationLegalInput({
    termsAccepted: true,
    termsVersion: "1.0",
    privacyNoticeVersion: "0.9",
    invitationToken: VALID_TOKEN,
  }, CURRENT_LEGAL_DOCUMENT), /aktualną wersję/);
});

test("zwraca zamrożone dane prawne z niezhashowanym tokenem", () => {
  const result = validateRegistrationLegalInput({
    termsAccepted: true,
    termsVersion: "1.0",
    privacyNoticeVersion: "1.0",
    invitationToken: ` ${VALID_TOKEN} `,
  }, CURRENT_LEGAL_DOCUMENT);

  assert.deepEqual(result, {
    invitationToken: VALID_TOKEN,
    termsVersion: "1.0",
    privacyVersion: "1.0",
  });
  assert.equal(Object.isFrozen(result), true);
});
