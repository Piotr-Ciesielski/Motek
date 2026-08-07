(function exposeCatalogController(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.createCatalogController = api.createCatalogController;
})(typeof window !== "undefined" ? window : globalThis, () => {
"use strict";

/**
 * Small state controller for catalog screens.
 *
 * The controller deliberately knows nothing about the DOM.  Consumers provide
 * a `load` function (or an API object exposing one of the supported methods)
 * and may subscribe to state changes with `onStateChange`.
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
    selectedPattern: null
  };
  const listeners = [];

  const emit = () => {
    const snapshot = getState();
    if (typeof config.onStateChange === 'function') config.onStateChange(snapshot);
    listeners.slice().forEach((listener) => listener(snapshot));
    if (typeof config.render === 'function') config.render(snapshot);
    return snapshot;
  };

  const getState = () => Object.assign({}, state, {
    items: state.items.slice(),
    filters: Object.assign({}, state.filters)
  });

  const resolveLoader = () => {
    if (typeof config.load === 'function') return config.load;
    if (typeof config.fetchCatalog === 'function') return config.fetchCatalog;
    const api = config.api || config.client || {};
    return api.listCatalog || api.fetchCatalog || api.getCatalog || api.loadCatalog;
  };

  const loadPage = async (page, replace) => {
    const loader = resolveLoader();
    state.loading = true;
    state.error = null;
    emit();
    try {
      const result = loader
        ? await loader({ page, filters: Object.assign({}, state.filters), pageSize: config.pageSize })
        : { items: [], hasMore: false };
      const payload = Array.isArray(result) ? { items: result, hasMore: false } : (result || {});
      const items = Array.isArray(payload.items) ? payload.items : (Array.isArray(payload.data) ? payload.data : []);
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
      state.error = error;
      emit();
      throw error;
    } finally {
      state.loading = false;
      emit();
    }
  };

  const controller = {
    initialize() {
      return this.refresh();
    },
    refresh() {
      return loadPage(1, true);
    },
    loadMore() {
      if (state.loading || !state.hasMore) return Promise.resolve(getState());
      return loadPage(state.page + 1, false);
    },
    resetFilters(nextFilters) {
      state.filters = Object.assign({}, defaults, nextFilters || {});
      return this.refresh();
    },
    showPattern(patternOrId) {
      const id = patternOrId && typeof patternOrId === 'object' ? patternOrId.id : patternOrId;
      const item = typeof patternOrId === 'object'
        ? patternOrId
        : state.items.find((candidate) => candidate && (candidate.id === id || candidate.patternId === id));
      state.selectedPattern = item || null;
      if (typeof config.onShowPattern === 'function') config.onShowPattern(item || null);
      emit();
      return item || null;
    },
    getState,
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    }
  };

  return controller;
}

return { createCatalogController };
});
