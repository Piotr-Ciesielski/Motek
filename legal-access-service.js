function createLegalAccessService({ legalDocument, serviceClient }) {
  async function callRpc(name, args) {
    const result = await serviceClient.rpc(name, args);
    if (result?.error) throw result.error;
    return result?.data;
  }

  return {
    async getAccountAccessState(userId) {
      const state = await callRpc("get_account_access_state", { p_user_id: userId });
      if (!state || typeof state !== "object") {
        throw new Error("Nie udało się pobrać stanu dokumentów prawnych.");
      }
      return {
        currentVersion: state.currentTermsVersion,
        acceptedVersion: state.acceptedVersion ?? null,
        acceptanceRequired: state.acceptanceRequired === true,
      };
    },

    async recordTermsAcceptance(userId, termsVersion, privacyVersion) {
      if (termsVersion !== legalDocument.termsVersion || privacyVersion !== legalDocument.privacyVersion) {
        throw new Error("Zaakceptuj aktualną wersję dokumentów");
      }
      const acceptedAt = await callRpc("record_terms_acceptance", {
        p_user_id: userId,
        p_terms_version: termsVersion,
        p_privacy_version: privacyVersion,
      });
      return { acceptedVersion: termsVersion, acceptedAt };
    },
  };
}

module.exports = { createLegalAccessService };
