import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialState,
  prototypeReducer,
  selectFilteredPatterns,
  validateYarnDraft,
} from "../src/model/prototype-state.mjs";

test("starts with eight yarns and twelve catalog patterns", () => {
  const state = createInitialState("atelier");
  assert.equal(state.inventory.length, 8);
  assert.equal(state.patterns.length, 12);
});

test("adds and edits yarn without mutating the prior state", () => {
  const initial = createInitialState("nordic");
  const added = prototypeReducer(initial, {
    type: "SAVE_YARN",
    draft: {
      name: "Malabrigo Rios",
      brand: "Malabrigo",
      color: "Azules",
      material: "merino",
      thickness: "worsted",
      weight: 100,
      length: 192,
    },
  });

  assert.equal(added.inventory.length, 9);
  assert.equal(initial.inventory.length, 8);

  const edited = prototypeReducer(added, {
    type: "SAVE_YARN",
    draft: { ...added.inventory[0], color: "Leśny mech" },
  });

  assert.equal(edited.inventory[0].color, "Leśny mech");
  assert.notEqual(initial.inventory[0].color, "Leśny mech");
  assert.deepEqual(edited.dialog, { open: false, yarnId: null });
});

test("searches patterns and exposes a resettable empty filter state", () => {
  let state = createInitialState("forest");
  state = prototypeReducer(state, {
    type: "SET_SEARCH",
    value: "cardigan",
  });
  assert.equal(selectFilteredPatterns(state).length, 2);

  state = prototypeReducer(state, {
    type: "SET_FILTER",
    name: "type",
    value: "skarpetki",
  });
  state = prototypeReducer(state, {
    type: "SET_FILTER",
    name: "thickness",
    value: "bulky",
  });
  assert.deepEqual(selectFilteredPatterns(state), []);

  state = prototypeReducer(state, { type: "RESET_FILTERS" });
  assert.equal(selectFilteredPatterns(state).length, 12);
  assert.equal(state.search, "");
  assert.deepEqual(state.filters, { type: "", thickness: "" });
});

test("opens a selected recommendation in the catalog", () => {
  const initial = createInitialState("night");
  const next = prototypeReducer(initial, {
    type: "OPEN_PATTERN",
    patternId: "forest-cardigan",
  });
  assert.equal(next.screen, "catalog");
  assert.equal(next.selectedPatternId, "forest-cardigan");
});

test("reports exact missing yarn fields", () => {
  assert.deepEqual(validateYarnDraft({ name: "", weight: 0, length: 0 }), {
    name: "Podaj nazwę włóczki",
    color: "Podaj kolor",
    material: "Wybierz skład",
    thickness: "Wybierz grubość",
    weight: "Podaj wagę większą od 0",
    length: "Podaj długość większą od 0",
  });
});
