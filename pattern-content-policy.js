const PUBLICATION_STATUSES = new Set(["published", "hidden"]);
const TECHNIQUES = new Set(["knitting", "crochet"]);
const ALLOWED_BASES = new Set(["neutral_fact", "independent_summary", "synthetic"]);
const FORBIDDEN_KEYS = new Set(["evidence", "excerpt", "instruction", "pdf_text"]);

function fail(message) {
  throw new TypeError(message);
}

function containsForbidden(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    FORBIDDEN_KEYS.has(key) || containsForbidden(child)
  );
}

function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function containsInstructionalText(value) {
  if (typeof value === "string") return /instrukcja\s+wykonania/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsInstructionalText);
}

function toPublicationFields(entry) {
  return {
    publication_status: entry.status,
    content_audit_version: entry.audit_version,
    content_audited_at: entry.audited_at,
    official_source_url: entry.official_source_url ?? null,
  };
}

function validatePatternAuditManifest(records, manifest) {
  if (!Array.isArray(records) || !manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("Nieprawidłowe dane audytu");
  manifest = cloneDeep(manifest);
  if (typeof manifest.audit_version !== "string" || !/^\d+\.\d+$/.test(manifest.audit_version)) fail("Nieprawidłowy audit_version");
  if (!Array.isArray(manifest.records)) fail("Manifest musi zawierać records");
  if (containsForbidden(manifest)) fail("Manifest zawiera niedozwolone pola dowodowe");

  const inputNames = new Set();
  records.forEach((record) => {
    if (!record || typeof record.source_filename !== "string") fail("Brak source_filename rekordu");
    if (inputNames.has(record.source_filename)) fail(`Duplikat source_filename ${record.source_filename}`);
    inputNames.add(record.source_filename);
  });
  const manifestNames = new Set();
  manifest.records.forEach((entry) => {
    if (entry && manifestNames.has(entry.source_filename)) fail(`duplikat source_filename ${entry.source_filename}`);
    if (entry) manifestNames.add(entry.source_filename);
  });
  if (manifest.records.length !== records.length) {
    const missing = records.find((record) => !manifest.records.some((entry) => entry.source_filename === record.source_filename));
    fail(`${missing?.source_filename ?? records[0]?.source_filename ?? "rekord"} brak decyzji audytowej`);
  }

  const seen = new Set();
  const validated = manifest.records.map((entry) => {
    if (!entry || typeof entry.source_filename !== "string" || !inputNames.has(entry.source_filename)) fail(`nieznany rekord ${entry?.source_filename ?? ""}`);
    if (seen.has(entry.source_filename)) fail(`duplikat source_filename ${entry.source_filename}`);
    seen.add(entry.source_filename);
    if (!PUBLICATION_STATUSES.has(entry.status)) fail(`Nieprawidłowy status dla ${entry.source_filename}`);
    if (typeof entry.source_kind !== "string" || !entry.source_kind) fail("Brak source_kind");
    if (containsInstructionalText(entry)) fail("rekord zawiera tekst instrukcja wykonania");
    if (typeof entry.audited_at !== "string" || !entry.audited_at || Number.isNaN(Date.parse(entry.audited_at))) fail("Brak lub nieprawidłowe audited_at");
    if (entry.official_source_url !== null && entry.official_source_url !== undefined && typeof entry.official_source_url !== "string") fail("Nieprawidłowe źródło");
    if (!Array.isArray(entry.fields)) fail("fields musi być tablicą");
    if (entry.status === "published" && entry.source_kind !== "synthetic") {
      if (!entry.official_source_url?.trim()) fail("Publikacja wymaga poprawnego źródła");
      try {
        if (new URL(entry.official_source_url).protocol !== "https:") fail("Publikacja wymaga źródła https");
      } catch { fail("Publikacja wymaga źródła https"); }
    }
    if (entry.status === "published" && entry.source_kind === "synthetic" && entry.fields.length === 0) fail("Publikacja wymaga podstawy pola");
    const fields = entry.fields.map((field) => {
      if (!field || typeof field.name !== "string" || !field.name) fail("Brak nazwy pola");
      if (!ALLOWED_BASES.has(field.basis)) fail(`Brak podstawy pola ${field.name}`);
      if (field.decision !== (entry.status === "published" ? "publish" : "hide")) fail(`Decyzja pola nie odpowiada statusowi ${entry.source_filename}`);
      if (typeof field.source_reference !== "string" || !field.source_reference.trim()) fail(`Brak źródła pola ${field.name}`);
      if (containsInstructionalText(field)) fail("pole zawiera tekst instrukcja wykonania");
      if (entry.status === "published" && entry.source_kind === "synthetic" && (field.basis !== "synthetic" || field.source_reference !== "synthetic")) fail("Publikacja syntetyczna wymaga podstawy pola");
      return { ...field };
    });
    if (entry.technique !== null && entry.technique !== undefined && !TECHNIQUES.has(entry.technique)) {
      fail(`Nieprawidłowa technika dla ${entry.source_filename}`);
    }
    if (entry.status === "published" && !TECHNIQUES.has(entry.technique)) {
      fail(`Publikacja wymaga techniki: ${entry.source_filename}`);
    }
    return { ...entry, audit_version: manifest.audit_version, official_source_url: entry.official_source_url ?? null, technique: entry.technique ?? null, fields };
  });
  if (seen.size !== inputNames.size) fail("Brak decyzji audytowej dla rekordu");
  return freezeDeep({ audit_version: manifest.audit_version, records: validated });
}

module.exports = { validatePatternAuditManifest, toPublicationFields };
