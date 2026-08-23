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

function waitForInitialSession(window, session) {
  const authMessage = window.document.getElementById("authMessage");
  const authUser = window.document.getElementById("authUser");
  return new Promise((resolve) => {
    const check = () => {
      const ready = session.authenticated
        ? !authUser.hidden
        : /Możesz założyć konto lub zalogować się\./.test(authMessage.textContent);
      if (!ready) return;
      observer.disconnect();
      resolve();
    };
    const observer = new window.MutationObserver(check);
    observer.observe(window.document.body, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    check();
  });
}

function waitForText(window, element, matcher) {
  return new Promise((resolve) => {
    const check = () => {
      if (!matcher.test(element.textContent)) return;
      observer.disconnect();
      resolve();
    };
    const observer = new window.MutationObserver(check);
    observer.observe(element, { childList: true, characterData: true, subtree: true });
    check();
  });
}

function waitForCondition(window, predicate, message, timeoutMs = 250) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(message));
        return;
      }
      window.setTimeout(check, 5);
    };
    check();
  });
}

function loadApp({
  reducedMotion = false,
  session = { authenticated: false, user: null },
  loginSession = null,
  loginResponse = null,
  catalogPayload = { items: [], total: 0 },
  url = "http://localhost/",
} = {}) {
  const dom = new JSDOM(indexHtml, {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const initialSessionReady = waitForInitialSession(window, session);
  window.matchMedia = () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) {
    this.scrollOptions = options;
  };
  const calls = [];
  let activeSession = session;
  window.fetch = async (input) => {
    const pathname = new URL(input, window.location.href).pathname;
    calls.push(pathname);
    const payload = pathname === "/api/config"
      ? { captcha: { enabled: false } }
      : pathname === "/api/auth/login"
        ? ((activeSession = loginSession || session), loginResponse || { user: activeSession.user })
      : pathname === "/api/auth/session"
        ? activeSession
        : pathname === "/api/patterns"
          ? catalogPayload
        : { items: [], total: 0 };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  browserScripts.forEach((source) => window.eval(source));
  dom.fetchCalls = calls;
  dom.initialSessionReady = initialSessionReady;
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

test("aplikacja uruchamia się bez promocyjnego CTA w hero Konta", async () => {
  const dom = loadApp();
  await dom.initialSessionReady;

  assert.ok(dom.window.document.getElementById("heroTitle"));
  assert.ok(dom.window.document.getElementById("accountThemeImage"));
  assert.equal(dom.window.document.getElementById("heroAuthBtn"), null);
  dom.window.close();
});

test("po udanym logowaniu odświeża katalog wzorów", async () => {
  const dom = loadApp({
    loginSession: {
      authenticated: true,
      user: { id: "logged-in-user", email: "logged-in@example.test" },
      legal: {
        currentVersion: "1.0",
        acceptedVersion: "1.0",
        acceptanceRequired: false,
      },
    },
    catalogPayload: {
      items: [{
        id: 1,
        name: "Test pattern",
        projectType: "other",
        materials: [],
        yarnRequirements: [],
        sourceLanguage: "unknown",
        needsReview: false,
      }],
      total: 1,
      hasMore: false,
    },
  });

  try {
    await dom.initialSessionReady;
    assert.equal(dom.fetchCalls.includes("/api/patterns"), false);

    const document = dom.window.document;
    document.getElementById("login-email").value = "logged-in@example.test";
    document.getElementById("login-password").value = "Secret123!";
    document.getElementById("loginForm").dispatchEvent(new dom.window.Event("submit", {
      bubbles: true,
      cancelable: true,
    }));

    await waitForCondition(
      dom.window,
      () => dom.fetchCalls.includes("/api/patterns"),
      "logowanie nie odświeżyło katalogu wzorów",
    );
  } finally {
    dom.window.close();
  }
});

test("ważny link zaproszenia otwiera rejestrację po inicjalizacji niezalogowanej sesji", async () => {
  const invitation = "A".repeat(64);
  const dom = loadApp({ url: `http://localhost/?invitation=${invitation}` });

  try {
    await dom.initialSessionReady;

    assert.equal(dom.window.document.getElementById("registerForm").hidden, false);
    assert.equal(dom.window.document.getElementById("loginForm").hidden, true);
  } finally {
    dom.window.close();
  }
});

test("rejestracja bez tokenu zatrzymuje żądanie API i wyjaśnia wymaganie linku", async () => {
  const dom = loadApp();

  try {
    await dom.initialSessionReady;

    const document = dom.window.document;
    document.getElementById("registerModeBtn").click();
    document.querySelector('#registerForm [name="login"]').value = "jan@example.test";
    document.querySelector('#registerForm [name="password"]').value = "Haslo123!";
    document.querySelector('#registerForm [name="termsAccepted"]').checked = true;
    const messageReady = waitForText(dom.window, document.getElementById("authMessage"), /pełny link zaproszenia/i);
    document.getElementById("registerForm").dispatchEvent(new dom.window.Event("submit", {
      bubbles: true,
      cancelable: true,
    }));
    await messageReady;

    assert.equal(dom.fetchCalls.includes("/api/auth/register"), false);
    assert.match(document.getElementById("authMessage").textContent, /pełny link zaproszenia/i);
  } finally {
    dom.window.close();
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
    await dom.initialSessionReady;

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
