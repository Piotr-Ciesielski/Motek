(function exposeLegalAcceptanceController(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.createLegalAcceptanceController = api.createLegalAcceptanceController;
  }
})(typeof globalThis === "object" ? globalThis : null, () => {
  function createLegalAcceptanceController({
    form,
    gate,
    message,
    versionOutput,
    request,
    legalDocument,
    onAccepted,
  }) {
    if (!form || !gate || !message || !versionOutput) {
      throw new TypeError("Kontroler akceptacji wymaga elementów formularza i gate.");
    }
    if (typeof request !== "function") {
      throw new TypeError("Kontroler akceptacji wymaga funkcji żądania.");
    }
    if (!legalDocument || typeof legalDocument.termsVersion !== "string") {
      throw new TypeError("Kontroler akceptacji wymaga bieżącego dokumentu prawnego.");
    }

    const termsAccepted = form.elements.termsAccepted;
    let acceptanceRequired = false;

    function setMessage(text) {
      message.textContent = text || "";
    }

    function isAcceptanceRequired() {
      return acceptanceRequired;
    }

    function setSessionLegalState(legalState = {}) {
      const currentVersion = legalState.currentVersion || legalDocument.termsVersion;
      const acceptedVersion = legalState.acceptedVersion ?? null;
      acceptanceRequired = legalState.acceptanceRequired === true
        || acceptedVersion !== currentVersion;
      versionOutput.textContent = legalDocument.termsVersion;
      gate.hidden = !acceptanceRequired;
      if (acceptanceRequired && termsAccepted) termsAccepted.checked = false;
      if (!acceptanceRequired) setMessage("");
      return acceptanceRequired;
    }

    async function submit(event) {
      event?.preventDefault?.();
      if (!acceptanceRequired) return false;
      if (!termsAccepted?.checked) {
        setMessage("Zaznacz akceptację regulaminu, aby kontynuować.");
        return false;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      setMessage("");
      try {
        await request("/api/legal/acceptance", {
          method: "POST",
          body: JSON.stringify({ version: legalDocument.termsVersion }),
        });
        await onAccepted?.();
        gate.hidden = true;
        acceptanceRequired = false;
        setMessage("");
        return true;
      } catch (error) {
        setMessage(error?.message || "Nie udało się zapisać akceptacji.");
        return false;
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    }

    form.addEventListener("submit", submit);
    versionOutput.textContent = legalDocument.termsVersion;

    return {
      setSessionLegalState,
      isAcceptanceRequired,
      submit,
    };
  }

  return { createLegalAcceptanceController };
});
