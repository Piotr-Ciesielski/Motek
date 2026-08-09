const test = require("node:test");
const assert = require("node:assert/strict");
const { validateLegalPublication } = require("../legal-publication-policy");

test("produkcja wymaga operatora, dowodów dostawców i kompletnego audytu", () => {
  const result = validateLegalPublication({
    legalDocument: { operator: { name: "[IMIĘ I NAZWISKO OPERATORA]", email: "[E-MAIL KONTAKTOWY]" } },
    providers: {},
    patternAudit: { complete: false, pending_review: 1 },
    deploymentEnvironment: "production",
  });
  assert.equal(result.ready, false);
  assert.ok(result.errors.length >= 3);
});
