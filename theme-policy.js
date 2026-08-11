(function exposeThemePolicy(globalObject) {
  const THEMES = Object.freeze({
    LIGHT: "light",
    DARK: "dark",
  });
  const DEFAULT_THEME = THEMES.LIGHT;
  const THEME_STORAGE_KEY = "motek-theme-v1";

  function normalizeTheme(value) {
    return value === THEMES.DARK ? THEMES.DARK : DEFAULT_THEME;
  }

  function resolveStorage(storage) {
    if (storage) {
      return storage;
    }

    if (typeof window !== "undefined") {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    }

    return null;
  }

  function readStoredTheme(storage) {
    const resolvedStorage = resolveStorage(storage);

    if (!resolvedStorage) {
      return DEFAULT_THEME;
    }

    try {
      return normalizeTheme(resolvedStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return DEFAULT_THEME;
    }
  }

  function saveTheme(theme, storage) {
    const normalizedTheme = normalizeTheme(theme);
    const resolvedStorage = resolveStorage(storage);

    if (resolvedStorage) {
      try {
        resolvedStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
      } catch {
        // Storage może być wyłączony albo niedostępny w trybie prywatnym.
      }
    }

    return normalizedTheme;
  }

  function getNextTheme(theme) {
    return normalizeTheme(theme) === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
  }

  function getThemeToggleState(theme) {
    const normalizedTheme = normalizeTheme(theme);
    const isDark = normalizedTheme === THEMES.DARK;

    return {
      nextTheme: isDark ? THEMES.LIGHT : THEMES.DARK,
      label: isDark ? "Włącz tryb jasny" : "Włącz tryb ciemny",
      shortLabel: isDark ? "Jasny" : "Ciemny",
      pressed: isDark,
    };
  }

  function applyTheme(theme, documentLike) {
    const normalizedTheme = normalizeTheme(theme);
    const resolvedDocument = documentLike || (typeof document !== "undefined" ? document : null);

    if (resolvedDocument?.documentElement) {
      resolvedDocument.documentElement.dataset.theme = normalizedTheme;
      resolvedDocument.documentElement.style.colorScheme = normalizedTheme;
    }

    return normalizedTheme;
  }

  function bindThemeToggle(documentLike) {
    const toggle = documentLike?.querySelector?.("#themeToggle");
    if (!toggle || toggle.dataset.motekThemeBound === "true") return;

    let currentTheme = readStoredTheme();

    function updateToggle(theme) {
      currentTheme = applyTheme(theme, documentLike);
      const state = getThemeToggleState(currentTheme);
      toggle.setAttribute("aria-label", state.label);
      toggle.setAttribute("aria-pressed", String(state.pressed));
    }

    toggle.dataset.motekThemeBound = "true";
    updateToggle(currentTheme);
    toggle.addEventListener("click", () => {
      updateToggle(saveTheme(getNextTheme(currentTheme)));
    });
  }

  const api = {
    DEFAULT_THEME,
    THEMES,
    THEME_STORAGE_KEY,
    normalizeTheme,
    readStoredTheme,
    saveTheme,
    getNextTheme,
    getThemeToggleState,
    applyTheme,
    bindThemeToggle,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (globalObject) {
    globalObject.MotekThemePolicy = api;
    applyTheme(readStoredTheme());
    const bindLegalToggle = () => {
      if (globalObject.document?.querySelector("#legalDocument")) {
        bindThemeToggle(globalObject.document);
      }
    };
    if (globalObject.document?.readyState === "loading") {
      globalObject.document.addEventListener("DOMContentLoaded", bindLegalToggle, { once: true });
    } else {
      bindLegalToggle();
    }
  }
})(typeof window !== "undefined" ? window : null);
