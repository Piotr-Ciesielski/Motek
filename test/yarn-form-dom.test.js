const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const { createCatalogController } = require("../client/catalog-controller");
const MotekClientPolicy = require("../client-policy");
const MotekDomUtils = require("../client/dom-utils");
const MotekMaterialPolicy = require("../material-policy");
const MotekThemePolicy = require("../theme-policy");

const repoRoot = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

class RequestError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = "RequestError";
    this.kind = kind;
  }
}

function createApiClient() {
  return {
    async request(pathname) {
      const url = new URL(pathname);
      switch (url.pathname) {
        case "/api/auth/session":
          return {
            authenticated: true,
            user: { id: "u-1", email: "tester@example.com", metadata: { login: "tester@example.com" } },
            profile: { login: "tester@example.com", email: "tester@example.com" },
          };
        case "/api/config":
          return { captcha: { enabled: false, provider: null, siteKey: null } };
        case "/api/patterns":
          return { items: [], total: 0, hasMore: false };
        case "/api/yarns":
          return [];
        default:
          throw new ApiError(`Nieoczekiwane wywołanie ${url.pathname}`, 500);
      }
    },
  };
}

function isResponseEnvelope(value) {
  return Boolean(
    value
    && Object.prototype.hasOwnProperty.call(value, "data")
    && Object.prototype.hasOwnProperty.call(value, "response"),
  );
}

async function createAppWindow() {
  const dom = new JSDOM(indexHtml, {
    url: "http://localhost/",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  const { window } = dom;
  const context = dom.getInternalVMContext();

  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value() {},
  });
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value() {},
  });
  Object.defineProperty(window.HTMLFormElement.prototype, "reportValidity", {
    configurable: true,
    value() { return true; },
  });
  Object.defineProperty(window, "fetch", {
    configurable: true,
    value: async () => {
      throw new Error("fetch nie powinien być wywołany w tym teście");
    },
  });
  Object.defineProperty(window, "confirm", {
    configurable: true,
    value: () => true,
  });

  window.MotekApiClient = {
    createApiClient,
    ApiError,
    RequestError,
    isResponseEnvelope,
  };
  window.MotekClientPolicy = MotekClientPolicy;
  window.MotekMaterialPolicy = MotekMaterialPolicy;
  window.MotekThemePolicy = MotekThemePolicy;
  window.MotekIdleSession = {
    createIdleSessionController() {
      return {
        start() {},
        stop() {},
        async markActivity() {
          return true;
        },
      };
    },
  };
  context.createCatalogController = createCatalogController;
  context.MotekDomUtils = MotekDomUtils;

  vm.runInContext(appSource, context, { filename: "app.js" });
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  return window;
}

async function openMaterialPicker() {
  const window = await createAppWindow();
  const addYarnButton = window.document.getElementById("addYarnBtn");
  addYarnButton.click();

  const card = window.document.querySelector(".yarn-card");
  assert.ok(card, "kliknięcie dodawania powinno utworzyć formularz włóczki");

  const picker = card.querySelector("[data-material-picker]");
  picker.open = true;

  return { window, card, picker };
}

test("kliknięcie poza pickerem materiałów zamyka dropdown", async () => {
  const { window, card, picker } = await openMaterialPicker();
  const nameField = card.querySelector('[data-field="name"]');

  nameField.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

  assert.equal(
    picker.open,
    false,
    "klik poza pickerem powinien zamknąć dropdown materiałów",
  );
});

test("kliknięcie checkboxu materiału nie zamyka otwartego pickera", async () => {
  const { window, card, picker } = await openMaterialPicker();
  const option = card.querySelector("[data-material-option]");

  option.checked = true;
  option.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  option.dispatchEvent(new window.Event("change", { bubbles: true }));

  assert.equal(
    picker.open,
    true,
    "zaznaczenie materiału nie powinno zamykać dropdownu",
  );
});
