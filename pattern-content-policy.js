const limits = require("./limits");
const { normalizeYarnMaterials } = require("./material-policy");

const PUBLICATION_STATUSES = new Set(["published", "hidden"]);
const TECHNIQUES = new Set(["knitting", "crochet"]);
const PROJECT_TYPES = new Set([
  "socks",
  "sweater",
  "cardigan",
  "top",
  "shawl_scarf",
  "head_accessory",
  "gloves",
  "vest",
  "skirt_dress",
  "blanket",
  "other",
]);
const SOURCE_LANGUAGES = new Set(["pl", "en", "mixed", "unknown"]);
const WEIGHT_CLASSES = new Set(["lace", "fingering", "sport", "dk", "worsted", "bulky"]);
const MEASUREMENT_BASES = new Set(["meters", "grams"]);
const MATERIAL_MATCHES = new Set(["all", "any", "any_material"]);
const COLOR_MODES = new Set(["same", "any"]);
const MAX_MEASUREMENT = 1_000_000;
const DEFAULT_VARIANT_LABEL = "Podstawowy";
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

function requireManualText(value, field, { min = 1, max } = {}) {
  if (typeof value !== "string" || value.trim().length < min) {
    fail(`Pole ${field} jest wymagane.`);
  }
  const normalized = value.trim();
  if (max && normalized.length > max) {
    fail(`Pole ${field} może mieć najwyżej ${max} znaków.`);
  }
  return normalized;
}

function requireManualInteger(value, field) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_MEASUREMENT) {
    fail(`Pole ${field} musi być liczbą całkowitą od 1 do ${MAX_MEASUREMENT}.`);
  }
  return value;
}

function normalizeManualRequirement(value, index) {
  const context = `Rola ${index + 1}`;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${context} ma nieprawidłowe dane.`);
  }
  const role = requireManualText(value.role, `${context}: nazwa roli`, { max: limits.maxMatchingTextLength });
  const measurementBasis = value.measurementBasis;
  if (!MEASUREMENT_BASES.has(measurementBasis)) {
    fail(`${context}: jednostka musi być „metry” albo „gramy”.`);
  }
  const quantityMin = requireManualInteger(value.quantityMin, `${context}: ilość minimalna`);
  const quantityMax = value.quantityMax === undefined || value.quantityMax === null
    ? null
    : requireManualInteger(value.quantityMax, `${context}: ilość maksymalna`);
  if (quantityMax !== null && quantityMax < quantityMin) {
    fail(`${context}: ilość maksymalna nie może być mniejsza od minimalnej.`);
  }
  const materialMatch = value.materialMatch;
  if (!MATERIAL_MATCHES.has(materialMatch)) {
    fail(`${context}: tryb materiału ma niedozwoloną wartość.`);
  }
  let materials;
  if (materialMatch === "any_material") {
    if (Array.isArray(value.materials) && value.materials.length > 0) {
      fail(`${context}: tryb „dowolny materiał” nie przyjmuje listy materiałów.`);
    }
    materials = [];
  } else {
    try {
      materials = normalizeYarnMaterials(value.materials);
    } catch (error) {
      fail(`${context}: ${error.message}`);
    }
  }
  const colorMode = value.colorMode;
  if (!COLOR_MODES.has(colorMode)) {
    fail(`${context}: tryb koloru musi być „ten sam” albo „dowolny”.`);
  }
  const weightClasses = [...new Set(
    (Array.isArray(value.weightClasses) ? value.weightClasses : [])
      .map((weightClass) => (typeof weightClass === "string" ? weightClass.trim().toLowerCase() : "")),
  )];
  if (
    weightClasses.length === 0
    || weightClasses.some((weightClass) => !WEIGHT_CLASSES.has(weightClass))
  ) {
    fail(`${context}: wybierz co najmniej jedną obsługiwaną grubość włóczki.`);
  }

  const requirement = {
    role,
    measurement_basis: measurementBasis,
    materials,
    material_match: materialMatch,
    color_mode: colorMode,
    weight_classes: weightClasses,
  };
  requirement[`${measurementBasis}_min`] = quantityMin;
  if (quantityMax !== null) requirement[`${measurementBasis}_max`] = quantityMax;
  return requirement;
}

function buildManualPatternDraft(input, { newId } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("Nieprawidłowe dane formularza wzoru.");
  }
  const name = requireManualText(input.name, "nazwa", { max: 200 });
  const description = input.description === undefined || input.description === null || input.description === ""
    ? null
    : requireManualText(input.description, "opis", { max: 1000 });
  if (description && containsInstructionalText(description)) {
    fail("Opis nie może zawierać instrukcji wykonania.");
  }
  if (!PROJECT_TYPES.has(input.projectType)) {
    fail("Wybierz typ projektu.");
  }
  if (!TECHNIQUES.has(input.technique)) {
    fail("Wybierz technikę: szydełko albo druty.");
  }
  let materials;
  try {
    materials = normalizeYarnMaterials(input.materials);
  } catch (error) {
    fail(`Materiały wzoru: ${error.message}`);
  }
  const metersPer100g = input.metersPer100g === undefined || input.metersPer100g === null || input.metersPer100g === ""
    ? null
    : requireManualInteger(Number(input.metersPer100g), "metraż na 100 g");
  if (
    input.sourceUrl !== undefined && input.sourceUrl !== null && input.sourceUrl !== ""
  ) {
    let sourceUrl;
    try {
      sourceUrl = new URL(String(input.sourceUrl).trim());
    } catch {
      fail("Link do źródła jest nieprawidłowy.");
    }
    if (sourceUrl.protocol !== "https:") fail("Link do źródła musi używać HTTPS.");
  }
  const sourceLanguage = input.sourceLanguage === undefined || input.sourceLanguage === null || input.sourceLanguage === ""
    ? "unknown"
    : input.sourceLanguage;
  if (!SOURCE_LANGUAGES.has(sourceLanguage)) {
    fail("Język źródła ma niedozwoloną wartość.");
  }
  const variantLabel = input.variantLabel === undefined || input.variantLabel === null || input.variantLabel === ""
    ? DEFAULT_VARIANT_LABEL
    : requireManualText(input.variantLabel, "etykieta wariantu", { max: limits.maxMatchingTextLength });
  if (
    !Array.isArray(input.requirements)
    || input.requirements.length < 1
    || input.requirements.length > limits.maxMatchingRoleRequirements
  ) {
    fail(`Wariant musi zawierać od 1 do ${limits.maxMatchingRoleRequirements} ról zapotrzebowania.`);
  }
  const requirements = input.requirements.map(normalizeManualRequirement);

  return {
    name,
    description,
    project_type: input.projectType,
    technique: input.technique,
    materials,
    meters_per_100g: metersPer100g,
    yarn_requirements: requirements.map((requirement) => ({
      role: requirement.role,
      materials: requirement.materials,
      meters_per_100g: metersPer100g,
    })),
    matching_requirements: {
      version: 2,
      variants: [{ id: "reczne-zgloszenie", label: variantLabel, requirements }],
    },
    source_filename: `manual:${typeof newId === "function" ? newId() : randomManualId()}`,
    source_language: sourceLanguage,
    needs_review: true,
    publication_status: "pending_review",
    content_audit_version: null,
    content_audited_at: null,
    official_source_url: input.sourceUrl ? String(input.sourceUrl).trim() : null,
  };
}

function randomManualId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

module.exports = { validatePatternAuditManifest, toPublicationFields, buildManualPatternDraft };
