const REQUIRED_PROVIDERS = ["supabase", "railway", "cloudflare"];
const REQUIRED_SERVICE_EVIDENCE = Object.freeze({
  cloudflare: ["edge", "turnstile"],
});
const PRODUCTION_SCOPES = new Set(["production", "production-and-staging"]);
const EVIDENCE_HOSTS = Object.freeze({
  supabase: ["supabase.com"],
  railway: ["railway.com"],
  cloudflare: ["cloudflare.com"],
});
const PLACEHOLDER_MARKERS = [
  "do uzupełnienia",
  "do potwierdzenia",
  "unverified",
  "unknown",
  "tbd",
  "n/a",
  "pending",
  "w trakcie potwierdzania",
];

function isPlaceholder(value) {
  return typeof value !== "string" || !value.trim() || /^\[[^\]]+\]$/.test(value.trim());
}

function isConfirmedValue(value) {
  if (isPlaceholder(value)) return false;
  const normalized = value.trim().toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function hasEvidence(providerName, evidence) {
  return (
    Array.isArray(evidence) &&
    evidence.length > 0 &&
    evidence.every((value) => {
      if (typeof value !== "string") return false;
      try {
        const url = new URL(value.trim());
        const allowedHosts = EVIDENCE_HOSTS[providerName] || [];
        return (
          url.protocol === "https:" &&
          allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
        );
      } catch {
        return false;
      }
    })
  );
}

function hasValidVerifiedAt(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return date.getTime() <= Date.now();
}

function validateEvidenceRecord(providerName, provider, errors, scopeLabel = "") {
  const label = scopeLabel ? ` ${scopeLabel}` : "";
  if (scopeLabel && !PRODUCTION_SCOPES.has(provider?.scope)) {
    errors.push(`Dostawca ${providerName}${label} nie ma potwierdzonego zakresu produkcyjnego.`);
  }
  if (!isConfirmedValue(provider?.location)) {
    errors.push(`Dostawca ${providerName}${label} nie ma potwierdzonej lokalizacji.`);
  }
  if (!isConfirmedValue(provider?.transfer)) {
    errors.push(`Dostawca ${providerName}${label} nie ma potwierdzonego transferu.`);
  }
  if (!isConfirmedValue(provider?.retention)) {
    errors.push(`Dostawca ${providerName}${label} nie ma potwierdzonej retencji.`);
  }
  if (!isConfirmedValue(provider?.evidenceScope)) {
    errors.push(`Dostawca ${providerName}${label} nie ma potwierdzonego zakresu dowodu.`);
  }
  if (!hasEvidence(providerName, provider?.evidence)) {
    errors.push(`Dostawca ${providerName}${label} nie ma dowodu weryfikacji z zatwierdzonej domeny.`);
  }
  if (!hasValidVerifiedAt(provider?.verifiedAt)) {
    errors.push(`Dostawca ${providerName}${label} nie ma daty weryfikacji.`);
  }
}

function validateLegalPublication({ legalDocument, providers, patternAudit, deploymentEnvironment } = {}) {
  const environment = String(deploymentEnvironment || "local").trim().toLowerCase();
  if (environment === "local" || environment === "staging") return { ready: true, errors: [] };
  if (environment !== "production") return { ready: false, errors: ["Nieznane środowisko wdrożenia."] };

  const errors = [];
  const operator = legalDocument?.operator;
  if (!isConfirmedValue(operator?.name) || !isConfirmedValue(operator?.email)) {
    errors.push("Brak kompletnego operatora prawnego.");
  }

  for (const providerName of Object.keys(providers || {})) {
    if (!REQUIRED_PROVIDERS.includes(providerName)) {
      errors.push(`Nieznany dostawca ${providerName}.`);
    }
  }

  for (const providerName of REQUIRED_PROVIDERS) {
    const provider = providers?.[providerName];
    if (!provider || provider.status !== "verified") {
      errors.push(`Dostawca ${providerName} nie jest zweryfikowany.`);
      continue;
    }
    if (!PRODUCTION_SCOPES.has(provider.scope)) {
      errors.push(`Dostawca ${providerName} nie ma potwierdzonego zakresu produkcyjnego.`);
    }
    validateEvidenceRecord(providerName, provider, errors);

    const requiredServices = REQUIRED_SERVICE_EVIDENCE[providerName] || [];
    const declaredServices = Array.isArray(provider.services) ? provider.services : [];
    for (const serviceName of declaredServices) {
      if (!requiredServices.includes(serviceName)) {
        errors.push(`Dostawca ${providerName} ma nieznany zakres ${serviceName}.`);
      }
    }
    for (const serviceName of requiredServices) {
      if (!declaredServices.includes(serviceName)) {
        errors.push(`Dostawca ${providerName} nie deklaruje zakresu ${serviceName}.`);
      }
      validateEvidenceRecord(
        providerName,
        provider.serviceEvidence?.[serviceName],
        errors,
        serviceName,
      );
    }
  }

  if (patternAudit?.complete !== true) errors.push("Audyt katalogu nie jest kompletny.");
  if (Number(patternAudit?.pending_review || 0) > 0) errors.push("Katalog zawiera rekordy pending_review.");
  return { ready: errors.length === 0, errors };
}

module.exports = { REQUIRED_PROVIDERS, validateLegalPublication };
