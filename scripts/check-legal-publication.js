const fs = require("node:fs");
const path = require("node:path");
const { CURRENT_LEGAL_DOCUMENT } = require("../legal-document");
const { validateLegalPublication } = require("../legal-publication-policy");

const root = path.resolve(__dirname, "..");
const providersDocument = JSON.parse(fs.readFileSync(path.join(root, "data", "legal-data-providers.json"), "utf8"));
const patternAudit = JSON.parse(fs.readFileSync(path.join(root, "data", "pattern-content-audit.json"), "utf8"));
const auditRecords = Array.isArray(patternAudit.records) ? patternAudit.records : [];
const result = validateLegalPublication({
  legalDocument: CURRENT_LEGAL_DOCUMENT,
  providers: providersDocument.providers,
  patternAudit: {
    complete: auditRecords.length > 0 && auditRecords.every((record) => record.status !== "pending_review"),
    pending_review: auditRecords.filter((record) => record.status === "pending_review").length,
  },
  deploymentEnvironment: "production",
});

if (result.ready) {
  console.log("LEGAL_PUBLICATION=ready");
  process.exit(0);
}

console.error("LEGAL_PUBLICATION=not ready");
result.errors.forEach((error) => console.error(`- ${error}`));
process.exit(1);
