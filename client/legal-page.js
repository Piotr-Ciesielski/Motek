(function exposeMotekLegalPage(root, factory) {
  let legalApi = root?.MotekLegalDocument || {};
  if (typeof module === "object" && module.exports) {
    legalApi = require("../legal-document");
  }

  const api = factory(legalApi, root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MotekLegalPage = api;
    if (root.document?.querySelector("#legalDocument")) {
      api.initializeLegalPage();
    }
  }
})(typeof globalThis === "object" ? globalThis : null, (legalApi, root) => {
  function createTextElement(documentRoot, tagName, className, text) {
    const element = documentRoot.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function renderBlock(documentRoot, block) {
    if (block.type === "paragraph") {
      return createTextElement(documentRoot, "p", "legal-paragraph", block.text);
    }

    if (block.type === "notice") {
      return createTextElement(documentRoot, "p", "legal-notice", block.text);
    }

    if (block.type === "list") {
      const list = documentRoot.createElement("ul");
      list.className = "legal-list";
      for (const item of block.items) {
        list.append(createTextElement(documentRoot, "li", "legal-list__item", item));
      }
      return list;
    }

    throw new TypeError("Dokument zawiera nieznany typ bloku.");
  }

  function renderLegalDocument(documentRoot, legalDocument) {
    if (!documentRoot?.createElement || !legalDocument?.sections) {
      throw new TypeError("Brak dokumentu albo głównego dokumentu DOM.");
    }

    const toc = documentRoot.querySelector("#legalToc");
    const article = documentRoot.querySelector("#legalArticle");
    if (!toc || !article) throw new Error("Strona prawna nie ma wymaganych kontenerów.");

    toc.replaceChildren();
    article.replaceChildren();
    article.append(createTextElement(documentRoot, "h1", "legal-title", "Informacje prawne Motka"));

    const meta = documentRoot.createElement("div");
    meta.className = "legal-meta";
    meta.append(
      createTextElement(
        documentRoot,
        "p",
        "legal-meta__version",
        `Regulamin: ${legalDocument.termsVersion} · Prywatność: ${legalDocument.privacyVersion}`,
      ),
      createTextElement(
        documentRoot,
        "p",
        "legal-meta__date",
        `Obowiązuje od: ${legalDocument.effectiveDate} · Rewizja: ${legalDocument.revisionDate}`,
      ),
    );
    article.append(meta);

    for (const sectionData of legalDocument.sections) {
      const link = documentRoot.createElement("a");
      link.href = `#${sectionData.id}`;
      link.textContent = sectionData.title;
      toc.append(link);

      const section = documentRoot.createElement("section");
      section.id = sectionData.id;
      section.className = "legal-section";
      section.append(createTextElement(documentRoot, "h2", "legal-section__title", sectionData.title));
      for (const block of sectionData.blocks) {
        section.append(renderBlock(documentRoot, block));
      }
      article.append(section);
    }

    const formatCopyrightNotice = legalApi.formatCopyrightNotice || ((document) =>
      `© ${document.copyrightYear} Motek — ${document.operator.name}. Wszelkie prawa zastrzeżone.`);
    article.append(createTextElement(
      documentRoot,
      "p",
      "legal-copyright",
      formatCopyrightNotice(legalDocument),
    ));

    return article;
  }

  function bindThemeToggle(documentRoot, themePolicy) {
    const toggle = documentRoot?.querySelector("#themeToggle");
    if (!toggle || !themePolicy?.normalizeTheme || !themePolicy?.getNextTheme) return;

    let currentTheme = themePolicy.normalizeTheme(documentRoot.documentElement?.dataset.theme);

    function updateToggle(theme) {
      currentTheme = themePolicy.applyTheme(theme, documentRoot);
      const state = themePolicy.getThemeToggleState(currentTheme);
      toggle.setAttribute("aria-label", state.label);
      toggle.setAttribute("aria-pressed", String(state.pressed));
    }

    toggle.dataset.motekThemeBound = "true";
    updateToggle(currentTheme);
    toggle.addEventListener("click", () => {
      const nextTheme = themePolicy.getNextTheme(currentTheme);
      const savedTheme = themePolicy.saveTheme ? themePolicy.saveTheme(nextTheme) : nextTheme;
      updateToggle(savedTheme);
    });
  }

  function initializeLegalPage({
    documentRoot = typeof document === "object" ? document : null,
    legalDocument = legalApi.CURRENT_LEGAL_DOCUMENT,
    themePolicy = root?.MotekThemePolicy,
  } = {}) {
    const article = renderLegalDocument(documentRoot, legalDocument);
    bindThemeToggle(documentRoot, themePolicy);
    return article;
  }

  return { initializeLegalPage, renderLegalDocument };
});
