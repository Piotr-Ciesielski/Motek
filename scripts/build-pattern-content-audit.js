const fs = require("node:fs");
const path = require("node:path");
const { validatePatternAuditManifest } = require("../pattern-content-policy");

const root = path.join(__dirname, "..");
const inputPath = path.join(root, "data", "patterns-import.json");
const outputPath = path.join(root, "data", "pattern-content-audit.json");
const replace = process.argv.includes("--replace");

if (fs.existsSync(outputPath) && !replace) {
  throw new Error("Manifest już istnieje; użyj --replace, aby go nadpisać");
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const auditVersion = "1.0";
const auditedAt = "2026-08-09T00:00:00Z";
const manifest = {
  audit_version: auditVersion,
  records: input.records.map((record) => ({
    source_filename: record.source_filename,
    status: "hidden",
    source_kind: record.synthetic_demo ? "synthetic" : "pdf",
    audited_at: auditedAt,
    official_source_url: null,
    fields: [],
  })),
};

validatePatternAuditManifest(input.records, manifest);
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Zbudowano manifest audytu: ${manifest.records.length} rekordów`);
