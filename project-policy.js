const PROJECT_STATUSES = Object.freeze(["active", "completed", "frogged"]);
const PROGRESS_UNITS = Object.freeze(["row", "round"]);
const MAX_VARIANT_ID_LENGTH = 100;
const MAX_PROGRESS_NOTE_LENGTH = 500;
const MAX_GAUGE_LENGTH = 120;
// Zakres kolumny PostgreSQL integer dla progress_count.
const MAX_PROGRESS_COUNT = 2147483647;
const MIN_TOOL_SIZE_MM = 0.5;
const MAX_TOOL_SIZE_MM = 50;

function formatProjectVersion(version) {
  return `"project-v${version}"`;
}

function parseProjectVersion(value) {
  const match = /^"project-v(\d+)"$/.exec(String(value || ""));
  return match ? Number(match[1]) : null;
}

function validateProjectStartPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Treść żądania musi być obiektem JSON.");
  }
  const keys = Object.keys(body).sort();
  if (keys.length !== 2 || keys[0] !== "patternId" || keys[1] !== "variantId") {
    throw new Error("Projekt można rozpocząć wyłącznie przez podanie patternId i variantId.");
  }
  if (!Number.isInteger(body.patternId) || body.patternId < 1) {
    throw new Error("Pole patternId musi być dodatnią liczbą całkowitą.");
  }
  if (
    typeof body.variantId !== "string"
    || !body.variantId.trim()
    || body.variantId.length > MAX_VARIANT_ID_LENGTH
  ) {
    throw new Error(`Pole variantId musi być niepustym tekstem do ${MAX_VARIANT_ID_LENGTH} znaków.`);
  }
  return { patternId: body.patternId, variantId: body.variantId };
}

const PROGRESS_KEYS = ["gauge", "note", "progressCount", "progressUnit", "toolSizeMm"];

function normalizeProgressText(value, maxLength, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`Pole ${field} musi być tekstem do ${maxLength} znaków.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`Pole ${field} musi być tekstem do ${maxLength} znaków.`);
  }
  return trimmed === "" ? null : trimmed;
}

function normalizeToolSizeMm(value) {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < MIN_TOOL_SIZE_MM
    || value > MAX_TOOL_SIZE_MM
    || Math.round(value * 10) / 10 !== value
  ) {
    throw new Error(
      `Pole toolSizeMm musi być liczbą od ${MIN_TOOL_SIZE_MM} do ${MAX_TOOL_SIZE_MM} z dokładnością do jednego miejsca po przecinku.`,
    );
  }
  return value;
}

function validateProjectProgressPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Treść żądania musi być obiektem JSON.");
  }
  const keys = Object.keys(body).sort();
  if (
    keys.length !== PROGRESS_KEYS.length
    || keys.some((key, index) => key !== PROGRESS_KEYS[index])
  ) {
    throw new Error(
      "Zapis postępu przyjmuje wyłącznie pola progressUnit, progressCount, note, toolSizeMm i gauge.",
    );
  }
  if (!PROGRESS_UNITS.includes(body.progressUnit)) {
    throw new Error("Pole progressUnit musi mieć wartość row albo round.");
  }
  if (
    !Number.isInteger(body.progressCount)
    || body.progressCount < 0
    || body.progressCount > MAX_PROGRESS_COUNT
  ) {
    throw new Error(
      `Pole progressCount musi być liczbą całkowitą od zera do ${MAX_PROGRESS_COUNT}.`,
    );
  }
  return {
    progressUnit: body.progressUnit,
    progressCount: body.progressCount,
    note: normalizeProgressText(body.note, MAX_PROGRESS_NOTE_LENGTH, "note"),
    toolSizeMm: normalizeToolSizeMm(body.toolSizeMm),
    gauge: normalizeProgressText(body.gauge, MAX_GAUGE_LENGTH, "gauge"),
  };
}

module.exports = {
  PROJECT_STATUSES,
  PROGRESS_UNITS,
  MAX_VARIANT_ID_LENGTH,
  MAX_PROGRESS_NOTE_LENGTH,
  MAX_GAUGE_LENGTH,
  formatProjectVersion,
  parseProjectVersion,
  validateProjectStartPayload,
  validateProjectProgressPayload,
};
