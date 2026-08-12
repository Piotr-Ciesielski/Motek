const test = require("node:test");
const assert = require("node:assert/strict");
const { validateLegalPublication } = require("../legal-publication-policy");

const base = {
  legalDocument: { operator: { name: "Operator", email: "operator@example.com" } },
  providers: {
    supabase: { status: "verified", evidence: ["https://example.com/a"], verifiedAt: "2026-08-09" },
    railway: { status: "verified", evidence: ["https://example.com/b"], verifiedAt: "2026-08-09" },
    cloudflare: { status: "verified", evidence: ["https://example.com/c"], verifiedAt: "2026-08-09" },
  },
  patternAudit: { complete: true, pending_review: 0 },
  deploymentEnvironment: "production",
};

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

test("draft lokalny nie blokuje środowiska lokalnego", () => {
  const result = validateLegalPublication({
    legalDocument: { operator: { name: "[IMIĘ I NAZWISKO OPERATORA]", email: "[E-MAIL KONTAKTOWY]" } },
    providers: {},
    patternAudit: { complete: false, pending_review: 3 },
    deploymentEnvironment: "local",
  });
  assert.equal(result.ready, true);
});
