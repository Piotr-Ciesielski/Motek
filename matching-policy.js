const {
  maxMatchingRoleRequirements,
  maxMatchingTextLength,
  maxMatchingVariantsPerPattern,
  maxMatchSearchNodes,
} = require("./limits");
const {
  matchesMaterialRule,
  normalizeYarnMaterials,
} = require("./material-policy");

const WEIGHT_CLASSES = new Set([
  "lace",
  "fingering",
  "sport",
  "dk",
  "worsted",
  "bulky",
]);
const MEASUREMENT_BASES = new Set(["meters", "grams"]);
const MATERIAL_MATCHES = new Set(["all", "any", "any_material"]);
const COLOR_MODES = new Set(["same", "any"]);
const MAX_MEASUREMENT = 1_000_000;

function fail(context, message) {
  throw new TypeError(`${context}: ${message}`);
}

function requireObject(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(context, "wymagany jest obiekt.");
  }
}

function requireText(value, field, context, { optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return null;
  if (
    typeof value !== "string"
    || value.trim().length === 0
    || value.trim().length > maxMatchingTextLength
  ) {
    fail(context, `${field} musi być niepustym tekstem do ${maxMatchingTextLength} znaków.`);
  }
  return value.trim();
}

function requirePositiveInteger(value, field, context, { optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return null;
  if (!Number.isInteger(value) || value <= 0 || value > MAX_MEASUREMENT) {
    fail(context, `${field} musi być dodatnią liczbą całkowitą.`);
  }
  return value;
}

function normalizeRange(value, prefix, context) {
  const minimum = requirePositiveInteger(
    value[`${prefix}_min`],
    `${prefix}_min`,
    context,
    { optional: true },
  );
  const maximum = requirePositiveInteger(
    value[`${prefix}_max`],
    `${prefix}_max`,
    context,
    { optional: true },
  );
  if (maximum !== null && minimum === null) {
    fail(context, `${prefix}_max wymaga pola ${prefix}_min.`);
  }
  if (maximum !== null && maximum < minimum) {
    fail(context, `${prefix}_max nie może być mniejsze niż ${prefix}_min.`);
  }
  return { minimum, maximum };
}

function normalizeWeightClasses(value, context) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(context, "weight_classes musi zawierać co najmniej jedną grubość.");
  }
  const normalized = [...new Set(value.map((item) =>
    typeof item === "string" ? item.trim().toLowerCase() : ""
  ))];
  if (normalized.some((item) => !WEIGHT_CLASSES.has(item))) {
    fail(context, "weight_classes zawiera nieznaną grubość.");
  }
  return normalized;
}

function normalizeMaterials(value, materialMatch, context) {
  if (materialMatch === "any_material") {
    if (!Array.isArray(value) || value.length !== 0) {
      fail(context, "tryb any_material wymaga pustej tablicy materials.");
    }
    return [];
  }
  try {
    return normalizeYarnMaterials(value);
  } catch (error) {
    fail(context, `nieprawidłowy materiał: ${error.message}`);
  }
}

function normalizeRequirement(value, context) {
  requireObject(value, context);
  const role = requireText(value.role, "role", context);
  const measurementBasis = value.measurement_basis;
  if (!MEASUREMENT_BASES.has(measurementBasis)) {
    fail(context, "measurement_basis musi mieć wartość meters albo grams.");
  }

  const meters = normalizeRange(value, "meters", context);
  const grams = normalizeRange(value, "grams", context);
  const skeins = normalizeRange(value, "skeins", context);
  if (measurementBasis === "meters" && meters.minimum === null) {
    fail(context, "measurement_basis meters wymaga pola meters_min.");
  }
  if (measurementBasis === "grams" && grams.minimum === null) {
    fail(context, "measurement_basis grams wymaga pola grams_min.");
  }

  const materialMatch = value.material_match;
  if (!MATERIAL_MATCHES.has(materialMatch)) {
    fail(context, "material_match ma nieobsługiwaną wartość.");
  }
  const colorMode = value.color_mode;
  if (!COLOR_MODES.has(colorMode)) {
    fail(context, "color_mode musi mieć wartość same albo any.");
  }

  return {
    role,
    measurementBasis,
    metersMin: meters.minimum,
    metersMax: meters.maximum,
    gramsMin: grams.minimum,
    gramsMax: grams.maximum,
    skeinsMin: skeins.minimum,
    skeinsMax: skeins.maximum,
    materials: normalizeMaterials(value.materials, materialMatch, context),
    materialMatch,
    colorMode,
    weightClasses: normalizeWeightClasses(value.weight_classes, context),
    strandCount: requirePositiveInteger(
      value.strand_count,
      "strand_count",
      context,
      { optional: true },
    ),
    heldTogetherGroup: rejectUnsupportedGroup(value.held_together_group, "held_together_group", context),
    distinctColorGroup: requireText(
      value.distinct_color_group,
      "distinct_color_group",
      context,
      { optional: true },
    ),
  };
}

function rejectUnsupportedGroup(value, field, context) {
  if (value !== undefined && value !== null && value !== "") {
    fail(context, `${field} nie jest obsługiwane.`);
  }
  return undefined;
}

function normalizeMatchingDocument(value, context = "matching_requirements") {
  requireObject(value, context);
  if (value.version !== 2) {
    fail(context, "obsługiwana jest wyłącznie wersja 2.");
  }
  if (
    !Array.isArray(value.variants)
    || value.variants.length > maxMatchingVariantsPerPattern
  ) {
    fail(
      context,
      `variants musi być tablicą do ${maxMatchingVariantsPerPattern} elementów.`,
    );
  }

  const ids = new Set();
  return value.variants.map((variant, variantIndex) => {
    const variantContext = `${context}, wariant ${variantIndex + 1}`;
    requireObject(variant, variantContext);
    const id = requireText(variant.id, "id", variantContext);
    if (ids.has(id)) {
      fail(variantContext, `powtórzony identyfikator wariantu „${id}”.`);
    }
    ids.add(id);
    const label = requireText(variant.label, "label", variantContext);
    if (
      !Array.isArray(variant.requirements)
      || variant.requirements.length < 1
      || variant.requirements.length > maxMatchingRoleRequirements
    ) {
      fail(
        variantContext,
        `requirements musi zawierać od 1 do ${maxMatchingRoleRequirements} ról.`,
      );
    }

    return {
      id,
      label,
      size: requireText(variant.size, "size", variantContext, { optional: true }),
      yarnOption: requireText(
        variant.yarn_option,
        "yarn_option",
        variantContext,
        { optional: true },
      ),
      requirements: variant.requirements.map((requirement, requirementIndex) =>
        normalizeRequirement(
          requirement,
          `${variantContext}, rola ${requirementIndex + 1}`,
        )
      ),
    };
  });
}

function validateMatchingDocument(value, context) {
  normalizeMatchingDocument(value, context);
}

function colorKey(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("pl")
    : "";
}

function requirementQuantity(requirement, yarn) {
  return requirement.measurementBasis === "meters"
    ? Number(yarn.length) || 0
    : Number(yarn.weight) || 0;
}

function requirementMinimum(requirement) {
  return requirement.measurementBasis === "meters"
    ? requirement.metersMin
    : requirement.gramsMin;
}

function allocateVariantRequirements(
  requirements,
  yarns,
  { maxSearchNodes = maxMatchSearchNodes } = {},
) {
  const sourceRequirements = Array.isArray(requirements) ? requirements : [];
  const sourceYarns = Array.isArray(yarns) ? yarns : [];
  let searchNodes = 0;

  const tick = () => {
    searchNodes += 1;
    if (searchNodes > maxSearchNodes) {
      throw new RangeError("Dopasowanie przekroczyło bezpieczny limit wyszukiwania.");
    }
  };

  function buildCandidateGroups(requirement, used) {
    const minimum = requirementMinimum(requirement);
    // Każdy wpis magazynu reprezentuje jeden fizyczny motek. Dzierganie
    // z kilku nitek wymaga więc co najmniej tylu motków, ile nitek.
    const minimumSkeins = Math.max(
      Number(requirement.skeinsMin) || 0,
      Number(requirement.strandCount) || 0,
    );
    const maximumSkeins = Number(requirement.skeinsMax) || Infinity;
    const eligible = sourceYarns
      .map((yarn, index) => ({
        yarn,
        index,
        quantity: requirementQuantity(requirement, yarn),
        color: colorKey(yarn.color),
      }))
      .filter(({ yarn, index, quantity }) =>
        !used.has(index)
        && quantity > 0
        && requirement.weightClasses.includes(yarn.weightClass)
        && matchesMaterialRule(yarn.materials, {
          materialMatch: requirement.materialMatch,
          materials: requirement.materials,
        })
      );

    const pools = new Map();
    eligible.forEach((candidate) => {
      const key = requirement.colorMode === "same" ? candidate.color : "*";
      if (!pools.has(key)) pools.set(key, []);
      pools.get(key).push(candidate);
    });

    const groups = [];
    for (const pool of pools.values()) {
      pool.sort((left, right) =>
        right.quantity - left.quantity || left.index - right.index
      );
      const remaining = new Array(pool.length + 1).fill(0);
      for (let index = pool.length - 1; index >= 0; index -= 1) {
        remaining[index] = remaining[index + 1] + pool[index].quantity;
      }

      function choose(start, selected, total) {
        tick();
        if (
          total >= minimum
          && selected.length >= minimumSkeins
          && selected.length <= maximumSkeins
        ) {
          groups.push({
            candidates: [...selected],
            total,
            colors: new Set(selected.map(({ color }) => color)),
          });
          return;
        }
        if (selected.length >= maximumSkeins) return;
        if (start >= pool.length || total + remaining[start] < minimum) return;

        for (
          let index = start;
          index < pool.length && selected.length < maximumSkeins;
          index += 1
        ) {
          choose(
            index + 1,
            [...selected, pool[index]],
            total + pool[index].quantity,
          );
        }
      }

      choose(0, [], 0);
    }

    return groups.sort((left, right) =>
      left.candidates.length - right.candidates.length
      || left.total - right.total
    );
  }

  function chooseRequirement(index, used, allocation, distinctColors) {
    tick();
    if (index === sourceRequirements.length) return allocation;
    const requirement = sourceRequirements[index];
    const candidates = buildCandidateGroups(requirement, used);

    for (const group of candidates) {
      const groupName = requirement.distinctColorGroup;
      const previousColors = groupName
        ? distinctColors.get(groupName) || new Set()
        : new Set();
      if ([...group.colors].some((color) => previousColors.has(color))) continue;

      const nextUsed = new Set(used);
      group.candidates.forEach(({ index: yarnIndex }) => nextUsed.add(yarnIndex));
      const nextColors = new Map(distinctColors);
      if (groupName) {
        nextColors.set(groupName, new Set([...previousColors, ...group.colors]));
      }
      const result = chooseRequirement(
        index + 1,
        nextUsed,
        [...allocation, group.candidates.map(({ yarn }) => yarn)],
        nextColors,
      );
      if (result) return result;
    }
    return null;
  }

  return chooseRequirement(0, new Set(), [], new Map());
}

function matchVariant(variant, yarns, options) {
  const allocation = allocateVariantRequirements(
    variant?.requirements,
    yarns,
    options,
  );
  return {
    doable: allocation !== null,
    allocation: allocation || [],
    coverage: allocation ? 100 : 0,
  };
}

module.exports = {
  allocateVariantRequirements,
  matchVariant,
  normalizeMatchingDocument,
  validateMatchingDocument,
};
