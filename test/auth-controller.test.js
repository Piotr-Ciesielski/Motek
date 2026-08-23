const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { createAuthController } = require("../client/auth-controller");

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const browserScripts = [
  "legal-document.js",
  "client/legal-acceptance-controller.js",
  "theme-policy.js",
  "material-policy.js",
  "client-policy.js",
  "client/api-client.js",
  "client/dom-utils.js",
  "client/catalog-controller.js",
  "client/idle-session-controller.js",
  "app.js",
].map((file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8"));

function loadApp({
  reducedMotion = false,
  session = { authenticated: false, user: null },
  onRequest,
  url = "http://localhost/",
} = {}) {
  const dom = new JSDOM(indexHtml, {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.matchMedia = () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) {
    this.scrollOptions = options;
  };
  const requests = [];
  window.fetch = async (input, options = {}) => {
    const pathname = new URL(input, window.location.href).pathname;
    requests.push({ pathname, options });
    const payload = await onRequest?.({ pathname, options }) ?? (pathname === "/api/config"
      ? { captcha: { enabled: false } }
      : pathname === "/api/auth/session"
        ? session
        : { items: [], total: 0 });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  browserScripts.forEach((source) => window.eval(source));
  dom.requests = requests;
  return dom;
}

async function waitFor(condition, dom, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error("Warunek testu nie został spełniony na czas.");
    await new Promise((resolve) => dom.window.setTimeout(resolve, 5));
  }
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

test("niezalogowany przycisk nagłówka otwiera czysty formularz logowania i fokusuje e-mail", async () => {
  const dom = loadApp();
  const { document } = dom.window;

  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));
  const authMessage = document.getElementById("authMessage");
  authMessage.textContent = "Poprzedni komunikat";
  const headerAuthAction = document.getElementById("headerAuthAction");

  assert.equal(headerAuthAction.textContent, "Zaloguj");
  assert.equal(headerAuthAction.getAttribute("aria-label"), "Zaloguj");
  headerAuthAction.click();

  assert.equal(document.getElementById("accountView").hidden, false);
  assert.equal(document.getElementById("loginForm").hidden, false);
  assert.equal(authMessage.textContent, "");
  assert.equal(document.activeElement.id, "login-email");
  dom.window.close();
});

test("zalogowany przycisk nagłówka wylogowuje bez ujawniania e-maila", async (t) => {
  const email = "jan@example.test";
  const dom = loadApp({
    session: {
      authenticated: true,
      user: { id: "u1", email },
      profile: { email },
    },
    onRequest: ({ pathname }) => pathname === "/api/auth/logout" ? {} : undefined,
  });
  const { document } = dom.window;
  t.after(() => dom.window.close());

  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));
  const headerAuthAction = document.getElementById("headerAuthAction");

  assert.equal(headerAuthAction.textContent, "Wyloguj");
  assert.equal(headerAuthAction.getAttribute("aria-label"), "Wyloguj");
  assert.equal(headerAuthAction.title, "");
  assert.doesNotMatch(headerAuthAction.textContent, new RegExp(email));
  const accountEmailLines = ["authUser", "authProfileSummary"]
    .map((id) => document.getElementById(id))
    .filter((node) => !node.hidden && node.textContent.startsWith("Zalogowano jako"))
    .map((node) => node.textContent);
  assert.deepEqual(accountEmailLines, [`Zalogowano jako: ${email}`]);
  assert.equal(accountEmailLines.filter((line) => /^Zalogowano jako (?!:)/.test(line)).length, 0);

  const deleteAccountDisclosure = document.getElementById("deleteAccountDisclosure");
  deleteAccountDisclosure.open = true;
  headerAuthAction.click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

  assert.ok(dom.requests.some(({ pathname }) => pathname === "/api/auth/logout"));
  assert.equal(document.getElementById("accountView").hidden, false);
  assert.equal(document.getElementById("loginForm").hidden, false);
  assert.equal(deleteAccountDisclosure.open, false);
});

test("pomyślne logowanie z formularza nadal przenosi do magazynu", async () => {
  const email = "jan@example.test";
  let authenticated = false;
  const dom = loadApp({
    onRequest: ({ pathname }) => {
      if (pathname === "/api/auth/login") {
        authenticated = true;
        return { user: { id: "u1", email } };
      }
      if (pathname === "/api/auth/session") {
        return authenticated
          ? {
            authenticated: true,
            user: { id: "u1", email },
            profile: { email },
            legal: { currentVersion: "1.0", acceptedVersion: "1.0", acceptanceRequired: false },
          }
          : { authenticated: false, user: null };
      }
      return undefined;
    },
  });
  const { document } = dom.window;

  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));
  document.getElementById("login-email").value = email;
  document.getElementById("login-password").value = "Secret1!";
  document.getElementById("loginForm").requestSubmit();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

  assert.equal(document.getElementById("inventoryView").hidden, false);
  assert.equal(document.getElementById("headerAuthAction").textContent, "Wyloguj");
  assert.ok(dom.requests.some(({ pathname }) => pathname === "/api/patterns"));
  dom.window.close();
});

test("zwykłe logowanie pokazuje Magazyn przed zakończeniem odświeżania danych", async (t) => {
  const email = "jan@example.test";
  let authenticated = false;
  let resolveYarns;
  const pendingYarns = new Promise((resolve) => { resolveYarns = resolve; });
  const dom = loadApp({
    onRequest: async ({ pathname }) => {
      if (pathname === "/api/auth/login") {
        authenticated = true;
        return { user: { id: "u1", email } };
      }
      if (pathname === "/api/auth/session") {
        return authenticated
          ? {
            authenticated: true,
            user: { id: "u1", email },
            profile: { email },
            legal: { currentVersion: "1.0", acceptedVersion: "1.0", acceptanceRequired: false },
          }
          : { authenticated: false, user: null };
      }
      if (pathname === "/api/yarns") return pendingYarns;
      return undefined;
    },
  });
  t.after(() => dom.window.close());

  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));
  dom.window.document.getElementById("login-email").value = email;
  dom.window.document.getElementById("login-password").value = "Secret1!";
  dom.window.document.getElementById("loginForm").requestSubmit();

  await waitFor(() => dom.requests.some(({ pathname }) => pathname === "/api/yarns"), dom);
  assert.equal(dom.window.document.getElementById("inventoryView").hidden, false);
  resolveYarns([]);
});

test("logowanie nie pokazuje przejściowej bramy prawnej przed odczytem sesji", async (t) => {
  const email = "jan@example.test";
  let sessionCalls = 0;
  let resolveSession;
  const pendingSession = new Promise((resolve) => { resolveSession = resolve; });
  const dom = loadApp({
    onRequest: async ({ pathname }) => {
      if (pathname === "/api/auth/login") return { user: { id: "u1", email } };
      if (pathname === "/api/auth/session") {
        sessionCalls += 1;
        if (sessionCalls === 1) return { authenticated: false, user: null };
        return pendingSession;
      }
      if (pathname === "/api/yarns") return [];
      return undefined;
    },
  });
  t.after(() => dom.window.close());

  await waitFor(() => sessionCalls === 1, dom);
  dom.window.document.getElementById("login-email").value = email;
  dom.window.document.getElementById("login-password").value = "Secret1!";
  dom.window.document.getElementById("loginForm").requestSubmit();

  await waitFor(() => sessionCalls === 2, dom);
  assert.equal(dom.window.document.getElementById("legalAcceptanceGate").hidden, true);

  resolveSession({
    authenticated: true,
    user: { id: "u1", email },
    profile: { email },
    legal: { currentVersion: "1.0", acceptedVersion: "1.0", acceptanceRequired: false },
  });
  await waitFor(() => dom.window.document.getElementById("inventoryView").hidden === false, dom);
});

test("akceptacja dokumentów przenosi użytkownika do Magazynu", async (t) => {
  let accepted = false;
  const dom = loadApp({
    session: {
      authenticated: true,
      user: { id: "u1", email: "jan@example.test" },
      profile: { email: "jan@example.test" },
      legal: { currentVersion: "1.0", acceptedVersion: null, acceptanceRequired: true },
    },
    onRequest: async ({ pathname }) => {
      if (pathname === "/api/auth/session") {
        return {
          authenticated: true,
          user: { id: "u1", email: "jan@example.test" },
          profile: { email: "jan@example.test" },
          legal: { currentVersion: "1.0", acceptedVersion: accepted ? "1.0" : null, acceptanceRequired: !accepted },
        };
      }
      if (pathname === "/api/legal/acceptance") {
        accepted = true;
        return {};
      }
      if (pathname === "/api/yarns") return [];
      return undefined;
    },
  });
  t.after(() => dom.window.close());

  await waitFor(() => dom.window.document.getElementById("legalAcceptanceGate").hidden === false, dom);
  const terms = dom.window.document.getElementById("legal-acceptance-terms");
  terms.checked = true;
  dom.window.document.getElementById("legalAcceptanceForm").requestSubmit();

  await waitFor(() => dom.requests.filter(({ pathname }) => pathname === "/api/auth/session").length >= 2, dom);
  await waitFor(() => dom.window.document.getElementById("inventoryView").hidden === false, dom);
});

test("rejestracja z akceptacją formularza przechodzi do Magazynu", async (t) => {
  let registered = false;
  const dom = loadApp({
    url: `http://localhost/?invitation=${"A".repeat(64)}`,
    onRequest: async ({ pathname }) => {
      if (pathname === "/api/auth/register") {
        registered = true;
        return { user: { id: "u2", email: "nowy@example.test" } };
      }
      if (pathname === "/api/auth/session") {
        return registered
          ? {
            authenticated: true,
            user: { id: "u2", email: "nowy@example.test" },
            profile: { email: "nowy@example.test" },
            legal: { currentVersion: "1.0", acceptedVersion: "1.0", acceptanceRequired: false },
          }
          : { authenticated: false, user: null };
      }
      if (pathname === "/api/yarns") return [];
      return undefined;
    },
  });
  t.after(() => dom.window.close());

  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));
  const document = dom.window.document;
  document.getElementById("registerModeBtn").click();
  document.getElementById("register-login").value = "nowy@example.test";
  document.getElementById("register-password").value = "Secret1!";
  document.getElementById("register-terms-accepted").checked = true;
  document.getElementById("registerForm").requestSubmit();

  await waitFor(() => dom.requests.filter(({ pathname }) => pathname === "/api/auth/session").length >= 2, dom);
  await waitFor(() => document.getElementById("inventoryView").hidden === false, dom);
});

test("powrót do Konta po logowaniu nie zachowuje ogólnego komunikatu sukcesu", async (t) => {
  const email = "jan@example.test";
  let authenticated = false;
  const dom = loadApp({
    onRequest: ({ pathname }) => {
      if (pathname === "/api/auth/login") {
        authenticated = true;
        return { user: { id: "u1", email } };
      }
      if (pathname === "/api/auth/session") {
        return authenticated
          ? {
            authenticated: true,
            user: { id: "u1", email },
            profile: { email },
            legal: { currentVersion: "1.0", acceptedVersion: "1.0", acceptanceRequired: false },
          }
          : { authenticated: false, user: null };
      }
      return undefined;
    },
  });
  const { document } = dom.window;
  t.after(() => dom.window.close());

  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));
  document.getElementById("login-email").value = email;
  document.getElementById("login-password").value = "Secret1!";
  document.getElementById("loginForm").requestSubmit();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

  document.querySelector('[data-view-target="account"]').click();

  assert.equal(document.getElementById("accountView").hidden, false);
  assert.equal(document.getElementById("authMessage").textContent, "");
});

test("aplikacja uruchamia się bez promocyjnego CTA w hero Konta", async () => {
  const dom = loadApp();
  await waitFor(() => /Możesz założyć konto lub zalogować się\./.test(
    dom.window.document.getElementById("authMessage").textContent,
  ), dom);

  assert.ok(dom.window.document.getElementById("heroTitle"));
  assert.ok(dom.window.document.getElementById("accountThemeImage"));
  assert.equal(dom.window.document.getElementById("heroAuthBtn"), null);
  dom.window.close();
});

test("niezalogowany użytkownik może przejść do rejestracji bez linku zaproszenia", async () => {
  const invitation = "A".repeat(64);
  const dom = loadApp({ url: `http://localhost/?invitation=${invitation}` });

  try {
    await waitFor(() => dom.window.document.getElementById("loginForm").hidden === false, dom);

    assert.equal(dom.window.document.getElementById("registerForm").hidden, true);
    dom.window.document.getElementById("registerModeBtn").click();
    assert.equal(dom.window.document.getElementById("registerForm").hidden, false);
  } finally {
    dom.window.close();
  }
});

test("rejestracja bez tokenu wysyła żądanie API", async () => {
  const dom = loadApp();

  try {
    await waitFor(() => /Możesz założyć konto lub zalogować się\./.test(
      dom.window.document.getElementById("authMessage").textContent,
    ), dom);

    const document = dom.window.document;
    document.getElementById("registerModeBtn").click();
    document.querySelector('#registerForm [name="login"]').value = "jan@example.test";
    document.querySelector('#registerForm [name="password"]').value = "Haslo123!";
    document.querySelector('#registerForm [name="termsAccepted"]').checked = true;
    document.getElementById("registerForm").dispatchEvent(new dom.window.Event("submit", {
      bubbles: true,
      cancelable: true,
    }));
    await waitFor(() => dom.requests.some(({ pathname }) => pathname === "/api/auth/register"), dom);

    const registerRequest = dom.requests.find(({ pathname }) => pathname === "/api/auth/register");
    const payload = JSON.parse(registerRequest.options.body);
    assert.equal(payload.login, "jan@example.test");
    assert.equal(Object.hasOwn(payload, "invitationToken"), false);
  } finally {
    dom.window.close();
  }
});
