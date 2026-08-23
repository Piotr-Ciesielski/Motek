const test = require("node:test");
const assert = require("node:assert/strict");
const { readLegalPublicationEnforcement, validateLegalPublication } = require("../legal-publication-policy");

const base = {
  legalDocument: { operator: { name: "Operator", email: "operator@example.com" } },
  providers: {
    supabase: {
      status: "verified",
      scope: "production-and-staging",
      location: "eu-north-1",
      transfer: "UE lub potwierdzony mechanizm transferu",
      retention: "Potwierdzona retencja",
      evidenceScope: "Potwierdzony projekt produkcyjny Motek",
      evidence: ["https://supabase.com/docs/guides/platform/regions"],
      verifiedAt: "2026-08-09",
    },
    railway: {
      status: "verified",
      scope: "production-and-staging",
      location: "sfo",
      transfer: "Potwierdzony mechanizm transferu",
      retention: "7 dni",
      evidenceScope: "Potwierdzona usługa produkcyjna Motek",
      evidence: ["https://docs.railway.com/observability/logs"],
      verifiedAt: "2026-08-09",
    },
    cloudflare: {
      status: "verified",
      scope: "production-and-staging",
      location: "Potwierdzona lokalizacja przetwarzania",
      transfer: "Potwierdzony mechanizm transferu",
      retention: "Potwierdzona retencja",
      evidenceScope: "Potwierdzone strefy produkcyjne Motka",
      services: ["edge", "turnstile"],
      serviceEvidence: {
        edge: {
          scope: "production",
          location: "Potwierdzona lokalizacja edge",
          transfer: "Potwierdzony transfer edge",
          retention: "Potwierdzona retencja edge",
          evidenceScope: "Potwierdzona strefa edge Motka",
          evidence: ["https://developers.cloudflare.com/dns/proxy-status/"],
          verifiedAt: "2026-08-09",
        },
        turnstile: {
          scope: "production-and-staging",
          location: "Potwierdzona lokalizacja Turnstile",
          transfer: "Potwierdzony transfer Turnstile",
          retention: "Potwierdzona retencja Turnstile",
          evidenceScope: "Potwierdzony widget Turnstile Motka",
          evidence: ["https://www.cloudflare.com/en-in/turnstile-privacy-policy/"],
          verifiedAt: "2026-08-09",
        },
      },
      evidence: ["https://www.cloudflare.com/policies/privacy/"],
      verifiedAt: "2026-08-09",
    },
  },
  patternAudit: { complete: true, pending_review: 0 },
  deploymentEnvironment: "production",
};

test("blokada publikacji prawnej w runtime jest domyślnie wyłączona i może być włączona jawnie", () => {
  assert.equal(readLegalPublicationEnforcement({}), false);
  assert.equal(readLegalPublicationEnforcement({ ENFORCE_LEGAL_PUBLICATION: "false" }), false);
  assert.equal(readLegalPublicationEnforcement({ ENFORCE_LEGAL_PUBLICATION: "true" }), true);
});

test("polityka nie ufa wejściowemu ready i wymaga kompletnej produkcji", () => {
  const result = validateLegalPublication({ ...base, ready: true });
  assert.equal(result.ready, true);
  assert.equal(Object.hasOwn(result, "operator"), false);
});

test("unverified provider blokuje produkcję bez ujawniania operatora", () => {
  const result = validateLegalPublication({
    ...base,
    providers: { ...base.providers, railway: { status: "unverified" } },
    legalDocument: { operator: { name: "TAJNY OPERATOR", email: "secret@example.com" } },
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /railway|dostawc/i);
  assert.doesNotMatch(result.errors.join(" "), /TAJNY|secret@example.com/);
});

test("produkcja odrzuca zweryfikowanego dostawcę z placeholderem transferu lub retencji", () => {
  const result = validateLegalPublication({
    ...base,
    providers: {
      ...base.providers,
      railway: { ...base.providers.railway, transfer: "do uzupełnienia", retention: "do potwierdzenia" },
    },
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /railway.*(transfer|retencj)/i);
});

test("produkcja odrzuca placeholder danych operatora", () => {
  const result = validateLegalPublication({
    ...base,
    legalDocument: { operator: { name: "do uzupełnienia", email: "operator@example.com" } },
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /operatora/i);
});

test("produkcja odrzuca nieznanego dostawcę", () => {
  const result = validateLegalPublication({
    ...base,
    providers: { ...base.providers, unknown: { status: "verified" } },
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /unknown|nieznan/i);
});

test("produkcja odrzuca dowód spoza zatwierdzonej domeny dostawcy", () => {
  const result = validateLegalPublication({
    ...base,
    providers: {
      ...base.providers,
      railway: { ...base.providers.railway, evidence: ["https://example.com/fake-proof"] },
    },
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /railway.*dowodu/i);
});

test("produkcja odrzuca placeholder zakresu dowodu i przyszłą datę weryfikacji", () => {
  const result = validateLegalPublication({
    ...base,
    providers: {
      ...base.providers,
      cloudflare: {
        ...base.providers.cloudflare,
        evidenceScope: "TBD",
        verifiedAt: "2999-01-01",
      },
    },
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /cloudflare.*(dowodu|daty)/i);
});

test("produkcja wymaga osobnych dowodów dla zakresów Cloudflare", () => {
  const result = validateLegalPublication({
    ...base,
    providers: {
      ...base.providers,
      cloudflare: { ...base.providers.cloudflare, serviceEvidence: undefined },
    },
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /cloudflare.*(edge|turnstile|zakres)/i);
});

test("produkcja odrzuca niekompletny dowód pojedynczego zakresu Cloudflare", () => {
  const result = validateLegalPublication({
    ...base,
    providers: {
      ...base.providers,
      cloudflare: {
        ...base.providers.cloudflare,
        serviceEvidence: {
          ...base.providers.cloudflare.serviceEvidence,
          turnstile: {
            ...base.providers.cloudflare.serviceEvidence.turnstile,
            retention: "do potwierdzenia",
          },
        },
      },
    },
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /cloudflare.*turnstile.*retencj/i);
});

test("produkcja odrzuca zakres Cloudflare bez produkcyjnego scope", () => {
  const result = validateLegalPublication({
    ...base,
    providers: {
      ...base.providers,
      cloudflare: {
        ...base.providers.cloudflare,
        serviceEvidence: {
          ...base.providers.cloudflare.serviceEvidence,
          edge: { ...base.providers.cloudflare.serviceEvidence.edge, scope: "staging" },
        },
      },
    },
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /cloudflare.*edge.*zakres/i);
});

test("nieznane środowisko wdrożenia blokuje publikację", () => {
  const result = validateLegalPublication({ ...base, deploymentEnvironment: "prod" });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /środowisk/i);
});

test("draft lokalny nie blokuje środowiska lokalnego", () => {
  const result = validateLegalPublication({
    legalDocument: { operator: { name: "[IMIĘ I NAZWISKO OPERATORA]", email: "[E-MAIL KONTAKTOWY]" } },
    providers: {},
    patternAudit: { complete: false, pending_review: 3 },
    deploymentEnvironment: "local",
  });
  assert.equal(result.ready, true);
});
