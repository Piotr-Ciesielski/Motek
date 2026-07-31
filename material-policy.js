(function exposeMotekMaterialPolicy(root, factory) {
  const policy = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = policy;
  }
  if (root) {
    root.MotekMaterialPolicy = policy;
  }
})(typeof globalThis === "object" ? globalThis : null, () => {
  const MATERIALS = Object.freeze([
    { value: "wełna", label: "Wełna" },
    { value: "alpaka", label: "Alpaka" },
    { value: "moher", label: "Moher" },
    { value: "kaszmir", label: "Kaszmir" },
    { value: "angora", label: "Angora" },
    { value: "jak", label: "Jak" },
    { value: "bawełna", label: "Bawełna" },
    { value: "len", label: "Len" },
    { value: "bambus", label: "Bambus" },
    { value: "wiskoza", label: "Wiskoza" },
    { value: "jedwab", label: "Jedwab" },
    { value: "poliamid", label: "Poliamid" },
    { value: "poliester", label: "Poliester" },
    { value: "akryl", label: "Akryl" },
    { value: "mieszanka", label: "Mieszanka — skład nieokreślony" },
  ].map(Object.freeze));
  const MATERIAL_VALUES = new Set(MATERIALS.map(({ value }) => value));
  const MATERIAL_ORDER = new Map(
    MATERIALS.map(({ value }, index) => [value, index]),
  );
  const MATERIAL_LABELS = new Map(
    MATERIALS.map(({ value, label }) => [value, label]),
  );
  const ANY_MATERIAL = "dowolny materiał";

  function canonicalizeMaterial(value) {
    return typeof value === "string"
      ? value.trim().toLocaleLowerCase("pl")
      : "";
  }

  function isAllowedYarnMaterial(value) {
    return MATERIAL_VALUES.has(canonicalizeMaterial(value));
  }

  function normalizeYarnMaterials(value) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new TypeError("Wybierz co najmniej jeden materiał.");
    }

    const normalized = value.map(canonicalizeMaterial);
    const invalid = normalized.find((material) => !MATERIAL_VALUES.has(material));
    if (invalid !== undefined) {
      throw new TypeError(`Niedozwolony materiał: ${invalid || "(pusty)"}.`);
    }

    const unique = [...new Set(normalized)];
    if (unique.includes("mieszanka") && unique.length > 1) {
      throw new TypeError(
        "Mieszanka — skład nieokreślony nie może być łączona z konkretnymi materiałami.",
      );
    }

    return unique.sort(
      (left, right) => MATERIAL_ORDER.get(left) - MATERIAL_ORDER.get(right),
    );
  }

  function formatYarnMaterials(value) {
    if (!Array.isArray(value) || value.length === 0) {
      return "Wybierz co najmniej jeden materiał";
    }
    return value
      .map(canonicalizeMaterial)
      .map((material) => MATERIAL_LABELS.get(material) || material)
      .join(", ");
  }

  function matchesMaterialRule(yarnMaterials, rule = {}) {
    const yarnSet = new Set(
      (Array.isArray(yarnMaterials) ? yarnMaterials : [])
        .map(canonicalizeMaterial)
        .filter((material) => MATERIAL_VALUES.has(material)),
    );
    const mode = rule.material_match || rule.materialMatch || "all";
    const required = (Array.isArray(rule.materials) ? rule.materials : [])
      .map(canonicalizeMaterial)
      .filter(Boolean);

    if (mode === "any_material") return yarnSet.size > 0;
    if (mode === "any") {
      return required.some((material) => yarnSet.has(material));
    }
    if (mode === "all") {
      return required.length > 0
        && required.every((material) => yarnSet.has(material));
    }
    return false;
  }

  function matchesPatternMaterialFilter(patternMaterials, selectedMaterial) {
    const selected = canonicalizeMaterial(selectedMaterial);
    if (!selected || selected === "all") return true;

    const materials = (Array.isArray(patternMaterials) ? patternMaterials : [])
      .map(canonicalizeMaterial)
      .filter(Boolean);
    return materials.includes(ANY_MATERIAL) || materials.includes(selected);
  }

  return {
    ANY_MATERIAL,
    MATERIALS,
    formatYarnMaterials,
    isAllowedYarnMaterial,
    matchesMaterialRule,
    matchesPatternMaterialFilter,
    normalizeYarnMaterials,
  };
});
