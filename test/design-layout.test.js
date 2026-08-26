const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const indexHtml = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const stylesCss = readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const appJs = readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const staticFilesJs = readFileSync(path.join(__dirname, "..", "server", "static-files.js"), "utf8");

test("pola długości i wagi wymagają dodatnich liczb całkowitych", () => {
  const document = new JSDOM(indexHtml).window.document;
  const template = document.getElementById("yarnTemplate");
  for (const [field, unit] of [["length", "m"], ["weight", "g"]]) {
    const input = template.content.querySelector(`[data-field="${field}"]`);
    assert.equal(input.type, "number");
    assert.equal(input.min, "1");
    assert.equal(input.step, "1");
    assert.equal(input.max, "1000000");
    assert.match(input.getAttribute("aria-describedby") || "", new RegExp(`${field}-error`));
    assert.equal(input.nextElementSibling.dataset.fieldError, field);
    assert.match(input.nextElementSibling.textContent, new RegExp(unit === "m" ? "metr" : "gram"));
  }
});

test("mobile reading order keeps hero actions and artwork before each workspace", () => {
  const document = new JSDOM(indexHtml).window.document;
  const precedes = (first, second) => Boolean(
    first.compareDocumentPosition(second) & first.DOCUMENT_POSITION_FOLLOWING
  );

  const inventoryHero = document.querySelector("#inventoryView .inventory-hero");
  assert.ok(inventoryHero, "inventory hero groups its heading, actions, and artwork");
  const inventoryHeading = inventoryHero.querySelector(".inventory-heading");
  const inventoryArtwork = inventoryHero.querySelector(".inventory-layout__visual");
  const inventoryStats = document.querySelector("#inventoryStats");
  const inventoryMap = document.querySelector("#inventoryMapView");
  const inventoryStock = document.querySelector("#inventoryView .inventory-stock");

  assert.ok(inventoryHeading.contains(document.querySelector("#inventoryMatchBtn")));
  assert.ok(inventoryMap.contains(document.querySelector("#inventoryAddYarnBtn")));
  assert.ok(precedes(inventoryHeading, inventoryArtwork));
  assert.ok(precedes(inventoryArtwork, inventoryStats));
  assert.ok(precedes(inventoryStats, inventoryMap));
  assert.ok(precedes(inventoryMap, inventoryStock));

  const matchesHero = document.querySelector("#matchesView .matches-hero");
  const matchesCopy = matchesHero.querySelector(".matches-hero__copy");
  const matchesArtwork = matchesHero.querySelector(".matches-hero__visual");
  const matchesWorkspace = document.querySelector("#matchesView .matches-workspace");
  assert.ok(matchesWorkspace, "matches view exposes criteria and results as one workspace");
  const matchesCriteria = matchesWorkspace.querySelector(".matches-criteria");
  const matchesResults = matchesWorkspace.querySelector(".matches-results");

  assert.ok(matchesCopy.contains(document.querySelector("#backToInventoryBtn")));
  assert.ok(precedes(matchesCopy, matchesArtwork));
  assert.ok(precedes(matchesHero, matchesWorkspace));
  assert.ok(precedes(matchesCriteria, matchesResults));
  assert.ok(matchesResults.contains(document.querySelector("#results")));
});

test("inventory keeps the selected design composition", () => {
  assert.match(indexHtml, /class="inventory-layout"/);
  assert.match(indexHtml, /class="inventory-layout__visual"/);
  assert.match(indexHtml, /id="inventoryStats"/);
  assert.match(indexHtml, /id="inventoryAddYarnBtn"/);
  assert.match(indexHtml, /data-light-src="assets\/color-yarn-cat\.v1\.webp"/);
  assert.match(indexHtml, /id="inventoryThemeImage"[\s\S]*?data-dark-src="assets\/night-yarn-cat\.v2\.webp"/);
});

test("inventory map keeps one detail sheet, the full list and protected hooks", () => {
  const document = new JSDOM(indexHtml).window.document;
  const mapView = document.getElementById("inventoryMapView");
  const fullView = document.getElementById("inventoryFullView");

  assert.ok(mapView);
  assert.ok(fullView);
  assert.ok(mapView.contains(document.getElementById("inventoryYarnMap")));
  assert.ok(mapView.contains(document.getElementById("inventoryYarnDetails")));
  assert.ok(mapView.contains(document.getElementById("inventoryAddYarnBtn")));
  assert.equal(document.querySelectorAll("#inventoryYarnDetails").length, 1);
  assert.equal(document.getElementById("showFullInventoryBtn").textContent.trim(), "Pokaż cały schowek");
  assert.ok(fullView.contains(document.getElementById("showInventoryMapBtn")));
  assert.ok(fullView.contains(document.getElementById("yarnList")));
  assert.equal(document.getElementById("addYarnBtn").hidden, true);
  for (const id of ["inventoryView", "inventoryStats", "yarnList", "inventoryAddYarnBtn", "addYarnBtn", "onboarding"]) {
    assert.ok(document.getElementById(id), `brak chronionego hooka #${id}`);
  }
  assert.match(stylesCss, /@media \(max-width: 768px\)[\s\S]*?\.inventory-yarn-map[\s\S]*?grid-template-columns:\s*1fr;/);
});

test("inventory add node ends the yarn path without overlaying its content", () => {
  const document = new JSDOM(indexHtml).window.document;
  const addNode = document.getElementById("inventoryAddYarnBtn");
  const path = addNode.parentElement;
  const addRule = stylesCss.match(/\.inventory-map-add\s*\{([\s\S]*?)\n\}/)?.[1] || "";

  assert.ok(path.classList.contains("inventory-map-path"));
  assert.equal(path.lastElementChild, addNode);
  assert.ok(path.contains(document.getElementById("inventoryYarnMap")));
  assert.doesNotMatch(addRule, /position:\s*absolute/);
  assert.match(addRule, /min-width:\s*(?:56|\d{3,})px;/);
  assert.match(addRule, /min-height:\s*(?:56|\d{3,})px;/);
});

test("niezalogowane Konto pokazuje pełną grafikę kota w obu motywach i biały tekst w dark", () => {
  const document = new JSDOM(indexHtml).window.document;
  const accountView = document.getElementById("accountView");
  const image = document.getElementById("accountThemeImage");

  assert.ok(document.body.classList.contains("auth-logged-out"));
  assert.ok(accountView.classList.contains("account-view"));
  assert.equal(image.dataset.lightSrc, "assets/color-yarn-cat.v1.webp");
  assert.equal(image.dataset.darkSrc, "assets/night-yarn-cat.v2.webp");
  assert.match(
    stylesCss,
    /\.auth-logged-out #accountView \.auth-visual > \.auth-visual__image\s*\{[\s\S]*?opacity:\s*1;/,
  );
  assert.match(
    stylesCss,
    /\[data-theme="dark"\] \.auth-logged-out #accountView \.auth-visual\s*\{[\s\S]*?color:\s*#fff;/,
  );
  assert.match(
    stylesCss,
    /\[data-theme="dark"\] \.auth-logged-out #accountView \.auth-visual h1[\s\S]*?color:\s*#fff;/,
  );
});

test("Konto zachowuje jeden arkusz, jednego kota i wszystkie chronione formularze", () => {
  const dom = new JSDOM(indexHtml, { pretendToBeVisual: true });
  const { document } = dom.window;
  const account = document.getElementById("accountView");
  const layout = account.querySelector(".auth-layout");
  const sheet = account.querySelector(".account-sheet");
  const visual = account.querySelector(".auth-visual");
  const style = document.createElement("style");
  style.textContent = stylesCss;
  document.head.appendChild(style);

  assert.equal(account.querySelectorAll(".account-sheet").length, 1);
  assert.equal(account.querySelectorAll("img").length, 1);
  assert.equal(layout.children[0], visual);
  assert.equal(layout.children[1], sheet);
  for (const id of [
    "authForms",
    "passwordResetForm",
    "passwordUpdateForm",
    "authLoggedIn",
    "idleSessionWarning",
    "authMessage",
  ]) {
    assert.ok(sheet.contains(document.getElementById(id)), `#${id} pozostaje w arkuszu`);
  }

  account.classList.add("is-authenticated");
  assert.notEqual(dom.window.getComputedStyle(visual).display, "none");
  assert.ok(
    document.getElementById("legalAcceptanceGate").compareDocumentPosition(
      document.getElementById("authProfileSummary"),
    ) & visual.DOCUMENT_POSITION_FOLLOWING,
    "legal gate poprzedza tożsamość",
  );
  assert.deepEqual(
    [...account.querySelectorAll(".account-legal-links a")].map((link) => link.getAttribute("href")),
    [
      "/informacje-prawne#regulamin",
      "/informacje-prawne#prywatnosc",
      "/informacje-prawne#prawa-autorskie",
    ],
  );
  assert.equal(document.getElementById("deleteAccountDisclosure").open, false);

  const contracts = [
    ["loginForm", "post", "/api/auth/login"],
    ["registerForm", "post", "/api/auth/register"],
    ["passwordResetForm", "post", "/api/auth/password-reset-request"],
    ["passwordUpdateForm", "post", "/api/auth/password"],
    ["legalAcceptanceForm", "post", "/api/legal/acceptance"],
    ["changePasswordForm", "post", "/api/auth/password/change"],
    ["deleteAccountForm", "post", "/api/account"],
  ];
  for (const [id, method, action] of contracts) {
    const form = document.getElementById(id);
    assert.equal(form.method, method);
    assert.equal(form.getAttribute("action"), action);
  }
  assert.deepEqual(
    [...account.querySelectorAll(".auth-captcha")].map((captcha) => captcha.dataset.turnstileFor),
    ["login", "register", "passwordReset", "passwordChange", "deleteAccount"],
  );
  assert.equal(document.getElementById("login-password").autocomplete, "current-password");
  assert.equal(document.getElementById("register-password").autocomplete, "new-password");
  assert.equal(document.getElementById("update-password").autocomplete, "new-password");
  assert.equal(document.getElementById("change-current-password").name, "currentPassword");
  assert.equal(document.getElementById("change-password-confirmation").name, "passwordConfirmation");
  assert.equal(document.getElementById("account-delete-password").autocomplete, "current-password");
  assert.equal(document.getElementById("account-delete-confirmation").name, "confirmation");
  assert.match(document.getElementById("deleteAccountForm").textContent, /USUŃ KONTO/);
  dom.window.close();
});

test("hero zachowują tylko wskazane nagłówki, akcje i grafiki", () => {
  const document = new JSDOM(indexHtml).window.document;
  const normalizeText = (element) => element.textContent.replace(/\s+/g, " ").trim();
  const accountHero = document.querySelector("#accountView .auth-visual");
  const matchesHero = document.querySelector("#matchesView .matches-hero");
  const matchesCopy = matchesHero.querySelector(".matches-hero__copy");
  const catalogHero = document.querySelector("#catalogView .catalog-hero");
  const catalogCopy = catalogHero.querySelector(".catalog-hero__copy");

  assert.equal(accountHero.querySelector("#heroTitle").textContent.trim(), "Twoja włóczka ma już swój następny projekt");
  assert.equal(accountHero.querySelector(".auth-visual__brand"), null);
  assert.equal(accountHero.querySelector(".lead"), null);
  assert.equal(accountHero.querySelector("#heroAuthBtn"), null);
  assert.equal([...accountHero.children].some((element) => normalizeText(element) === "Motek"), false);
  assert.doesNotMatch(
    normalizeText(accountHero),
    /Uporządkuj domowy zapas, znajdź pasujący wzór i wróć do tego, co najprzyjemniejsze — tworzenia\./,
  );
  assert.doesNotMatch(normalizeText(accountHero), /Zacznij w Motku/);
  assert.equal(document.getElementById("accountThemeImage").dataset.lightSrc, "assets/color-yarn-cat.v1.webp");
  assert.equal(document.getElementById("accountThemeImage").dataset.darkSrc, "assets/night-yarn-cat.v2.webp");

  assert.equal(matchesCopy.querySelector("#matchesPageTitle").textContent.trim(), "To pasuje do Twoich motków");
  assert.equal(matchesCopy.querySelector(".eyebrow"), null);
  assert.equal(matchesCopy.querySelector(".page-heading > div > p"), null);
  assert.doesNotMatch(normalizeText(matchesCopy), /Pomysły z Twojego zapasu/);
  assert.doesNotMatch(normalizeText(matchesCopy), /Ustaw kryteria i zobacz pasujące wzory na żywo\./);
  assert.equal(matchesCopy.querySelector("#backToInventoryBtn").textContent.trim(), "Wróć do magazynu");
  assert.equal(document.getElementById("matchesThemeImage").dataset.darkSrc, "assets/night-yarn-cat.v2.webp");

  assert.equal(catalogCopy.querySelector("#catalogTitle").textContent.trim(), "Wzory, które zjadają zapasy");
  assert.equal(catalogCopy.querySelector(".eyebrow"), null);
  assert.equal(catalogCopy.querySelector("p"), null);
  assert.doesNotMatch(normalizeText(catalogCopy), /Biblioteka inspiracji/);
  assert.doesNotMatch(
    normalizeText(catalogCopy),
    /Znajdź wzór, który pasuje do Twojej włóczki i kolejnego projektu\./,
  );
  assert.equal(document.getElementById("catalogThemeImage").dataset.lightSrc, "assets/color-yarn-cat.v1.webp");
  assert.equal(document.getElementById("catalogThemeImage").dataset.darkSrc, "assets/night-yarn-cat.v2.webp");
});

test("wszystkie ekrany używają zaakceptowanego ciemnego kadru v2", () => {
  const document = new JSDOM(indexHtml).window.document;
  const themedImages = [...document.querySelectorAll("img[data-dark-src]")];

  assert.equal(themedImages.length, 4);
  assert.equal(
    themedImages.every((image) => image.dataset.darkSrc === "assets/night-yarn-cat.v2.webp"),
    true,
  );
});

test("nagłówek zachowuje produkcyjny przycisk logowania i wylogowania", () => {
  const document = new JSDOM(indexHtml).window.document;
  const action = document.getElementById("headerAuthAction");

  assert.ok(action, "nagłówek ma przycisk auth");
  assert.equal(action.type, "button");
  assert.equal(action.textContent.trim(), "Zaloguj");
  assert.match(appJs, /headerAuthAction\.addEventListener\("click", \(\) => \{[\s\S]*?logoutBtn\.click\(\);/);
  assert.match(appJs, /headerAuthAction\.textContent = authenticated \? "Wyloguj" : "Zaloguj";/);
});

test("karta Konta zachowuje produkcyjny zwijany panel usuwania konta", () => {
  const document = new JSDOM(indexHtml).window.document;
  const disclosure = document.getElementById("deleteAccountDisclosure");
  const form = document.getElementById("deleteAccountForm");

  assert.ok(disclosure, "usuwanie konta jest w panelu disclosure");
  assert.equal(disclosure.tagName, "DETAILS");
  assert.ok(disclosure.querySelector("summary"));
  assert.equal(form.closest("#deleteAccountDisclosure"), disclosure);
  assert.match(stylesCss, /account-danger-disclosure/);
});

test("auth forms never fall back to GET query strings", () => {
  assert.match(
    indexHtml,
    /<form id="loginForm"[^>]*method="post"[^>]*action="\/api\/auth\/login"/,
  );
  assert.match(
    indexHtml,
    /<form id="registerForm"[^>]*method="post"[^>]*action="\/api\/auth\/register"/,
  );
  assert.match(
    indexHtml,
    /<form id="passwordResetForm"[^>]*method="post"[^>]*action="\/api\/auth\/password-reset-request"/,
  );
  assert.match(
    indexHtml,
    /<form id="passwordUpdateForm"[^>]*method="post"[^>]*action="\/api\/auth\/password"/,
  );
});

test("captcha initializes even when the page opens from password recovery", () => {
  assert.match(
    appJs,
    /const recoveryHandled = await startPasswordRecovery\(\);[\s\S]*await initializeCaptcha\([\s\S]*const session = await refreshAuthSession\(\)/,
  );
  assert.doesNotMatch(appJs, /const recoveryHandled = await startPasswordRecovery\(\);\s*if \(recoveryHandled\) return;/);
});

test("password recovery exchanges only a one-time code while signup handles URL tokens", () => {
  assert.match(appJs, /const code = query\.get\("code"\)/);
  assert.match(appJs, /const accessToken = hash\.get\("access_token"\)/);
  assert.match(appJs, /const refreshToken = hash\.get\("refresh_token"\)/);
  assert.match(appJs, /hash\.get\("type"\) === "recovery"/);
  assert.match(appJs, /const recoveryBody = code[\s\S]*?body: JSON\.stringify\(recoveryBody\)/);
  assert.match(appJs, /hash\.get\("access_token"\)/);
  assert.match(appJs, /access_token: accessToken/);
});

test("email confirmation removes signup tokens from the address", () => {
  assert.match(appJs, /hash\.get\("type"\) === "signup"/);
  assert.match(appJs, /api\("\/api\/auth\/confirmation"/);
});

test("inventory and matches artwork have no caption overlays", () => {
  assert.doesNotMatch(indexHtml, /id="inventoryHeroCaption"/);
  assert.doesNotMatch(indexHtml, /id="matchesHeroCaption"/);
});

test("light and dark variants define the prototype layout rules", () => {
  assert.match(stylesCss, /\[data-theme="light"\] \.app-header/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.app-header/);
  assert.match(stylesCss, /#inventoryView \.inventory-layout/);
  assert.match(stylesCss, /object-position: center/);
});

test("logged-out account keeps the aligned login password control", () => {
  assert.match(
    stylesCss,
    /#loginForm \.password-field input[^{]*\{[\s\S]*?height:\s*44px;[\s\S]*?min-height:\s*44px;/,
  );
});


test("dark hero panel keeps readable text on its dark gradient", () => {
  assert.match(stylesCss, /--on-hero:\s*#f3eadc/);
  assert.match(stylesCss, /\.auth-visual\s*\{[\s\S]*?color:\s*var\(--on-hero\)/);
  assert.match(stylesCss, /\.auth-visual::after\s*\{[\s\S]*?var\(--on-hero\)/);
  assert.match(stylesCss, /\.auth-visual h1\s*\{[\s\S]*?color:\s*var\(--on-hero\)/);
});



test("inventory shelves collapse from two columns to one on mobile", () => {
  assert.match(
    stylesCss,
    /#inventoryView \.yarn-list \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    stylesCss,
    /@media \(max-width: 768px\)[\s\S]*?#inventoryView \.yarn-list \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
});

test("zalogowane konto udostępnia zwinięty formularz zmiany hasła", () => {
  const document = new JSDOM(indexHtml).window.document;
  const loggedIn = document.getElementById("authLoggedIn");
  const security = loggedIn.querySelector("section.account-security-zone");
  const toggle = document.getElementById("changePasswordToggle");
  const form = document.getElementById("changePasswordForm");

  assert.ok(security, "strefa bezpieczeństwa jest w stanie zalogowanym");
  assert.equal(security.getAttribute("aria-labelledby"), "changePasswordTitle");
  assert.ok(toggle, "formularz ma widoczny przycisk otwierający panel");
  assert.equal(toggle.type, "button");
  assert.equal(toggle.getAttribute("aria-controls"), "changePasswordForm");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.ok(form);
  assert.equal(form.hidden, true);
  assert.equal(form.method, "post");
  assert.equal(form.getAttribute("action"), "/api/auth/password/change");
});

test("formularz zmiany hasła ma kontrakt pól i nie zmienia recovery", () => {
  const document = new JSDOM(indexHtml).window.document;
  const form = document.getElementById("changePasswordForm");
  const current = document.getElementById("change-current-password");
  const password = document.getElementById("change-password");
  const confirmation = document.getElementById("change-password-confirmation");
  const recovery = {
    reset: document.getElementById("passwordResetForm"),
    update: document.getElementById("passwordUpdateForm"),
  };

  assert.equal(form.closest("#authLoggedIn"), document.getElementById("authLoggedIn"));
  assert.equal(current.name, "currentPassword");
  assert.equal(current.autocomplete, "current-password");
  assert.equal(current.required, true);
  assert.equal(password.name, "password");
  assert.equal(password.autocomplete, "new-password");
  assert.equal(password.minLength, 8);
  assert.equal(password.maxLength, 256);
  assert.equal(password.required, true);
  assert.equal(confirmation.name, "passwordConfirmation");
  assert.equal(confirmation.autocomplete, "new-password");
  assert.equal(confirmation.minLength, 8);
  assert.equal(confirmation.maxLength, 256);
  assert.equal(confirmation.required, true);
  assert.ok(password.getAttribute("aria-describedby"));
  assert.ok(confirmation.getAttribute("aria-describedby"));
  assert.match(form.textContent, /hasła są zgodne|hasła nie są zgodne/i);
  assert.equal(form.querySelector('button[type="submit"]').textContent.trim(), "Zmień hasło");
  assert.equal(recovery.reset.getAttribute("action"), "/api/auth/password-reset-request");
  assert.equal(recovery.update.getAttribute("action"), "/api/auth/password");
});

test("formularz zmiany hasła używa tej samej ikony oka co logowanie", () => {
  const document = new JSDOM(indexHtml).window.document;
  const loginIcon = document.querySelector("#loginForm [data-password-reveal] svg");
  const changePasswordForm = document.getElementById("changePasswordForm");
  const revealButtons = [...changePasswordForm.querySelectorAll("[data-password-reveal]")];

  assert.ok(loginIcon, "logowanie ma wzorcową ikonę oka");
  assert.equal(revealButtons.length, 3);
  assert.deepEqual(
    revealButtons.map((button) => button.querySelector("svg")?.outerHTML.replace(/\s+/g, " ").trim()),
    revealButtons.map(() => loginIcon.outerHTML.replace(/\s+/g, " ").trim()),
  );
});

test("pola formularza zmiany hasła mają 44 px wysokości i dokładny hint", () => {
  const document = new JSDOM(indexHtml).window.document;
  const changePasswordForm = document.getElementById("changePasswordForm");
  const inputs = changePasswordForm.querySelectorAll(".password-field input");

  assert.equal(inputs.length, 3);
  assert.equal(
    document.getElementById("changePasswordHint").textContent,
    "Nowe hasło: minimum 8 znaków, w tym mała i wielka litera, cyfra oraz znak specjalny.",
  );
  assert.match(
    stylesCss,
    /#loginForm \.password-field input,[\s\S]*?\.account-security-zone__panel \.password-field input\s*\{[\s\S]*?height:\s*44px;[\s\S]*?min-height:\s*44px;/,
  );
});

test("frontend obsługuje panel zmiany hasła bez wysyłania potwierdzenia", () => {
  assert.match(appJs, /const changePasswordToggle = document\.getElementById\("changePasswordToggle"\)/);
  assert.match(appJs, /changePasswordToggle\.addEventListener\("click", \(\) => \{[\s\S]*?changePasswordForm\.hidden = !isOpen;[\s\S]*?changePasswordToggle\.setAttribute\("aria-expanded", String\(isOpen\)\);/);
  assert.match(appJs, /changePasswordToggle\.textContent = isOpen \? "Anuluj" : "Zmień hasło";/);
  assert.match(appJs, /changePasswordToggle\.addEventListener\("click", \(\) => \{[\s\S]*?if \(!isOpen\) \{[\s\S]*?changePasswordForm\.reset\(\);[\s\S]*?\}[\s\S]*?changePasswordForm\.hidden = !isOpen;/);
  assert.match(appJs, /const passwordConfirmation = body\.passwordConfirmation;[\s\S]*?if \(body\.password !== passwordConfirmation\) \{[\s\S]*?setAuthMessage\([^\n]+, "error"\);[\s\S]*?focus\(\);[\s\S]*?return;/);
  assert.match(appJs, /api\("\/api\/auth\/password\/change", \{[\s\S]*?method: "POST",[\s\S]*?buildAuthPayload\(\{[\s\S]*?currentPassword: body\.currentPassword,[\s\S]*?password: body\.password[\s\S]*?captchaEnabled: authCaptchaConfig\.[\s\S]*?captchaToken: captchaTokens\.passwordChange/);
  assert.match(appJs, /finally \{[\s\S]*?resetCaptchaForForm\(changePasswordForm\);[\s\S]*?setAuthBusy\(changePasswordForm, false\);/);
});

test("ukryte formularze logowania są wyłączane dla menedżera haseł", () => {
  assert.match(appJs, /function setAuthFormDisabled\(form, disabled\)/);
  assert.match(appJs, /candidate\.hidden = candidate !== form;[\s\S]*?setAuthFormDisabled\(candidate, candidate !== form\);/);
  assert.match(appJs, /authLoggedIn\.hidden = !authenticated;[\s\S]*?setAuthFormDisabled\(form, authenticated\);/);
});

test("403 zmiany hasła wyjaśnia błąd bieżącego hasła", () => {
  const changePasswordHandler = appJs.match(
    /changePasswordForm\.addEventListener\("submit",[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(changePasswordHandler);
  assert.match(changePasswordHandler, /error\.status === 403[\s\S]*?Bieżące hasło jest nieprawidłowe/);
  assert.match(changePasswordHandler, /error\.status === 401[\s\S]*?Sesja wygasła\. Zaloguj się ponownie\./);
});

test("wylogowanie resetuje i zamyka panel zmiany hasła", () => {
  const renderAuthState = appJs.match(
    /function renderAuthState\(payload\) \{[\s\S]*?\r?\n\}\r?\n\r?\nasync function refreshAuthSession/,
  )?.[0];

  assert.ok(renderAuthState, "renderAuthState jest dostępne w kodzie aplikacji");
  assert.match(
    renderAuthState,
    /if \(!authenticated\) \{[\s\S]*?changePasswordForm\.reset\(\);[\s\S]*?changePasswordForm\.hidden = true;[\s\S]*?changePasswordToggle\.setAttribute\("aria-expanded", "false"\);/,
  );
});

test("błąd 503 zmiany hasła wylogowuje i pokazuje bezpieczny komunikat logowania", () => {
  const changePasswordHandler = appJs.match(
    /changePasswordForm\.addEventListener\("submit",[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(changePasswordHandler, "handler zmiany hasła jest dostępny w kodzie aplikacji");
  const unavailableBranch = changePasswordHandler.match(
    /if \(error\s+instanceof\s+ApiError\s+&&\s+error\.status\s+===\s+503\) \{[\s\S]*?\n\s+\}/,
  )?.[0];

  assert.ok(unavailableBranch, "handler rozpoznaje błąd ApiError 503");
  assert.match(unavailableBranch, /changePasswordForm\.reset\(\);/);
  assert.match(unavailableBranch, /changePasswordForm\.hidden = true;/);
  assert.match(unavailableBranch, /changePasswordToggle\.setAttribute\("aria-expanded", "false"\);/);
  assert.match(unavailableBranch, /renderAuthState\(\{ authenticated: false \}\);/);
  assert.match(unavailableBranch, /showAuthForm\(loginForm\);/);
  assert.match(unavailableBranch, /setAuthMessage\(error\.message, "error"\);/);
});

test("callback recovery przyjmuje kod bez markera i usuwa dane adresu", () => {
  assert.match(appJs, /const isHashRecoveryCallback = Boolean\(accessToken && refreshToken && hash\.get\("type"\) === "recovery"\);/);
  assert.match(appJs, /const isRecoveryCallback = \(Boolean\(code\) \|\| isHashRecoveryCallback\)/);
  assert.match(appJs, /if \(!isRecoveryCallback\) \{[\s\S]*?return false;/);
  assert.match(appJs, /window\.history\.replaceState\(\{\}, document\.title, window\.location\.pathname\);[\s\S]*?await api\("\/api\/auth\/recovery"/);
});

test("reset hasła odświeża CAPTCHA po każdej próbie", () => {
  assert.match(appJs, /passwordResetForm\.addEventListener\("submit",[\s\S]*?finally \{[\s\S]*?resetCaptchaForForm\(passwordResetForm\);[\s\S]*?setAuthBusy\(passwordResetForm, false\);/);
});

test("style zmiany hasła jest ograniczony do strefy bezpieczeństwa", () => {
  assert.match(stylesCss, /\.account-security-zone\s*\{/);
  assert.match(stylesCss, /\.account-security-zone[\s\S]*?\.account-security-zone__panel/);
  assert.doesNotMatch(stylesCss, /#changePasswordForm\s*\{/);
});

test("rejestracja wymaga regulaminu, wersji dokumentu i tokenu zaproszenia", () => {
  const document = new JSDOM(indexHtml).window.document;
  const checkbox = document.querySelector('#registerForm [name="termsAccepted"]');

  assert.ok(checkbox, "formularz rejestracji ma checkbox regulaminu");
  assert.equal(checkbox.required, true);
  assert.equal(checkbox.checked, false);
  assert.ok(document.querySelector('#registerForm [name="invitationToken"]'));
  assert.ok(document.querySelector('#registerForm [name="termsVersion"]'));
  assert.ok(document.querySelector('#registerForm [name="privacyNoticeVersion"]'));
  assert.ok(document.querySelector('#copyrightNotice'));
  assert.equal(document.querySelectorAll('a[href^="/informacje-prawne"]').length >= 3, true);
  assert.match(indexHtml, /legal-document\.js/);
  assert.match(appJs, /formatCopyrightNotice/);
  assert.match(appJs, /copyrightNotice\.textContent/);
  assert.doesNotMatch(indexHtml.toLocaleLowerCase("pl-PL"), /wyrażam zgodę na przetwarzanie/);
});

test("konto zawiera ukryty gate aktualnej akceptacji z drogą wyjścia", () => {
  const document = new JSDOM(indexHtml).window.document;
  const gate = document.getElementById("legalAcceptanceGate");

  assert.ok(gate);
  assert.equal(gate.hidden, true);
  assert.equal(gate.querySelector('[name="termsAccepted"]').required, true);
  assert.ok(gate.querySelector("#legalAcceptanceVersion"));
  assert.ok(gate.querySelector('[role="status"]'));
  assert.equal(gate.querySelector('a[href="#logoutBtn"]').textContent, "Wyloguj się");
  assert.equal(gate.querySelector('a[href="#deleteAccountForm"]').textContent, "usuń konto");
  assert.equal(gate.querySelector("#legalDeleteAccountLink").id, "legalDeleteAccountLink");
  assert.match(appJs, /legalDeleteAccountLink\.addEventListener\("click", \(\) => \{[\s\S]*?deleteAccountDisclosure\.open = true;[\s\S]*?querySelector\("summary"\)\?\.focus\(/);
  assert.equal(document.querySelectorAll("[data-view]").length, 4);
});

test("captcha remains available in every auth flow", () => {
  assert.equal((indexHtml.match(/data-turnstile-for=/g) || []).length, 5);
  assert.match(indexHtml, /data-turnstile-for="deleteAccount"/);
  assert.match(indexHtml, /data-turnstile-for="passwordReset"/);
  assert.match(indexHtml, /data-turnstile-for="passwordChange"/);
  assert.match(appJs, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
});

test("inventory stats update together with the existing summary", () => {
  assert.match(appJs, /const inventoryStats = document\.getElementById\("inventoryStats"\)/);
  assert.match(appJs, /inventoryStats\?\.replaceChildren/);
  assert.match(appJs, /inventoryAddYarnBtn\.addEventListener/);
});

test("versioned assets keep cache busters in sync with file content", () => {
  const contentRev = (relativePath) =>
    createHash("sha256")
      .update(readFileSync(path.join(__dirname, "..", relativePath), "utf8").replace(/\r\n/g, "\n"))
      .digest("hex")
      .slice(0, 7);
  const stylesRev = contentRev("styles.css");
  const controllerRev = contentRev("client/catalog-controller.js");
  assert.ok(
    indexHtml.includes(`href="styles.css?v=2.0.0-alpha.39&rev=${stylesRev}"`),
    "styles.css publikowany jest pod bustereem zgodnym z treścią pliku",
  );
  assert.ok(
    indexHtml.includes(`src="client/catalog-controller.js?v=2.0.0-alpha.39&rev=${controllerRev}"`),
    "catalog-controller.js publikowany jest pod bustereem zgodnym z treścią pliku",
  );
});

test("theme artwork uses optimized immutable assets", () => {
  assert.equal(
    (indexHtml.match(/data-light-src="assets\/color-yarn-cat\.v1\.webp"/g) || []).length,
    4,
  );
  assert.equal(
    (indexHtml.match(/data-dark-src="assets\/night-yarn-cat\.v1\.webp"/g) || []).length,
    0,
  );
  assert.equal((indexHtml.match(/data-dark-src="assets\/night-yarn-cat\.v2\.webp"/g) || []).length, 4);
  assert.match(staticFilesJs, /"\.webp": "image\/webp"/);
  assert.match(staticFilesJs, /public, max-age=31536000, immutable/);
});

test("inventory artwork keeps the prototype crop and focal point", () => {
  assert.match(
    stylesCss,
    /#inventoryView \.inventory-layout__visual img[\s\S]*?object-fit: cover;/,
  );
  assert.match(
    stylesCss,
    /#inventoryView \.inventory-layout__visual img[\s\S]*?object-position: 72% center;/,
  );
  assert.doesNotMatch(
    stylesCss,
    /#inventoryView \.inventory-layout__visual img[\s\S]*?object-fit: contain;/,
  );
});

test("inventory artwork panel follows the panoramic hero height", () => {
  const visualRule = stylesCss.match(
    /#inventoryView \.inventory-layout__visual \{([\s\S]*?)\n\}/,
  )?.[1] ?? "";

  assert.match(visualRule, /height: 100%;/);
  assert.match(visualRule, /min-height: 330px;/);
  assert.match(
    stylesCss,
    /@media \(max-width: 420px\)[\s\S]*?#inventoryView \.inventory-layout__visual,[\s\S]*?height: 220px;[\s\S]*?min-height: 220px;/,
  );
});

function gitBlobHash(file) {
  return execFileSync("git", ["hash-object", file], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
  }).trim();
}

test("krytyczne assety rejestracji mają cache-bustery treści", () => {
  const document = new JSDOM(indexHtml).window.document;
  for (const file of ["client-policy.js", "app.js"]) {
    const asset = document.querySelector(`script[src^="${file}?"]`);
    const url = new URL(asset.getAttribute("src"), "http://localhost");

    assert.equal(url.searchParams.get("rev"), gitBlobHash(file).slice(0, 7));
  }
});

test("catalog keeps search first, secondary filters grouped and artwork before results", () => {
  const document = new JSDOM(indexHtml).window.document;
  const catalog = document.getElementById("catalogView");
  const search = catalog.querySelector(".catalog-search");
  const toggle = document.getElementById("catalogFiltersToggle");
  const secondary = document.getElementById("catalogSecondaryFilters");
  const workspace = catalog.querySelector(".catalog-workspace");

  assert.ok(search.compareDocumentPosition(toggle) & search.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(toggle.compareDocumentPosition(secondary) & toggle.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(secondary.querySelectorAll("select").length, 6);
  assert.ok(catalog.querySelector(".catalog-hero").compareDocumentPosition(workspace)
    & catalog.DOCUMENT_POSITION_FOLLOWING);
});

test("mobile catalog exposes the filter disclosure and shortens the account hero", () => {
  assert.match(
    stylesCss,
    /@media \(max-width: 640px\)[\s\S]*?#catalogView \.catalog-filters-toggle \{[\s\S]*?display: inline-flex;/,
  );
  assert.match(
    stylesCss,
    /@media \(max-width: 640px\)[\s\S]*?\.account-view \.auth-visual \{[\s\S]*?min-height: 220px;/,
  );
});

test("mobile logged-out account does not let disabled navigation cover the auth form", () => {
  assert.match(
    appJs,
    /document\.body\.classList\.toggle\("auth-logged-out", !authenticated\)/,
  );
  assert.match(
    stylesCss,
    /@media \(max-width: 640px\)[\s\S]*?\.auth-logged-out \.app-nav \{[\s\S]*?display: none;/,
  );
});
