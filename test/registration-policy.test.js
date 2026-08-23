const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateRegistrationLegalInput,
} = require("../registration-policy");

const CURRENT_LEGAL_DOCUMENT = Object.freeze({
  termsVersion: "1.0",
  privacyVersion: "1.0",
});
test("odrzuca rejestrację bez jawnej akceptacji", () => {
  for (const termsAccepted of [false, "true", 1, null]) {
    assert.throws(() => validateRegistrationLegalInput({
      termsAccepted,
      termsVersion: "1.0",
      privacyNoticeVersion: "1.0",
    }, CURRENT_LEGAL_DOCUMENT), /zaakceptuj regulamin/);
  }
});

test("odrzuca starą wersję dokumentu", () => {
  assert.throws(() => validateRegistrationLegalInput({
    termsAccepted: true,
    termsVersion: "0.9",
    privacyNoticeVersion: "1.0",
  }, CURRENT_LEGAL_DOCUMENT), /aktualną wersję/);
});

test("odrzuca inną wersję informacji o prywatności", () => {
  assert.throws(() => validateRegistrationLegalInput({
    termsAccepted: true,
    termsVersion: "1.0",
    privacyNoticeVersion: "0.9",
  }, CURRENT_LEGAL_DOCUMENT), /aktualną wersję/);
});

test("zwraca zamrożone dane prawne bez tokenu zaproszenia", () => {
  const result = validateRegistrationLegalInput({
    termsAccepted: true,
    termsVersion: "1.0",
    privacyNoticeVersion: "1.0",
  }, CURRENT_LEGAL_DOCUMENT);

  assert.deepEqual(result, {
    termsVersion: "1.0",
    privacyVersion: "1.0",
  });
  assert.equal(Object.isFrozen(result), true);
});
