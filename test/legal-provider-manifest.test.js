const test = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../data/legal-data-providers.json");
const { validateLegalPublication } = require("../legal-publication-policy");

test("aktualny manifest dostawców spełnia część bramki dotyczącą dostawców", () => {
  assert.equal(manifest.status, "verified");

  const result = validateLegalPublication({
    legalDocument: { operator: { name: "Operator Motka", email: "operator@example.com" } },
    providers: manifest.providers,
    patternAudit: { complete: true, pending_review: 0 },
    deploymentEnvironment: "production",
  });

  assert.deepEqual(result, { ready: true, errors: [] });
});

test("manifest zachowuje zweryfikowane zakresy środowisk i usług", () => {
  assert.equal(manifest.providers.supabase.plan, "Free");
  assert.equal(manifest.providers.supabase.location, "eu-north-1 (Stockholm; produkcja i staging)");
  assert.equal(manifest.providers.supabase.scope, "production-and-staging");
  assert.equal(manifest.providers.railway.plan, "Hobby");
  assert.equal(manifest.providers.railway.scope, "production-and-staging");
  assert.match(manifest.providers.railway.verificationBasis.join(" "), /DPA.*2026-08-20/);

  for (const provider of Object.values(manifest.providers)) {
    assert.equal(provider.status, "verified");
    assert.equal(provider.verifiedAt, "2026-08-20");
  }

  assert.deepEqual(manifest.providers.cloudflare.services, ["edge", "turnstile"]);
  assert.equal(manifest.providers.cloudflare.serviceEvidence.edge.scope, "production");
  assert.equal(manifest.providers.cloudflare.serviceEvidence.turnstile.scope, "production-and-staging");
  assert.match(manifest.providers.cloudflare.serviceEvidence.edge.evidenceScope, /staging.*Railway/i);
  assert.match(manifest.providers.cloudflare.serviceEvidence.turnstile.evidenceScope, /testow/i);
  assert.equal(manifest.providers.cloudflare.serviceEvidence.edge.verifiedAt, "2026-08-20");
  assert.equal(manifest.providers.cloudflare.serviceEvidence.turnstile.verifiedAt, "2026-08-20");
});
