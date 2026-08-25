(function exposeCatalogController(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.createCatalogController = api.createCatalogController;
  if (root) root.createCatalogFilterDisclosure = api.createCatalogFilterDisclosure;
})(typeof window !== "undefined" ? window : globalThis, () => {
"use strict";

/**
 * Small state controller for catalog screens.
 *
 * The controller deliberately knows nothing about the DOM.  Consumers provide
 * a `load` function and may observe state changes with `onStateChange`.
 */
function createCatalogController(options) {
  const config = options || {};
  const defaults = Object.assign({}, config.defaultFilters || config.initialFilters || {});
  const state = {
    items: [],
    filters: Object.assign({}, defaults),
    page: 0,
    hasMore: true,
    total: 0,
    loading: false,
    error: null,
  };

  const getState = () => Object.assign({}, state, {
    items: state.items.slice(),
    filters: Object.assign({}, state.filters)
  });

  const emit = () => {
    const snapshot = getState();
    if (typeof config.onStateChange === 'function') config.onStateChange(snapshot);
    return snapshot;
  };

  let latestRequestId = 0;

  const loadPage = async (page, replace) => {
    const loader = config.load;
    const requestId = ++latestRequestId;
    state.loading = true;
    state.error = null;
    emit();
    try {
      const result = loader
        ? await loader({ page, filters: Object.assign({}, state.filters), pageSize: config.pageSize })
        : { items: [], hasMore: false };
      if (requestId !== latestRequestId) return getState();
      const payload = Array.isArray(result) ? { items: result, hasMore: false } : (result || {});
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (replace) {
        state.items = items;
      } else {
        const knownIds = new Set(
          state.items
            .filter((item) => item && item.id !== undefined && item.id !== null)
            .map((item) => String(item.id))
        );
        state.items = state.items.concat(items.filter((item) => {
          if (!item || item.id === undefined || item.id === null) return true;
          const id = String(item.id);
          if (knownIds.has(id)) return false;
          knownIds.add(id);
          return true;
        }));
      }
      state.page = page;
      state.total = Number.isFinite(Number(payload.total)) ? Number(payload.total) : state.items.length;
      state.hasMore = payload.hasMore !== undefined ? Boolean(payload.hasMore) : Boolean(payload.nextPage);
      return emit();
    } catch (error) {
      if (requestId === latestRequestId) {
        state.error = error;
        emit();
      }
      throw error;
    } finally {
      if (requestId === latestRequestId) {
        state.loading = false;
        emit();
      }
    }
  };

  return {
    refresh() {
      return loadPage(1, true);
    },
    loadMore() {
      if (state.loading || !state.hasMore) return Promise.resolve(getState());
      return loadPage(state.page + 1, false);
    },
    getState,
  };
}

function createCatalogFilterDisclosure({ toggle, panel, mobileQuery }) {
  const setOpen = (open) => {
    const nextOpen = Boolean(open);
    toggle.setAttribute("aria-expanded", String(nextOpen));
    panel.hidden = !nextOpen;
  };
  const syncViewport = () => setOpen(!mobileQuery.matches);

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !mobileQuery.matches) return;
    setOpen(false);
    toggle.focus();
  });
  mobileQuery.addEventListener?.("change", syncViewport);
  syncViewport();

  return {
    updateCount(count) {
      toggle.textContent = `Filtry (${Math.max(0, Number(count) || 0)})`;
    },
  };
}

return { createCatalogController, createCatalogFilterDisclosure };
});
