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
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (globalObject) {
    globalObject.MotekThemePolicy = api;
    applyTheme(readStoredTheme());
  }
})(typeof window !== "undefined" ? window : null);
