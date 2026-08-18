const test = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../data/legal-data-providers.json");

test("manifest dostawców odzwierciedla zweryfikowane środowiska", () => {
  assert.equal(manifest.status, "verified");
  assert.equal(manifest.providers.supabase.plan, "Free");
  assert.equal(manifest.providers.supabase.location, "eu-north-1 (produkcja i staging)");
  assert.equal(manifest.providers.supabase.scope, "production-and-staging");
  assert.equal(manifest.providers.supabase.status, "verified");
  assert.equal(manifest.providers.supabase.verifiedAt, "2026-08-16");
  assert.equal(manifest.providers.railway.scope, "production-and-staging");
  assert.equal(manifest.providers.railway.status, "verified");
  assert.equal(manifest.providers.railway.verifiedAt, "2026-08-16");
  assert.equal(manifest.providers.cloudflare.status, "verified");
  assert.equal(manifest.providers.cloudflare.verifiedAt, "2026-08-16");
  assert.equal(manifest.providers.cloudflare.scope, "production-and-staging");
  assert.deepEqual(manifest.providers.cloudflare.services, ["edge", "turnstile"]);
  assert.equal(manifest.providers.cloudflare.serviceEvidence.edge.scope, "production");
  assert.equal(manifest.providers.cloudflare.serviceEvidence.turnstile.scope, "production-and-staging");
  assert.equal(manifest.providers.cloudflare.serviceEvidence.edge.verifiedAt, "2026-08-16");
  assert.equal(manifest.providers.cloudflare.serviceEvidence.turnstile.verifiedAt, "2026-08-16");
});

test("każda podstawa weryfikacji jest samodzielna i nie zależy od historii operacyjnej", () => {
  const verificationBasis = [];

  function collectVerificationBasis(value, objectPath = "manifest") {
    if (!value || typeof value !== "object") {
      return;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      const nestedPath = `${objectPath}.${key}`;

      if (key === "verificationBasis") {
        assert.equal(
          Array.isArray(nestedValue),
          true,
          `${nestedPath} musi być tablicą`,
        );
        nestedValue.forEach((basis, index) => {
          assert.equal(
            typeof basis,
            "string",
            `${nestedPath}[${index}] musi być tekstem`,
          );
          verificationBasis.push({ basis, path: `${nestedPath}[${index}]` });
        });
        continue;
      }

      collectVerificationBasis(nestedValue, nestedPath);
    }
  }

  collectVerificationBasis(manifest);
  assert.notEqual(verificationBasis.length, 0);

  const historicalPath =
    /docs[\\/](?:operations|superpowers)[\\/]|Designs[\\/]|AUDYT_|CHANGELOG\.txt|docs[\\/](?:PATTERN-CATALOG|UX-UI-ROADMAP)\.md/iu;
  const operationalNarrative =
    /(?:dokumentacj\p{L}*|raport\p{L}*)\s+operacyjn\p{L}*/iu;

  verificationBasis.forEach(({ basis, path }) => {
    assert.equal(
      historicalPath.test(basis),
      false,
      `${path} zależy od historycznej ścieżki`,
    );
    assert.equal(
      operationalNarrative.test(basis),
      false,
      `${path} zależy od opisowej historii operacyjnej`,
    );
  });
});
