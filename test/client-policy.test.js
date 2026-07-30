const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findNewlySavedYarn,
  getExistingYarnState,
  isDeleteConfirmed,
  shouldRetryRead,
} = require("../client-policy");

const draft = {
  name: "Merino",
  color: "ecru",
  material: "wełna",
  weightClass: "dk",
  length: 200,
  weight: 100,
};

test("ponawia tylko bezpieczny odczyt po przejściowym błędzie", () => {
  assert.equal(
    shouldRetryRead({
      method: "GET",
      errorName: "TypeError",
      attempt: 1,
      maxAttempts: 2,
    }),
    true
  );
  assert.equal(
    shouldRetryRead({
      method: "GET",
      status: 503,
      attempt: 1,
      maxAttempts: 2,
    }),
    true
  );
  assert.equal(
    shouldRetryRead({
      method: "POST",
      errorName: "TypeError",
      attempt: 1,
      maxAttempts: 2,
    }),
    false
  );
  assert.equal(
    shouldRetryRead({
      method: "GET",
      errorName: "TypeError",
      externallyAborted: true,
      attempt: 1,
      maxAttempts: 2,
    }),
    false
  );
});

test("rozpoznaje nowy motek zapisany mimo utraconej odpowiedzi", () => {
  const knownIds = new Set(["1"]);
  const yarns = [
    { id: 1, ...draft },
    { id: 2, ...draft },
  ];

  assert.equal(findNewlySavedYarn(yarns, draft, knownIds)?.id, 2);
  assert.equal(findNewlySavedYarn([yarns[0]], draft, knownIds), null);
});

test("rozpoznaje wynik przerwanej modyfikacji i usunięcia", () => {
  assert.equal(getExistingYarnState([{ id: 7, ...draft }], 7, draft).state, "saved");
  assert.equal(
    getExistingYarnState([{ id: 7, ...draft, color: "granat" }], 7, draft).state,
    "different"
  );
  assert.equal(getExistingYarnState([], 7, draft).state, "missing");
  assert.equal(isDeleteConfirmed([], 7), true);
  assert.equal(isDeleteConfirmed([{ id: 7, ...draft }], 7), false);
});
