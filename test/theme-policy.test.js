const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  normalizeTheme,
  readStoredTheme,
  saveTheme,
  getNextTheme,
  getThemeToggleState,
  applyTheme,
} = require("../theme-policy");

test("motyw domyślny jest jasny, a nieznana wartość wraca do jasnego", () => {
  assert.equal(DEFAULT_THEME, "light");
  assert.equal(normalizeTheme("unknown"), "light");
  assert.equal(normalizeTheme(null), "light");
});

test("odczytuje i zapisuje wyłącznie poprawne motywy pod wersjonowanym kluczem", () => {
  const values = new Map([[THEME_STORAGE_KEY, "dark"]]);
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  assert.equal(readStoredTheme(storage), "dark");
  assert.equal(saveTheme("light", storage), "light");
  assert.equal(values.get(THEME_STORAGE_KEY), "light");
});

test("przełącza jasny i ciemny motyw oraz buduje stan kontrolki", () => {
  assert.equal(getNextTheme("light"), "dark");
  assert.equal(getNextTheme("dark"), "light");
  assert.deepEqual(getThemeToggleState("light"), {
    nextTheme: "dark",
    label: "Włącz tryb ciemny",
    shortLabel: "Ciemny",
    pressed: false,
  });
  assert.deepEqual(getThemeToggleState("dark"), {
    nextTheme: "light",
    label: "Włącz tryb jasny",
    shortLabel: "Jasny",
    pressed: true,
  });
});

test("bezpiecznie obsługuje niedostępny localStorage", () => {
  const brokenStorage = {
    getItem() {
      throw new Error("storage unavailable");
    },
    setItem() {
      throw new Error("storage unavailable");
    },
  };

  assert.equal(readStoredTheme(brokenStorage), "light");
  assert.equal(saveTheme("dark", brokenStorage), "dark");
});

test("applyTheme ustawia data-theme i color-scheme na dokumencie", () => {
  const documentLike = { documentElement: { dataset: {}, style: {} } };

  assert.equal(applyTheme("dark", documentLike), "dark");
  assert.equal(documentLike.documentElement.dataset.theme, "dark");
  assert.equal(documentLike.documentElement.style.colorScheme, "dark");
});
