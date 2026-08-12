const REQUIRED_PROVIDERS = ["supabase", "railway", "cloudflare"];

function isPlaceholder(value) {
  return typeof value !== "string" || !value.trim() || /^\[[^\]]+\]$/.test(value.trim());
}

function validateLegalPublication({ legalDocument, providers, patternAudit, deploymentEnvironment } = {}) {
  const environment = String(deploymentEnvironment || "local").trim().toLowerCase();
  if (environment !== "production") return { ready: true, errors: [] };

  const errors = [];
  const operator = legalDocument?.operator;
  if (isPlaceholder(operator?.name) || isPlaceholder(operator?.email)) {
    errors.push("Brak kompletnego operatora prawnego.");
  }

  for (const providerName of REQUIRED_PROVIDERS) {
    const provider = providers?.[providerName];
    if (!provider || provider.status !== "verified") {
      errors.push(`Dostawca ${providerName} nie jest zweryfikowany.`);
      continue;
    }
    if (!Array.isArray(provider.evidence) || provider.evidence.length === 0) {
      errors.push(`Dostawca ${providerName} nie ma dowodu weryfikacji.`);
    }
    if (typeof provider.verifiedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(provider.verifiedAt)) {
      errors.push(`Dostawca ${providerName} nie ma daty weryfikacji.`);
    }
  }

  if (patternAudit?.complete !== true) errors.push("Audyt katalogu nie jest kompletny.");
  if (Number(patternAudit?.pending_review || 0) > 0) errors.push("Katalog zawiera rekordy pending_review.");
  return { ready: errors.length === 0, errors };
}

module.exports = { REQUIRED_PROVIDERS, validateLegalPublication };
