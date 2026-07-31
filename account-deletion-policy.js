const ACCOUNT_DELETION_PHRASE = "USUŃ KONTO";

function validateAccountDeletionInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Brak danych usunięcia konta.");
  }

  if (typeof value.password !== "string" || !value.password.trim()) {
    throw new Error("Podaj hasło.");
  }

  if (value.confirmation !== ACCOUNT_DELETION_PHRASE) {
    throw new Error(`Wpisz dokładnie: ${ACCOUNT_DELETION_PHRASE}.`);
  }

  return {
    password: value.password,
    confirmation: value.confirmation,
  };
}

module.exports = {
  ACCOUNT_DELETION_PHRASE,
  validateAccountDeletionInput,
};
