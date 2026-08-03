const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  scorePattern,
  selectMatchingYarns,
} = require("../server/matching-service");

const yarns = [
  { id: 1, materials: ["wełna"], weightClass: "dk", length: 300, weight: 60 },
  { id: 2, materials: ["wełna"], weightClass: "dk", length: 250, weight: 50 },
  { id: 3, materials: ["bawełna"], weightClass: "fingering", length: 400, weight: 100 },
];

test("scorePattern obsługuje wymagania ról i zwraca wynik wykonalny", () => {
  const result = scorePattern(
    {
      requirements: [{
        yarnsNeeded: 1,
        metersNeeded: 500,
        gramsNeeded: 100,
        materials: ["wełna"],
        weightClasses: ["dk"],
      }],
    },
    yarns,
  );

  assert.deepEqual(result, {
    total: 100,
    doable: true,
    totalLength: 550,
    totalWeight: 110,
    matchedYarns: 2,
  });
});

test("scorePattern zachowuje tryb legacy bez wymagań ról", () => {
  const result = scorePattern(
    {
      yarnsNeeded: 1,
      metersNeeded: 500,
      gramsNeeded: 100,
      materials: ["wełna"],
      weightClasses: ["dk"],
      colors: "dowolny",
    },
    yarns,
  );

  assert.equal(result.doable, true);
  assert.equal(result.matchedYarns, 2);
});

test("selectMatchingYarns zwraca wszystkie kwalifikujące się motki", () => {
  const result = selectMatchingYarns(
    {
      requirements: [{
        yarnsNeeded: 1,
        metersNeeded: 100,
        gramsNeeded: 20,
        materials: ["wełna"],
        weightClasses: ["dk"],
      }],
    },
    yarns,
  );

  assert.deepEqual(result, { yarns: [yarns[0], yarns[1]], limited: false });
});

test("algorytm respektuje limit węzłów wyszukiwania", () => {
  const tooComplex = {
    requirements: Array.from({ length: 8 }, () => ({
      yarnsNeeded: 100,
      metersNeeded: 1,
      gramsNeeded: 1,
      materials: ["wełna"],
      weightClasses: ["dk"],
    })),
  };
  const manyYarns = Array.from({ length: 500 }, (_, id) => ({
    id,
    materials: ["wełna"],
    weightClass: "dk",
    length: 10,
    weight: 10,
  }));

  assert.throws(
    () => scorePattern(tooComplex, manyYarns),
    /Dopasowanie jest zbyt złożone/,
  );
});
