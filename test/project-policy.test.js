const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROJECT_STATUSES,
  PROGRESS_UNITS,
  MAX_PROGRESS_NOTE_LENGTH,
  MAX_GAUGE_LENGTH,
  formatProjectVersion,
  parseProjectVersion,
  validateProjectStartPayload,
  validateProjectProgressPayload,
} = require("../project-policy");

test("wersja projektu ma dokładny format ETag i odrzuca obce wartości", () => {
  assert.equal(formatProjectVersion(1), '"project-v1"');
  assert.equal(parseProjectVersion('"project-v12"'), 12);
  assert.equal(parseProjectVersion("project-v1"), null);
  assert.equal(parseProjectVersion('"yarn-v1"'), null);
  assert.equal(parseProjectVersion(""), null);
  assert.equal(parseProjectVersion(undefined), null);
});

test("payload startu akceptuje wyłącznie patternId i variantId", () => {
  assert.deepEqual(
    validateProjectStartPayload({ patternId: 21, variantId: "m" }),
    { patternId: 21, variantId: "m" },
  );
});

test("payload startu odrzuca brakujące, dodatkowe i błędne pola", () => {
  assert.throws(() => validateProjectStartPayload({ patternId: 21 }), /patternId/i);
  assert.throws(
    () => validateProjectStartPayload({ patternId: 21, variantId: "m", extra: true }),
    /wyłącznie/i,
  );
  assert.throws(() => validateProjectStartPayload(null), /obiektem JSON/);
  assert.throws(() => validateProjectStartPayload([21, "m"]), /obiektem JSON/);
  assert.throws(() => validateProjectStartPayload({ patternId: "21", variantId: "m" }), /patternId/i);
  assert.throws(() => validateProjectStartPayload({ patternId: 0, variantId: "m" }), /patternId/i);
  assert.throws(() => validateProjectStartPayload({ patternId: 1.5, variantId: "m" }), /patternId/i);
  assert.throws(() => validateProjectStartPayload({ patternId: 21, variantId: "" }), /variantId/i);
  assert.throws(() => validateProjectStartPayload({ patternId: 21, variantId: "   " }), /variantId/i);
  assert.throws(
    () => validateProjectStartPayload({ patternId: 21, variantId: "x".repeat(101) }),
    /variantId/i,
  );
});

test("statusy projektu pozostają zamkniętym zbiorem etapów", () => {
  assert.deepEqual([...PROJECT_STATUSES], ["active", "completed", "frogged"]);
});

test("zapis postępu przyjmuje pełny payload i normalizuje wartości", () => {
  assert.deepEqual(
    validateProjectProgressPayload({
      progressUnit: "row",
      progressCount: 12,
      note: "  Świetnie idzie.  ",
      toolSizeMm: 3.5,
      gauge: " 12 śl./10 cm ",
    }),
    {
      progressUnit: "row",
      progressCount: 12,
      note: "Świetnie idzie.",
      toolSizeMm: 3.5,
      gauge: "12 śl./10 cm",
    },
  );
  assert.deepEqual(
    validateProjectProgressPayload({
      progressUnit: "round",
      progressCount: 0,
      note: "",
      toolSizeMm: null,
      gauge: "",
    }),
    { progressUnit: "round", progressCount: 0, note: null, toolSizeMm: null, gauge: null },
  );
});

test("zapis postępu odrzuca obcy kształt żądania", () => {
  const valid = { progressUnit: "row", progressCount: 0, note: "", toolSizeMm: null, gauge: "" };
  assert.throws(() => validateProjectProgressPayload(null), /obiektem JSON/);
  assert.throws(() => validateProjectProgressPayload([valid]), /obiektem JSON/);
  const { note: _note, ...withoutNote } = valid;
  assert.throws(() => validateProjectProgressPayload(withoutNote), /wyłącznie/i);
  assert.throws(
    () => validateProjectProgressPayload({ ...valid, extra: true }),
    /wyłącznie/i,
  );
});

test("jednostka postępu jest zamkniętym zbiorem rzędów i okrążeń", () => {
  assert.deepEqual([...PROGRESS_UNITS], ["row", "round"]);
  const valid = { progressUnit: "row", progressCount: 0, note: "", toolSizeMm: null, gauge: "" };
  assert.throws(
    () => validateProjectProgressPayload({ ...valid, progressUnit: "weave" }),
    /progressUnit/i,
  );
  assert.throws(
    () => validateProjectProgressPayload({ ...valid, progressUnit: "" }),
    /progressUnit/i,
  );
});

test("licznik postępu jest całkowity, nieujemny i mieści się w kolumnie integer", () => {
  const valid = { progressUnit: "row", progressCount: 0, note: "", toolSizeMm: null, gauge: "" };
  for (const bad of [-1, -7, 1.5, "3", null, 2147483648, Number.MAX_SAFE_INTEGER]) {
    assert.throws(
      () => validateProjectProgressPayload({ ...valid, progressCount: bad }),
      /progressCount/i,
    );
  }
  assert.equal(validateProjectProgressPayload({ ...valid, progressCount: 0 }).progressCount, 0);
  assert.equal(
    validateProjectProgressPayload({ ...valid, progressCount: 2147483647 }).progressCount,
    2147483647,
  );
});

test("notatka i próbka mają twarde limity długości tekstu", () => {
  assert.equal(MAX_PROGRESS_NOTE_LENGTH, 500);
  assert.equal(MAX_GAUGE_LENGTH, 120);
  const base = { progressUnit: "row", progressCount: 0, toolSizeMm: null, gauge: "" };
  assert.throws(
    () => validateProjectProgressPayload({ ...base, note: "a".repeat(501) }),
    /note/i,
  );
  assert.throws(() => validateProjectProgressPayload({ ...base, note: 42 }), /note/i);
  assert.equal(
    validateProjectProgressPayload({ ...base, note: "a".repeat(500) }).note,
    "a".repeat(500),
  );
  const withGauge = { progressUnit: "row", progressCount: 0, note: "", toolSizeMm: null };
  assert.throws(
    () => validateProjectProgressPayload({ ...withGauge, gauge: "b".repeat(121) }),
    /gauge/i,
  );
  assert.throws(() => validateProjectProgressPayload({ ...withGauge, gauge: [] }), /gauge/i);
  assert.equal(
    validateProjectProgressPayload({ ...withGauge, gauge: "b".repeat(120) }).gauge,
    "b".repeat(120),
  );
});

test("rozmiar narzędzia mieści się w granicach od 0,5 do 50 mm i jednego miejsca po przecinku", () => {
  const base = { progressUnit: "row", progressCount: 0, note: "", gauge: "" };
  for (const bad of [0.4, 50.1, -3, "3.5", Number.NaN, Infinity, 3.55, 33.333]) {
    assert.throws(
      () => validateProjectProgressPayload({ ...base, toolSizeMm: bad }),
      /toolSizeMm/i,
    );
  }
  assert.equal(validateProjectProgressPayload({ ...base, toolSizeMm: 0.5 }).toolSizeMm, 0.5);
  assert.equal(validateProjectProgressPayload({ ...base, toolSizeMm: 50 }).toolSizeMm, 50);
  assert.equal(validateProjectProgressPayload({ ...base, toolSizeMm: 8.2 }).toolSizeMm, 8.2);
  assert.equal(validateProjectProgressPayload({ ...base, toolSizeMm: null }).toolSizeMm, null);
});
