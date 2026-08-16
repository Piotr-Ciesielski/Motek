const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { CURRENT_LEGAL_DOCUMENT } = require("../legal-document");
const { initializeLegalPage, renderLegalDocument } = require("../client/legal-page");

function createDocument() {
  return new JSDOM(
    '<main id="legalDocument"><nav id="legalToc"></nav><article id="legalArticle"></article></main>',
  ).window.document;
}

test("renderer tworzy spis treści i trzy sekcje bez innerHTML", () => {
  const documentRoot = createDocument();

  renderLegalDocument(documentRoot, CURRENT_LEGAL_DOCUMENT);

  assert.equal(documentRoot.querySelectorAll("#legalToc a").length, 3);
  assert.deepEqual(
    [...documentRoot.querySelectorAll(".legal-section")].map((node) => node.id),
    ["regulamin", "prywatnosc", "prawa-autorskie"],
  );
  assert.equal(documentRoot.querySelector("script"), null);
  assert.match(documentRoot.querySelector(".legal-meta").textContent, /1\.0/);
  assert.match(documentRoot.querySelector(".legal-copyright").textContent, /© 2026 Motek/);
});

test("statyczna strona prawna udostępnia odnośniki sekcji bez JavaScript", async () => {
  const html = await readFile(path.join(__dirname, "..", "informacje-prawne.html"), "utf8");

  for (const anchor of ["#regulamin", "#prywatnosc", "#prawa-autorskie"]) {
    assert.match(html, new RegExp(`href=[\"']${anchor}[\"']`));
  }
});

test("renderer pokazuje potencjalny HTML jako zwykły tekst", () => {
  const documentRoot = createDocument();
  const documentWithUnsafeText = {
    ...CURRENT_LEGAL_DOCUMENT,
    sections: CURRENT_LEGAL_DOCUMENT.sections.map((section, index) => index === 0
      ? {
        ...section,
        blocks: [{ type: "paragraph", text: '<img src=x onerror="alert(1)">' }],
      }
      : section),
  };

  renderLegalDocument(documentRoot, documentWithUnsafeText);

  assert.equal(documentRoot.querySelector("img"), null);
  assert.equal(documentRoot.querySelector(".legal-section p").textContent, '<img src=x onerror="alert(1)">');
});

test("initializeLegalPage renderuje przekazany dokument i nie korzysta ze stanu Auth", () => {
  const documentRoot = createDocument();

  initializeLegalPage({ documentRoot, legalDocument: CURRENT_LEGAL_DOCUMENT });

  assert.equal(documentRoot.querySelectorAll(".legal-section").length, 3);
});

test("publiczna strona podpina przycisk zmiany motywu", () => {
  const dom = new JSDOM(
    '<html data-theme="light"><body><button id="themeToggle" type="button"></button>' +
      '<main id="legalDocument"><nav id="legalToc"></nav><article id="legalArticle"></article></main></body></html>',
  );
  const documentRoot = dom.window.document;
  const themePolicy = {
    THEMES: { LIGHT: "light", DARK: "dark" },
    normalizeTheme: (value) => value === "dark" ? "dark" : "light",
    getNextTheme: (value) => value === "dark" ? "light" : "dark",
    getThemeToggleState: (value) => ({
      label: value === "dark" ? "Włącz tryb jasny" : "Włącz tryb ciemny",
      pressed: value === "dark",
    }),
    applyTheme: (value, targetDocument) => {
      targetDocument.documentElement.dataset.theme = value;
      return value;
    },
    saveTheme: (value) => value,
  };

  initializeLegalPage({ documentRoot, legalDocument: CURRENT_LEGAL_DOCUMENT, themePolicy });

  const toggle = documentRoot.querySelector("#themeToggle");
  assert.equal(toggle.getAttribute("aria-label"), "Włącz tryb ciemny");
  toggle.click();
  assert.equal(documentRoot.documentElement.dataset.theme, "dark");
  assert.equal(toggle.getAttribute("aria-label"), "Włącz tryb jasny");
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
});
