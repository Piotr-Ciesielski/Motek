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

  async function loadPaginatedItems(fetchPage, { items = [], offset = 0 } = {}) {
    const loadedItems = [...items];
    const knownIds = new Set(loadedItems.map((item) => String(item.id)));
    let nextOffset = offset;
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
      nextOffset += page.items.length;
      hasMore = Boolean(page.hasMore) && page.items.length > 0;
    }

    return {
      items: loadedItems,
      nextOffset,
      complete: true,
      error: null,
    };
  }

  return {
    findNewlySavedYarn,
    getExistingYarnState,
    isDeleteConfirmed,
    loadPaginatedItems,
    shouldRetryRead,
    yarnsHaveSameValues,
  };
});
