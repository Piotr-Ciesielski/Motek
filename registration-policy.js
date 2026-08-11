const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{64}$/;

function normalizeInvitationToken(value) {
  if (typeof value !== "string") {
    throw new TypeError("Token zaproszenia musi być tekstem");
  }

  const token = value.trim();
  if (!INVITATION_TOKEN_PATTERN.test(token)) {
    throw new Error("Nieprawidłowy token zaproszenia");
  }

  return token;
}

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
    invitationToken: normalizeInvitationToken(body.invitationToken),
    termsVersion: currentDocument.termsVersion,
    privacyVersion: currentDocument.privacyVersion,
  });
}

module.exports = {
  normalizeInvitationToken,
  validateRegistrationLegalInput,
};
