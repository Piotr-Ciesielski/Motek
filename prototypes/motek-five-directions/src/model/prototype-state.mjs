import { DEMO_PATTERNS, DEMO_YARNS } from "./demo-data.mjs";

const emptyDialog = { open: false, yarnId: null };

export function createInitialState(variantId) {
  return {
    variantId,
    screen: "inventory",
    inventory: structuredClone(DEMO_YARNS),
    patterns: structuredClone(DEMO_PATTERNS),
    search: "",
    filters: { type: "", thickness: "" },
    dialog: emptyDialog,
    selectedPatternId: null,
  };
}

export function validateYarnDraft(draft) {
  const errors = {};
  if (!draft.name?.trim()) errors.name = "Podaj nazwę włóczki";
  if (!draft.color?.trim()) errors.color = "Podaj kolor";
  if (!draft.material?.trim()) errors.material = "Wybierz skład";
  if (!draft.thickness?.trim()) errors.thickness = "Wybierz grubość";
  if (!(Number(draft.weight) > 0)) errors.weight = "Podaj wagę większą od 0";
  if (!(Number(draft.length) > 0)) errors.length = "Podaj długość większą od 0";
  return errors;
}

export function selectFilteredPatterns(state) {
  const query = state.search.trim().toLocaleLowerCase("pl");
  return state.patterns.filter((pattern) => {
    const matchesQuery =
      !query ||
      pattern.name.toLocaleLowerCase("pl").includes(query) ||
      pattern.designer.toLocaleLowerCase("pl").includes(query);
    const matchesType = !state.filters.type || pattern.type === state.filters.type;
    const matchesThickness =
      !state.filters.thickness || pattern.thickness === state.filters.thickness;
    return matchesQuery && matchesType && matchesThickness;
  });
}

export function prototypeReducer(state, action) {
  switch (action.type) {
    case "NAVIGATE":
      return { ...state, screen: action.screen };
    case "OPEN_YARN_DIALOG":
      return {
        ...state,
        dialog: { open: true, yarnId: action.yarnId ?? null },
      };
    case "CLOSE_YARN_DIALOG":
      return { ...state, dialog: emptyDialog };
    case "SAVE_YARN": {
      const draft = {
        ...action.draft,
        weight: Number(action.draft.weight),
        length: Number(action.draft.length),
      };
      const inventory = draft.id
        ? state.inventory.map((yarn) => (yarn.id === draft.id ? draft : yarn))
        : [
            ...state.inventory,
            {
              ...draft,
              id: globalThis.crypto?.randomUUID?.() ?? `yarn-${Date.now()}`,
              hex: draft.hex || "#8A6B7B",
            },
          ];
      return { ...state, inventory, dialog: emptyDialog };
    }
    case "SET_SEARCH":
      return { ...state, search: action.value };
    case "SET_FILTER":
      return {
        ...state,
        filters: { ...state.filters, [action.name]: action.value },
      };
    case "RESET_FILTERS":
      return {
        ...state,
        search: "",
        filters: { type: "", thickness: "" },
      };
    case "OPEN_PATTERN":
      return {
        ...state,
        screen: "catalog",
        selectedPatternId: action.patternId,
      };
    default:
      return state;
  }
}
