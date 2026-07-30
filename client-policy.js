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
    findNewlySavedYarn,
    formatPatternYarnFact,
    getExistingYarnState,
    isDeleteConfirmed,
    loadPaginatedItems,
    shouldRetryRead,
    yarnsHaveSameValues,
  };
});
