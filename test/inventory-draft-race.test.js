const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");

function deferred() {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function waitFor(check) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt > 500) {
        clearInterval(timer);
        reject(new Error("Nie rozpoczęto oczekiwanego żądania GET /api/yarns."));
      }
    }, 0);
  });
}

function loadBrowserScript(context, relativePath) {
  vm.runInContext(
    fs.readFileSync(path.join(root, relativePath), "utf8"),
    context,
    { filename: relativePath },
  );
}

test("opóźniony GET /api/yarns nie usuwa nowego draftu rozpoczętego po odświeżeniu", async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"), {
    url: "https://motek.test/",
    runScripts: "outside-only",
  });
  const { window } = dom;
  const context = dom.getInternalVMContext();
  const yarns = deferred();
  let yarnRequestStarted = false;

  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.confirm = () => true;
  window.fetch = async () => ({ ok: true, json: async () => ({}) });
  window.MotekMaterialPolicy = {
    MATERIALS: [{ value: "wełna", label: "Wełna" }, { value: "mieszanka", label: "Mieszanka" }],
    formatYarnMaterials: (materials) => materials.join(", "),
    normalizeYarnMaterials: (materials) => materials,
  };
  window.MotekThemePolicy = {
    applyTheme: (theme) => theme,
    getThemeToggleState: () => ({ nextTheme: "dark" }),
    normalizeTheme: (theme) => theme || "light",
    saveTheme() {},
  };
  window.MotekDomUtils = { setMessage() {}, clearMessage() {} };
  window.MotekApiClient = {
    createApiClient: () => ({
      request: async (url) => {
        const pathname = new URL(url).pathname;
        if (pathname === "/api/auth/session") {
          return {
            authenticated: true,
            user: { email: "test@motek.test" },
            profile: {},
            legal: { currentVersion: "1.0", acceptedVersion: "1.0", acceptanceRequired: false },
          };
        }
        if (pathname === "/api/yarns") {
          yarnRequestStarted = true;
          return yarns.promise;
        }
        return [];
      },
    }),
    ApiError: class ApiError extends Error {},
    RequestError: class RequestError extends Error {},
    isResponseEnvelope: () => false,
  };
  window.MotekClientPolicy = {
    ensureSingleNewYarnCard(cards, createCard) {
      const existing = [...cards].find((card) => card.dataset.saved !== "true");
      return existing ? { card: existing, created: false } : { card: createCard(), created: true };
    },
    getYarnSaveHint: () => ({ visible: true, disabled: false, message: "" }),
    getMatchFreshnessState: () => ({ stale: false, message: "" }),
    buildAuthPayload: () => ({}),
    resolveRequestedView: ({ requested, authenticated, acceptanceRequired }) =>
      authenticated && !acceptanceRequired ? (requested || "inventory") : "account",
    buildPatternFacetCounts: () => ({}),
    buildPatternFacetOptions: () => [],
    filterPatterns: () => [],
    findNewlySavedYarn: () => null,
    formatMatchingRequirement: () => "",
    formatPatternYarnFact: () => "",
    getProjectTypeFilterLabel: () => "",
    getProjectTypeLabel: () => "",
    getExistingYarnState: () => ({}),
    getYarnMeasurementValidationMessage: () => "",
    readYarnVersionHeader: () => null,
    withYarnVersionRetry: async ({ operation }) => operation(),
    isDeleteConfirmed: () => false,
    initializePasswordRevealControls() {},
    loadNextPaginatedPage: async () => ({}),
    formatCatalogSummary: () => "",
  };
  window.createCatalogController = () => ({
    refresh: async () => ({}),
    loadMore: async () => ({}),
    getState: () => ({ items: [], filters: {}, hasMore: false, total: 0 }),
  });
  window.MotekIdleSession = {
    createIdleSessionController: () => ({ start() {}, stop() {}, markActivity: async () => false }),
  };

  loadBrowserScript(context, "legal-document.js");
  loadBrowserScript(context, "client/legal-acceptance-controller.js");
  loadBrowserScript(context, "app.js");
  await waitFor(() => yarnRequestStarted);

  const yarnList = window.document.getElementById("yarnList");
  const replaceChildren = yarnList.replaceChildren.bind(yarnList);
  let replaceChildrenCalls = 0;
  yarnList.replaceChildren = (...nodes) => {
    replaceChildrenCalls += 1;
    return replaceChildren(...nodes);
  };

  window.document.getElementById("addYarnBtn").click();
  const draft = window.document.querySelector('.yarn-card[data-saved="false"]');
  assert.ok(draft, "użytkownik może rozpocząć nowy draft podczas odświeżania");
  draft.querySelector('[data-field="name"]').value = "Mój niezapisany motek";

  yarns.resolve([{ id: 1, name: "Dane serwera", color: "niebieski", materials: ["wełna"], weightClass: "dk", length: 100, weight: 50 }]);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(replaceChildrenCalls, 0, "spóźnione odświeżenie nie czyści listy podczas edycji draftu");
  assert.equal(window.document.querySelector('.yarn-card[data-saved="false"] [data-field="name"]').value, "Mój niezapisany motek");
});

test("powrót do magazynu odświeża dane po unieważnieniu poprzedniego GET", async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"), {
    url: "https://motek.test/",
    runScripts: "outside-only",
  });
  const { window } = dom;
  const context = dom.getInternalVMContext();
  const yarnRequests = [];

  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  window.confirm = () => true;
  window.fetch = async () => ({ ok: true, json: async () => ({}) });
  window.MotekMaterialPolicy = {
    MATERIALS: [{ value: "wełna", label: "Wełna" }, { value: "mieszanka", label: "Mieszanka" }],
    formatYarnMaterials: (materials) => materials.join(", "),
    normalizeYarnMaterials: (materials) => materials,
  };
  window.MotekThemePolicy = {
    applyTheme: (theme) => theme,
    getThemeToggleState: () => ({ nextTheme: "dark" }),
    normalizeTheme: (theme) => theme || "light",
    saveTheme() {},
  };
  window.MotekDomUtils = { setMessage() {}, clearMessage() {} };
  window.MotekApiClient = {
    createApiClient: () => ({
      request: async (url) => {
        const pathname = new URL(url).pathname;
        if (pathname === "/api/auth/session") {
          return {
            authenticated: true,
            user: { email: "test@motek.test" },
            profile: {},
            legal: { currentVersion: "1.0", acceptedVersion: "1.0", acceptanceRequired: false },
          };
        }
        if (pathname === "/api/yarns") {
          const request = deferred();
          yarnRequests.push(request);
          return request.promise;
        }
        return [];
      },
    }),
    ApiError: class ApiError extends Error {},
    RequestError: class RequestError extends Error {},
    isResponseEnvelope: () => false,
  };
  window.MotekClientPolicy = {
    ensureSingleNewYarnCard(cards, createCard) {
      const existing = [...cards].find((card) => card.dataset.saved !== "true");
      return existing ? { card: existing, created: false } : { card: createCard(), created: true };
    },
    getYarnSaveHint: () => ({ visible: true, disabled: false, message: "" }),
    getMatchFreshnessState: () => ({ stale: false, message: "" }),
    buildAuthPayload: () => ({}),
    resolveRequestedView: ({ requested, authenticated, acceptanceRequired }) =>
      authenticated && !acceptanceRequired ? (requested || "inventory") : "account",
    buildPatternFacetCounts: () => ({}),
    buildPatternFacetOptions: () => [],
    filterPatterns: () => [],
    findNewlySavedYarn: () => null,
    formatMatchingRequirement: () => "",
    formatPatternYarnFact: () => "",
    getProjectTypeFilterLabel: () => "",
    getProjectTypeLabel: () => "",
    getExistingYarnState: () => ({}),
    getYarnMeasurementValidationMessage: () => "",
    readYarnVersionHeader: () => null,
    withYarnVersionRetry: async ({ operation }) => operation(),
    isDeleteConfirmed: () => false,
    initializePasswordRevealControls() {},
    loadNextPaginatedPage: async () => ({}),
    formatCatalogSummary: () => "",
  };
  window.createCatalogController = () => ({
    refresh: async () => ({}),
    loadMore: async () => ({}),
    getState: () => ({ items: [], filters: {}, hasMore: false, total: 0 }),
  });
  window.MotekIdleSession = {
    createIdleSessionController: () => ({ start() {}, stop() {}, markActivity: async () => false }),
  };

  loadBrowserScript(context, "legal-document.js");
  loadBrowserScript(context, "client/legal-acceptance-controller.js");
  loadBrowserScript(context, "app.js");
  await waitFor(() => yarnRequests.length === 1);

  window.document.querySelector('[data-view-target="catalog"]').click();
  window.document.querySelector('[data-view-target="inventory"]').click();
  await waitFor(() => yarnRequests.length === 2);

  const yarnList = window.document.getElementById("yarnList");
  yarnRequests[0].resolve([{ id: 1, name: "Nieaktualny motek", color: "niebieski", materials: ["wełna"], weightClass: "dk", length: 100, weight: 50 }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(yarnList.getAttribute("aria-busy"), "true", "starsze żądanie nie kończy stanu ładowania nowszego odświeżenia");

  yarnRequests[1].resolve([{ id: 2, name: "Aktualny motek", color: "zielony", materials: ["wełna"], weightClass: "dk", length: 120, weight: 60 }]);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(yarnList.querySelector('.yarn-card[data-id="2"] [data-field="name"]').value, "Aktualny motek");
  assert.equal(yarnList.hasAttribute("aria-busy"), false, "magazyn przestaje być oznaczony jako ładowany po zakończeniu bieżącego odświeżenia");
});
