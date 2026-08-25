const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { isResponseEnvelope } = require("../client/api-client");

const root = path.join(__dirname, "..");

const activeProjectPayload = {
  id: 7,
  status: "active",
  version: 3,
  patternId: 12,
  variantId: "rozmiar M",
  patternName: "Czapka z pomponem",
  progressUnit: "row",
  progressCount: 4,
  note: null,
  toolSizeMm: 3.5,
  gauge: null,
  yarns: [
    { role: "główna", initialLengthMeters: 200, initialWeightGrams: 50 },
  ],
};

function waitFor(check, message = "Oczekiwany stan nie nastąpił.") {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt > 500) {
        clearInterval(timer);
        reject(new Error(message));
      }
    }, 0);
  });
}

function boot({ getProjectResponse, startProjectResponse = { project: activeProjectPayload } } = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"), {
    url: "https://motek.test/",
    runScripts: "outside-only",
  });
  const { window } = dom;
  const context = dom.getInternalVMContext();
  let onUnauthorizedHandler = null;
  let projectRequestCount = 0;

  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  window.confirm = () => true;
  window.fetch = async () => ({ ok: true, json: async () => ({}) });
  window.motekProjectRequestCount = () => projectRequestCount;
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
    createApiClient: ({ onUnauthorized }) => {
      onUnauthorizedHandler = onUnauthorized;
      return {
        request: async (url, options = {}) => {
          const pathname = new URL(url).pathname;
          if (pathname === "/api/projects/active") {
            projectRequestCount += 1;
            const response = getProjectResponse(projectRequestCount);
            if (response.status === 204) return { data: null, response: {} };
            if (response.project) return { ...response.project };
            const error = new Error(response.message || "Błąd projektu.");
            error.status = response.status;
            if (response.status === 401) onUnauthorizedHandler(url);
            throw error;
          }
          if (pathname === "/api/projects" && options.method === "POST") {
            return { ...startProjectResponse.project };
          }
          if (pathname === "/api/auth/session") {
            return {
              authenticated: true,
              user: { email: "test@motek.test" },
              profile: {},
              legal: { currentVersion: "1.0", acceptedVersion: "1.0", acceptanceRequired: false },
            };
          }
          if (pathname === "/api/auth/logout") return { authenticated: false };
          return [];
        },
      };
    },
    ApiError: class ApiError extends Error {},
    RequestError: class RequestError extends Error {},
    isResponseEnvelope,
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
    readYarnVersionHeader: () => '"yarn-v1"',
    readProjectVersionHeader: () => '"project-v3"',
    getActiveProjectView({ project }) {
      if (!project || project.status !== "active") return { visible: false };
      return {
        visible: true,
        patternAvailable: Boolean(project.patternName),
        title: project.patternName
          ? `${project.patternName} — ${project.variantId}`
          : "Wzór niedostępny",
        yarnLines: (project.yarns || []).map((assignment) =>
          `${assignment.role}: ${assignment.initialLengthMeters} m`),
        progress: {
          unit: project.progressUnit === "round" ? "round" : "row",
          count: project.progressCount ?? 0,
          note: project.note ?? "",
          toolSizeMm: project.toolSizeMm == null ? "" : String(project.toolSizeMm),
          gauge: project.gauge ?? "",
        },
      };
    },
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

  vm.runInContext(fs.readFileSync(path.join(root, "legal-document.js"), "utf8"), context, { filename: "legal-document.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "client/legal-acceptance-controller.js"), "utf8"), context, { filename: "legal-acceptance-controller.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), context, { filename: "app.js" });

  return window;
}

async function bootWithVisiblePanel(extraResponses = []) {
  const window = boot({
    getProjectResponse: (requestCount) =>
      extraResponses[requestCount - 1] || { project: activeProjectPayload },
  });
  await waitFor(() => !window.document.getElementById("activeProjectPanel").hidden);
  return window;
}

test("401 z /api/projects/active kończy sesję jak dla magazynu", async () => {
  const window = await bootWithVisiblePanel([
    { project: activeProjectPayload },
    { status: 401, message: "Wymagane logowanie." },
  ]);
  window.document.getElementById("findBtn").click();
  await waitFor(() => window.document.getElementById("headerAuthAction").textContent === "Zaloguj");

  const authForms = window.document.getElementById("authForms");
  assert.equal(authForms.hidden, false, "po 401 z projektu pokazuje się formularz logowania");
  assert.match(window.document.getElementById("authMessage").textContent, /Sesja wygasła/);
  assert.equal(window.document.getElementById("activeProjectPanel").hidden, true);
});

test("wylogowanie usuwa projekt z pamięci i panelu", async () => {
  const window = await bootWithVisiblePanel();
  const panel = window.document.getElementById("activeProjectPanel");

  assert.ok(panel.querySelector("strong"), "panel projektu jest widoczny przed wylogowaniem");
  window.document.getElementById("logoutBtn").click();
  await waitFor(() => window.document.getElementById("headerAuthAction").textContent === "Zaloguj");

  assert.equal(panel.hidden, true, "panel projektu jest ukryty po wylogowaniu");
  assert.equal(panel.childElementCount, 0, "treść projektu prywatnego zostaje usunięta z DOM");
  assert.equal(window.document.getElementById("activeProjectStatus").hidden, true, "status projektu zostaje wyczyszczony");
});

test("zapis postępu zachowuje przypisania motków mimo odpowiedzi bez nich", async () => {
  const window = await bootWithVisiblePanel([
    { project: activeProjectPayload },
    { project: { ...activeProjectPayload, version: 4, progressCount: 5 } },
  ]);
  const plusButton = window.document.querySelector('[aria-label="Zwiększ postęp o jeden"]');
  plusButton.click();
  await waitFor(() =>
    window.document.getElementById("activeProjectStatus").textContent.includes("Postęp zapisany.")
  );

  const storedProject = window.eval("activeProject");
  assert.equal(storedProject.progressCount, 5, "odpowiedź PATCH aktualizuje postęp");
  assert.deepEqual(
    storedProject.yarns,
    activeProjectPayload.yarns,
    "scalanie odpowiedzi zachowuje przypisane motki",
  );
});

test("błąd odświeżenia projektu zachowuje ostatni znany stan i propaguje komunikat", async () => {
  const window = await bootWithVisiblePanel([
    { project: activeProjectPayload },
    { status: 503, message: "Błąd projektu. Serwer jest chwilowo niedostępny." },
  ]);
  const panel = window.document.getElementById("activeProjectPanel");
  const titleBefore = panel.querySelector("strong").textContent;

  window.document.getElementById("findBtn").click();
  await waitFor(() => window.document.getElementById("results").textContent.includes("Błąd projektu."));

  assert.equal(panel.hidden, false, "błąd sieci nie ukrywa ostatniego znanego projektu");
  assert.equal(panel.querySelector("strong").textContent, titleBefore, "treść panelu pozostaje bez zmian");
  assert.match(window.document.getElementById("results").textContent, /Błąd projektu\./, "błąd odświeżenia trafia do obszaru wyników");
});

test("204 po braku projektu nie blokuje rozpoczęcia nowego projektu", async () => {
  const window = boot({
    getProjectResponse: () => ({ status: 204 }),
  });
  await waitFor(() => window.motekProjectRequestCount() >= 1);

  assert.equal(window.eval("activeProject"), null, "odpowiedź 204 zostaje rozpakowana do null");
  assert.equal(window.document.getElementById("activeProjectPanel").hidden, true, "panel projektu pozostaje ukryty");

  await window.eval("startActiveProject(12, 'rozmiar M')");
  await waitFor(() => !window.document.getElementById("activeProjectPanel").hidden);
  assert.match(
    window.document.getElementById("activeProjectStatus").textContent,
    /Projekt rozpoczęty\./,
    "po 204 można rozpocząć projekt",
  );
});
