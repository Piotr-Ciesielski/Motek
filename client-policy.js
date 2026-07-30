(function exposeMotekClientPolicy(root, factory) {
  const policy = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = policy;
  }
  if (root) {
    root.MotekClientPolicy = policy;
  }
})(typeof globalThis === "object" ? globalThis : null, () => {
  const yarnValueFields = [
    "name",
    "color",
    "material",
    "weightClass",
    "length",
    "weight",
  ];

  const projectTypeLabels = {
    socks: { card: "Skarpety", filter: "Skarpety" },
    sweater: { card: "Sweter", filter: "Swetry" },
    cardigan: { card: "Kardigan", filter: "Kardigany" },
    top: { card: "Top lub bluzka", filter: "Topy i bluzki" },
    shawl_scarf: { card: "Chusta lub szal", filter: "Chusty i szale" },
    head_accessory: {
      card: "Czapka, opaska lub komin",
      filter: "Czapki, opaski i kominy",
    },
    gloves: { card: "Rękawiczki", filter: "Rękawiczki" },
    vest: { card: "Kamizelka", filter: "Kamizelki" },
    skirt_dress: {
      card: "Spódnica lub sukienka",
      filter: "Spódnice i sukienki",
    },
    blanket: { card: "Koc", filter: "Koce" },
    other: { card: "Inny projekt", filter: "Inne" },
  };

  function getProjectTypeLabel(value) {
    return (projectTypeLabels[value] || projectTypeLabels.other).card;
  }

  function getProjectTypeFilterLabel(value) {
    return (projectTypeLabels[value] || projectTypeLabels.other).filter;
  }

  function matchesPatternFilters(pattern, filters = {}, ignoredFacet = null) {
    const phrase = String(filters.phrase || "")
      .trim()
      .toLocaleLowerCase("pl");
    const review = filters.review || "all";
    const language = filters.language || "all";
    const type = filters.type || "all";
    const material = filters.material || "all";
    const materials = Array.isArray(pattern?.materials) ? pattern.materials : [];
    const searchable = [
      pattern?.name,
      pattern?.description,
      getProjectTypeLabel(pattern?.projectType),
      getProjectTypeFilterLabel(pattern?.projectType),
      ...materials,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("pl");

    const matchesPhrase = !phrase || searchable.includes(phrase);
    const matchesStatus =
      review === "all"
      || (review === "review" && pattern?.needsReview)
      || (review === "verified" && !pattern?.needsReview);
    const matchesLanguage =
      language === "all" || pattern?.sourceLanguage === language;
    const matchesType =
      ignoredFacet === "type"
      || type === "all"
      || (pattern?.projectType || "other") === type;
    const matchesMaterial =
      ignoredFacet === "material"
      || material === "all"
      || materials.includes(material);

    return (
      matchesPhrase
      && matchesStatus
      && matchesLanguage
      && matchesType
      && matchesMaterial
    );
  }

  function filterPatterns(patterns, filters = {}, ignoredFacet = null) {
    return (Array.isArray(patterns) ? patterns : []).filter((pattern) =>
      matchesPatternFilters(pattern, filters, ignoredFacet)
    );
  }

  function buildPatternFacetCounts(patterns, filters = {}) {
    const types = {};
    const materials = {};

    filterPatterns(patterns, filters, "type").forEach((pattern) => {
      const type = pattern?.projectType || "other";
      types[type] = (types[type] || 0) + 1;
    });

    filterPatterns(patterns, filters, "material").forEach((pattern) => {
      const uniqueMaterials = new Set(
        (Array.isArray(pattern?.materials) ? pattern.materials : [])
          .filter(Boolean)
      );
      uniqueMaterials.forEach((material) => {
        materials[material] = (materials[material] || 0) + 1;
      });
    });

    return { types, materials };
  }

  function buildPatternFacetOptions(values, counts, selectedValue) {
    return values.map((value) => {
      const count = counts[value] || 0;
      return {
        value,
        count,
        disabled: count === 0 && value !== selectedValue,
      };
    });
  }

  function shouldRetryRead({
    method,
    status = null,
    errorName = "",
    externallyAborted = false,
    attempt,
    maxAttempts,
  }) {
    if (!["GET", "HEAD"].includes(String(method).toUpperCase())) return false;
    if (externallyAborted || attempt >= maxAttempts) return false;
    if (errorName === "TypeError") return true;
    return [502, 503, 504].includes(status);
  }

  function yarnsHaveSameValues(first, second) {
    return yarnValueFields.every((field) => first?.[field] === second?.[field]);
  }

  function findNewlySavedYarn(yarns, draft, knownYarnIds) {
    return yarns.find(
      (yarn) =>
        !knownYarnIds.has(String(yarn.id))
        && yarnsHaveSameValues(yarn, draft)
    ) || null;
  }

  function getExistingYarnState(yarns, yarnId, draft) {
    const yarn = yarns.find((item) => item.id === yarnId);
    if (!yarn) return { state: "missing", yarn: null };
    return {
      state: yarnsHaveSameValues(yarn, draft) ? "saved" : "different",
      yarn,
    };
  }

  function isDeleteConfirmed(yarns, yarnId) {
    return !yarns.some((yarn) => yarn.id === yarnId);
  }

  function formatPatternYarnFact(pattern, formatRatio) {
    const requirements = Array.isArray(pattern?.yarnRequirements)
      ? pattern.yarnRequirements
      : [];
    const ratio = Number(pattern?.metersPer100g);

    if (Number.isFinite(ratio) && ratio > 0) {
      return `Główna włóczka: ${formatRatio(ratio)}`;
    }
    if (requirements.some((requirement) => requirement?.flexible === true)) {
      return "Włóczka: dobierana elastycznie według szczegółów wzoru";
    }
    if (requirements.length > 1) {
      return `Włóczka: ${requirements.length} warianty opisane w szczegółach`;
    }
    return `Główna włóczka: ${formatRatio(null)}`;
  }

  async function loadPaginatedItems(
    fetchPage,
    { items = [], offset = 0, total = items.length, onPage = null } = {},
  ) {
    const loadedItems = [...items];
    const knownIds = new Set(loadedItems.map((item) => String(item.id)));
    let nextOffset = offset;
    let knownTotal = total;
    let hasMore = true;

    while (hasMore) {
      let page;
      try {
        page = await fetchPage(nextOffset);
      } catch (error) {
        if (!loadedItems.length) throw error;
        return {
          items: loadedItems,
          nextOffset,
          total: knownTotal,
          complete: false,
          error,
        };
      }

      page.items.forEach((item) => {
        const id = String(item.id);
        if (knownIds.has(id)) return;
        knownIds.add(id);
        loadedItems.push(item);
      });
      if (Number.isInteger(page.total) && page.total >= loadedItems.length) {
        knownTotal = page.total;
      }
      nextOffset += page.items.length;
      hasMore = Boolean(page.hasMore) && page.items.length > 0;
      if (typeof onPage === "function") {
        await onPage({
          items: [...loadedItems],
          nextOffset,
          total: knownTotal,
          complete: !hasMore,
        });
      }
    }

    return {
      items: loadedItems,
      nextOffset,
      total: knownTotal,
      complete: true,
      error: null,
    };
  }

  return {
    buildPatternFacetCounts,
    buildPatternFacetOptions,
    filterPatterns,
    findNewlySavedYarn,
    formatPatternYarnFact,
    getProjectTypeFilterLabel,
    getProjectTypeLabel,
    getExistingYarnState,
    isDeleteConfirmed,
    loadPaginatedItems,
    matchesPatternFilters,
    shouldRetryRead,
    yarnsHaveSameValues,
  };
});
