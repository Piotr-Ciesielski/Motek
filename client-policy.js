(function exposeMotekClientPolicy(root, factory) {
  const materialPolicy =
    typeof module === "object" && module.exports
      ? require("./material-policy")
      : root?.MotekMaterialPolicy;
  const policy = factory(materialPolicy);
  if (typeof module === "object" && module.exports) {
    module.exports = policy;
  }
  if (root) {
    root.MotekClientPolicy = policy;
  }
})(typeof globalThis === "object" ? globalThis : null, (materialPolicy) => {
  if (!materialPolicy) {
    throw new Error("Brak wspólnej polityki materiałów Motka.");
  }
  const {
    ANY_MATERIAL,
    MATERIALS,
    formatYarnMaterials,
    matchesPatternMaterialFilter,
  } = materialPolicy;
  const yarnValueFields = [
    "name",
    "color",
    "materials",
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

  function bindHoldToReveal(button, field) {
    if (!button || !field) return;

    const reveal = (event) => {
      event?.preventDefault();
      field.type = "text";
      button.setAttribute("aria-pressed", "true");
    };
    const mask = (event) => {
      event?.preventDefault();
      field.type = "password";
      button.setAttribute("aria-pressed", "false");
    };
    const isRevealKey = (event) => event.key === " " || event.key === "Enter";

    button.addEventListener("pointerdown", reveal);
    ["pointerup", "pointercancel", "pointerleave", "blur", "click"].forEach(
      (eventName) => button.addEventListener(eventName, mask),
    );
    button.addEventListener("keydown", (event) => {
      if (isRevealKey(event) && !event.repeat) reveal(event);
    });
    button.addEventListener("keyup", (event) => {
      if (isRevealKey(event)) mask(event);
    });
  }

  function initializePasswordRevealControls(documentRoot) {
    documentRoot.querySelectorAll("[data-password-reveal]").forEach((button) => {
      const input = documentRoot.getElementById(button.dataset.passwordReveal);
      if (input) bindHoldToReveal(button, input);
    });
  }

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
      || matchesPatternMaterialFilter(materials, material);

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
      if (uniqueMaterials.has(ANY_MATERIAL)) {
        MATERIALS.forEach(({ value }) => {
          materials[value] = (materials[value] || 0) + 1;
        });
        return;
      }
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

  function ensureSingleNewYarnCard(cards, createCard) {
    const existing = [...cards].find(
      (card) => card?.dataset?.saved !== "true",
    );
    return existing
      ? { card: existing, created: false }
      : { card: createCard(), created: true };
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
    return yarnValueFields.every((field) => {
      if (field !== "materials") return first?.[field] === second?.[field];
      const firstMaterials = Array.isArray(first?.materials) ? first.materials : [];
      const secondMaterials = Array.isArray(second?.materials) ? second.materials : [];
      return firstMaterials.length === secondMaterials.length
        && firstMaterials.every((material, index) => material === secondMaterials[index]);
    });
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

  function buildAuthPayload(values = {}, { captchaEnabled = false, captchaToken = null } = {}) {
    if (captchaEnabled && !String(captchaToken || "").trim()) {
      throw new Error("Potwierdź zabezpieczenie formularza.");
    }
    return {
      ...values,
      ...(captchaEnabled ? { captchaToken: String(captchaToken).trim() } : {}),
    };
  }

  function joinPolishList(items) {
    if (items.length < 2) return items[0] || "";
    return `${items.slice(0, -1).join(", ")} i ${items.at(-1)}`;
  }

  function getYarnSaveHint({
    yarn = {},
    isEditing = false,
    changed = false,
    busy = false,
  } = {}) {
    const missing = [];
    if (!String(yarn.name || "").trim()) missing.push("nazwę");
    if (!String(yarn.color || "").trim()) missing.push("kolor");
    if (!Array.isArray(yarn.materials) || yarn.materials.length === 0) {
      missing.push("materiał");
    }

    let message = "";
    if (busy) message = "Zapisywanie…";
    else if (missing.length) message = `Uzupełnij: ${joinPolishList(missing)}.`;
    else if (!changed) message = "Brak nowych zmian.";
    else message = "Dane są gotowe do zapisania.";

    return {
      visible: Boolean(isEditing),
      disabled: Boolean(busy || missing.length || !changed),
      message,
    };
  }

  async function withYarnVersionRetry({ getVersion, refreshVersion, operation } = {}) {
    const hasVersion = /^"yarn-v\d+"$/.test(String(getVersion?.() || ""));
    if (!hasVersion) await refreshVersion();

    try {
      return await operation();
    } catch (error) {
      if (error?.status !== 428) throw error;
      await refreshVersion();
      return operation();
    }
  }

  function getMatchFreshnessState({
    hasCalculatedMatches = false,
    inventoryChanged = false,
  } = {}) {
    const stale = Boolean(hasCalculatedMatches && inventoryChanged);
    return {
      stale,
      message: stale ? "Wyniki są nieaktualne po zmianie magazynu." : "",
    };
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

  function formatMatchingRequirement(
    requirement,
    allocation,
    formatNumber,
    formatSkeinCount,
  ) {
    const formatRange = (minimum, maximum, unit) => {
      if (!Number.isFinite(Number(minimum)) || Number(minimum) <= 0) return null;
      if (Number.isFinite(Number(maximum)) && Number(maximum) >= Number(minimum)) {
        return `${formatNumber(minimum)}–${formatNumber(maximum)} ${unit}`;
      }
      return `min. ${formatNumber(minimum)} ${unit}`;
    };
    const meters = formatRange(
      requirement?.metersMin,
      requirement?.metersMax,
      "m",
    );
    const grams = formatRange(
      requirement?.gramsMin,
      requirement?.gramsMax,
      "g",
    );
    const primary = requirement?.measurementBasis === "grams" ? grams : meters;
    const secondary = requirement?.measurementBasis === "grams" ? meters : grams;
    const parts = [primary];
    if (secondary) parts.push(`${secondary} pomocniczo`);
    if (Number.isFinite(Number(requirement?.skeinsMin)) && requirement.skeinsMin > 0) {
      parts.push(
        Number.isFinite(Number(requirement?.skeinsMax))
          && requirement.skeinsMax >= requirement.skeinsMin
          ? `${formatNumber(requirement.skeinsMin)}–${formatNumber(requirement.skeinsMax)} motków wg wzoru`
          : `${formatSkeinCount(requirement.skeinsMin)} wg wzoru`,
      );
    }
    parts.push(
      requirement?.materialMatch === "any_material"
        ? "dowolny materiał"
        : formatYarnMaterials(requirement?.materials),
    );
    if (Array.isArray(requirement?.weightClasses) && requirement.weightClasses.length) {
      parts.push(`grubość ${requirement.weightClasses.join(", ")}`);
    }
    if (Number.isInteger(requirement?.strandCount) && requirement.strandCount > 1) {
      parts.push(`${formatNumber(requirement.strandCount)} nitki razem`);
    }
    if (Array.isArray(allocation) && allocation.length) {
      parts.push(
        `z magazynu: ${allocation.map((yarn) =>
          `${yarn.name || "motek"}${yarn.color ? ` (${yarn.color})` : ""}`
        ).join(", ")}`,
      );
    }

    return `${requirement?.role || "wymagana włóczka"}: ${parts.filter(Boolean).join(" · ")}`;
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

  // Pobiera pojedynczą stronę, zachowując już załadowane elementy do kolejnego wywołania.
  async function loadNextPaginatedPage(
    fetchPage,
    { items = [], offset = 0, total = items.length } = {},
  ) {
    const loadedItems = [...items];
    const knownIds = new Set(loadedItems.map((item) => String(item.id)));
    try {
      const page = await fetchPage(offset);
      const pageItems = Array.isArray(page?.items) ? page.items : [];
      pageItems.forEach((item) => {
        const id = String(item.id);
        if (knownIds.has(id)) return;
        knownIds.add(id);
        loadedItems.push(item);
      });
      const nextOffset = offset + pageItems.length;
      const nextTotal = Number.isInteger(page?.total) ? page.total : total;
      const complete = !page?.hasMore && (pageItems.length > 0 || loadedItems.length >= nextTotal);
      return {
        items: loadedItems,
        nextOffset,
        total: nextTotal,
        complete,
        error: null,
      };
    } catch (error) {
      if (!loadedItems.length) throw error;
      return { items: loadedItems, nextOffset: offset, total, complete: false, error };
    }
  }

  function formatCatalogSummary({ visible = 0, matching = 0, loaded = 0, total = 0, complete = true } = {}) {
    return `Pokazano ${Number(visible).toLocaleString("pl-PL")} z ${Number(matching).toLocaleString("pl-PL")} pasujących wzorów.`
      + ` Załadowano ${Number(loaded).toLocaleString("pl-PL")} z ${Number(total).toLocaleString("pl-PL")} wzorów.`
      + (complete ? "" : " Pobieram kolejne wzory...");
  }

  return {
    bindHoldToReveal,
    initializePasswordRevealControls,
    buildAuthPayload,
    buildPatternFacetCounts,
    buildPatternFacetOptions,
    ensureSingleNewYarnCard,
    filterPatterns,
    findNewlySavedYarn,
    formatMatchingRequirement,
    formatPatternYarnFact,
    getProjectTypeFilterLabel,
    getProjectTypeLabel,
    getExistingYarnState,
    getMatchFreshnessState,
    getYarnSaveHint,
    withYarnVersionRetry,
    isDeleteConfirmed,
    loadPaginatedItems,
    loadNextPaginatedPage,
    formatCatalogSummary,
    matchesPatternFilters,
    shouldRetryRead,
    yarnsHaveSameValues,
  };
});
