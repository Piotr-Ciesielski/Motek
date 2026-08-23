function validateRegistrationLegalInput(body, currentDocument) {
  if (!body || typeof body !== "object" || !currentDocument || typeof currentDocument !== "object") {
    throw new TypeError("Nieprawidłowe dane rejestracji");
  }

  if (body.termsAccepted !== true) {
    throw new Error("Aby się zarejestrować, zaakceptuj regulamin");
  }

  if (body.termsVersion !== currentDocument.termsVersion
      || body.privacyNoticeVersion !== currentDocument.privacyVersion) {
    throw new Error("Zaakceptuj aktualną wersję dokumentów");
  }

  return Object.freeze({
    termsVersion: currentDocument.termsVersion,
    privacyVersion: currentDocument.privacyVersion,
  });
}

module.exports = {
  validateRegistrationLegalInput,
};
