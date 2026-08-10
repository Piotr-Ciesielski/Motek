const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { createAuthController } = require("../client/auth-controller");

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const browserScripts = [
  "theme-policy.js",
  "material-policy.js",
  "legal-document.js",
  "client/legal-acceptance-controller.js",
  "client-policy.js",
  "client/api-client.js",
  "client/dom-utils.js",
  "client/catalog-controller.js",
  "client/idle-session-controller.js",
  "app.js",
].map((file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8"));

function loadApp({ reducedMotion = false, session = { authenticated: false, user: null } } = {}) {
  const dom = new JSDOM(indexHtml, {
    url: "http://localhost/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.matchMedia = () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) {
    this.scrollOptions = options;
  };
  const calls = [];
  window.fetch = async (input) => {
    const pathname = new URL(input, window.location.href).pathname;
    calls.push(pathname);
    const payload = pathname === "/api/config"
      ? { captcha: { enabled: false } }
      : pathname === "/api/auth/session"
        ? session
        : { items: [], total: 0 };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  browserScripts.forEach((source) => window.eval(source));
  dom.fetchCalls = calls;
  return dom;
}

function target() {
  return {
    listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    emit(type, event = {}) { return this.listeners[type]?.(event); },
  };
}

test("auth controller initializes session and reports it", async () => {
  const calls = [];
  const sessions = [];
  const apiClient = {
    request: async (path, options) => {
      calls.push({ path, options });
      return { authenticated: true, user: { id: "u1" } };
    },
  };
  const controller = createAuthController({}, apiClient, (session) => sessions.push(session));

  const session = await controller.initialize();

  assert.deepEqual(session, { authenticated: true, user: { id: "u1" }, error: null, loading: false });
  assert.equal(calls[0].path, "/api/auth/session");
  assert.equal(sessions.at(-1).authenticated, true);
  assert.equal(controller.getState().user.id, "u1");
});

test("podpięty login wysyła dane POST i aktualizuje sesję", async () => {
  const loginForm = target();
  loginForm.payload = { email: "jan@example.test", password: "Secret1!" };
  const calls = [];
  const sessions = [];
  const controller = createAuthController({ loginForm }, {
    request: async (path, options) => {
      calls.push({ path, options });
      return { user: { id: "u1" }, authenticated: true };
    },
  }, (session) => sessions.push(session));

  const event = { preventDefault() { this.prevented = true; } };
  await loginForm.emit("submit", event);

  assert.equal(event.prevented, true);
  assert.equal(calls[0].path, "/api/auth/login");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), loginForm.payload);
  assert.equal(sessions.at(-1).authenticated, true);
  assert.equal(controller.getState().loading, false);
});

test("logout wysyła POST i oznacza sesję jako nieaktywną", async () => {
  const logoutButton = target();
  const calls = [];
  const controller = createAuthController({ logoutButton }, {
    request: async (path, options) => {
      calls.push({ path, options });
      return {};
    },
  });
  await logoutButton.emit("click", {});

  assert.equal(calls[0].path, "/api/auth/logout");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(controller.getState().authenticated, false);
});

test("podpięta rejestracja wysyła dane do endpointu register", async () => {
  const registerForm = target();
  registerForm.payload = { email: "nowy@example.test", password: "Secret1!" };
  let call;
  createAuthController({ registerForm }, {
    request: async (path, options) => { call = { path, options }; return { user: { id: "u2" } }; },
  });

  await registerForm.emit("submit", { preventDefault() {} });

  assert.equal(call.path, "/api/auth/register");
  assert.deepEqual(JSON.parse(call.options.body), registerForm.payload);
});

test("błąd initialize publikuje nieaktywną sesję i kończy loading", async () => {
  const snapshots = [];
  const controller = createAuthController({}, {
    request: async () => { throw new Error("offline"); },
  }, (session) => snapshots.push(session));

  await assert.rejects(controller.initialize(), /offline/);
  assert.equal(controller.getState().loading, false);
  assert.equal(controller.getState().authenticated, false);
  assert.equal(snapshots.at(-1).error.message, "offline");
});

test("błąd loginu kończy loading i zachowuje komunikat błędu", async () => {
  const controller = createAuthController({}, {
    request: async () => { throw new Error("niepoprawne dane"); },
  });

  await assert.rejects(controller.login({ email: "x", password: "y" }), /niepoprawne dane/);
  assert.equal(controller.getState().loading, false);
  assert.match(controller.getState().error.message, /niepoprawne dane/);
});

test("eksportuje kontroler globalnie w przeglądarce", () => {
  const source = fs.readFileSync(require.resolve("../client/auth-controller"), "utf8");
  const window = {};
  vm.runInNewContext(source, { window });
  assert.equal(typeof window.createAuthController, "function");
});

test("Zacznij w Motku otwiera rejestrację, przewija panel i fokusuje e-mail", async (t) => {
  for (const reducedMotion of [false, true]) {
    await t.test(reducedMotion ? "bez animacji" : "z płynnym przewijaniem", async () => {
      const dom = loadApp({ reducedMotion });
      const { document } = dom.window;

      await new Promise((resolve) => dom.window.setTimeout(resolve, 20));
      document.getElementById("heroAuthBtn").click();
      await new Promise((resolve) => dom.window.setTimeout(resolve, 275));

      assert.equal(document.getElementById("registerForm").hidden, false);
      assert.equal(document.getElementById("registerModeBtn").getAttribute("aria-selected"), "true");
      assert.equal(document.querySelector(".auth-panel").scrollOptions.behavior, reducedMotion ? "auto" : "smooth");
      assert.equal(document.activeElement, document.getElementById("register-login"));
      dom.window.close();
    });
  }
});

test("stara akceptacja blokuje prywatne żądania i zostawia wyjście z konta", async () => {
  const dom = loadApp({
    session: {
      authenticated: true,
      user: { id: "stale-user", email: "stale@example.test" },
      legal: { currentVersion: "1.0", acceptedVersion: "0.9", acceptanceRequired: true },
    },
  });
  try {
    await new Promise((resolve) => dom.window.setTimeout(resolve, 30));

    const document = dom.window.document;
    assert.equal(document.getElementById("legalAcceptanceGate").hidden, false);
    assert.equal(document.getElementById("inventoryView").hidden, true);
    assert.equal(document.getElementById("catalogView").hidden, true);
    assert.equal(document.getElementById("logoutBtn").disabled, false);
    assert.equal(document.querySelector('.app-nav [data-view-target="inventory"]').disabled, true);
    assert.equal(document.querySelector('.app-nav [data-view-target="matches"]').disabled, true);
    assert.equal(document.querySelector('.app-nav [data-view-target="catalog"]').disabled, true);
    assert.equal(dom.fetchCalls.some((path) => /\/api\/(yarns|matches|patterns)/.test(path)), false);
  } finally {
    dom.window.close();
  }
});
