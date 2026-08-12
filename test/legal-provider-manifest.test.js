const test = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../data/legal-data-providers.json");

test("manifest dostawców rozróżnia potwierdzone środowiska produkcyjne", () => {
  assert.equal(manifest.status, "draft");
  assert.equal(manifest.providers.supabase.plan, "Free");
  assert.equal(manifest.providers.supabase.location, "eu-north-1 (produkcja i staging)");
  assert.equal(manifest.providers.supabase.scope, "production-and-staging");
  assert.equal(manifest.providers.supabase.evidenceScope, "do potwierdzenia dla produkcji");
  assert.equal(manifest.providers.railway.scope, "production-and-staging");
  assert.equal(manifest.providers.railway.location, "sfo (region wdrożenia produkcji i staging; lokalizacja przetwarzania logów do potwierdzenia)");
  assert.equal(manifest.providers.railway.evidenceScope, "do potwierdzenia dla produkcji");
  assert.equal(manifest.providers.supabase.status, "unverified");
  assert.equal(manifest.providers.railway.status, "unverified");
  assert.equal(manifest.providers.cloudflare.status, "unverified");
  assert.equal(manifest.providers.cloudflare.scope, "production-and-staging");
  assert.deepEqual(manifest.providers.cloudflare.services, ["edge", "turnstile"]);
  assert.equal(manifest.providers.cloudflare.evidenceScope, "do potwierdzenia osobno dla edge i turnstile");
  assert.equal(manifest.providers.cloudflare.serviceEvidence.edge.scope, "production");
  assert.equal(manifest.providers.cloudflare.serviceEvidence.turnstile.scope, "production-and-staging");
  assert.equal(manifest.providers.cloudflare.serviceEvidence.edge.verifiedAt, null);
  assert.equal(manifest.providers.cloudflare.serviceEvidence.turnstile.verifiedAt, null);
});
