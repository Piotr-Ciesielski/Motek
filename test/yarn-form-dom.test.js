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

function createApiClient(captcha = { enabled: false, provider: null, siteKey: null }, yarns = []) {
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
          return { captcha };
        case "/api/patterns":
          return { items: [], total: 0, hasMore: false };
        case "/api/yarns":
          return yarns;
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

async function createAppWindow({ captchaEnabled = false, delayedCaptchaMs = 0, yarns = [] } = {}) {
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
    createApiClient: () => createApiClient(captchaEnabled
      ? { enabled: true, provider: "turnstile", siteKey: "test-site-key" }
      : undefined, yarns),
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
  const captchaRenderCalls = [];
  const installTurnstileMock = () => {
    window.turnstile = {
      render(container) {
        captchaRenderCalls.push(container.dataset.turnstileFor);
        return captchaRenderCalls.length;
      },
      reset() {},
    };
  };
  if (delayedCaptchaMs > 0) {
    const appendChild = window.document.head.appendChild.bind(window.document.head);
    window.document.head.appendChild = (node) => {
      const result = appendChild(node);
      if (node.src.includes("challenges.cloudflare.com")) {
        window.setTimeout(() => {
          installTurnstileMock();
          node.dispatchEvent(new window.Event("load"));
        }, delayedCaptchaMs);
      }
      return result;
    };
  } else {
    installTurnstileMock();
  }
  window.__captchaRenderCalls = captchaRenderCalls;
  context.createCatalogController = createCatalogController;
  context.MotekDomUtils = MotekDomUtils;

  vm.runInContext(appSource, context, { filename: "app.js" });
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  return window;
}

test("mapa schowka wybiera motek i rozwija pełną listę", async () => {
  const yarns = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    name: `Motek ${index + 1}`,
    color: `Kolor ${index + 1}`,
    materials: ["wool"],
    weightClass: "dk",
    length: 200 + index,
    weight: 50,
  }));
  const window = await createAppWindow({ yarns });
  const document = window.document;
  const nodes = [...document.querySelectorAll(".inventory-yarn-node")];

  assert.equal(nodes.length, 8);
  nodes[1].click();
  assert.equal(document.querySelectorAll('.inventory-yarn-node[aria-pressed="true"]').length, 1);
  assert.equal(document.querySelector('.inventory-yarn-node[aria-pressed="true"]'), nodes[1]);
  assert.equal(document.getElementById("inventoryYarnDetailName").textContent, "Motek 2");
  document.getElementById("inventoryStockToggle").click();
  assert.equal(document.getElementById("inventoryStock").hidden, false);
  assert.equal(document.querySelectorAll("#inventoryStock .yarn-card").length, 10);
});

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

test("captcha renderuje się dla widocznego formularza i po przełączeniu", async () => {
  const window = await createAppWindow({ captchaEnabled: true });

  assert.deepEqual(window.__captchaRenderCalls, ["login"]);

  window.document.getElementById("registerModeBtn").click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  assert.deepEqual(window.__captchaRenderCalls, ["login", "register"]);
});

test("captcha nie renderuje się w formularzu ukrytym po przełączeniu podczas ładowania", async () => {
  const window = await createAppWindow({ captchaEnabled: true, delayedCaptchaMs: 50 });

  window.document.getElementById("registerModeBtn").click();
  await new Promise((resolve) => window.setTimeout(resolve, 80));

  assert.deepEqual(window.__captchaRenderCalls, ["register"]);
});
