const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const indexHtml = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const stylesCss = readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const appJs = readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const staticFilesJs = readFileSync(path.join(__dirname, "..", "server", "static-files.js"), "utf8");

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
  const inventoryStock = document.querySelector("#inventoryView .inventory-stock");

  assert.ok(inventoryHeading.contains(document.querySelector("#inventoryMatchBtn")));
  assert.ok(inventoryHeading.contains(document.querySelector("#inventoryAddYarnBtn")));
  assert.ok(precedes(inventoryHeading, inventoryArtwork));
  assert.ok(precedes(inventoryArtwork, inventoryStats));
  assert.ok(precedes(inventoryStats, inventoryStock));

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
  assert.match(indexHtml, /data-dark-src="assets\/night-yarn-cat\.v1\.webp"/);
});

test("niezalogowane Konto pokazuje pełną grafikę kota w obu motywach i biały tekst w dark", () => {
  const document = new JSDOM(indexHtml).window.document;
  const accountView = document.getElementById("accountView");
  const image = document.getElementById("accountThemeImage");

  assert.ok(document.body.classList.contains("auth-logged-out"));
  assert.ok(accountView.classList.contains("account-view"));
  assert.equal(image.dataset.lightSrc, "assets/color-yarn-cat.v1.webp");
  assert.equal(image.dataset.darkSrc, "assets/night-yarn-cat.v1.webp");
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
  assert.match(stylesCss, /#accountView\.is-authenticated \.auth-visual\s*\{[\s\S]*?display:\s*none;/);
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
  assert.equal(document.getElementById("accountThemeImage").dataset.darkSrc, "assets/night-yarn-cat.v1.webp");

  assert.equal(matchesCopy.querySelector("#matchesPageTitle").textContent.trim(), "Dopasuj włóczkę");
  assert.equal(matchesCopy.querySelector(".eyebrow"), null);
  assert.equal(matchesCopy.querySelector(".page-heading > div > p"), null);
  assert.doesNotMatch(normalizeText(matchesCopy), /Pomysły z Twojego zapasu/);
  assert.doesNotMatch(normalizeText(matchesCopy), /Ustaw kryteria i zobacz pasujące wzory na żywo\./);
  assert.equal(matchesCopy.querySelector("#backToInventoryBtn").textContent.trim(), "Wróć do magazynu");
  assert.equal(document.getElementById("matchesThemeImage").dataset.darkSrc, "assets/night-yarn-cat.v1.webp");

  assert.equal(catalogCopy.querySelector("#catalogTitle").textContent.trim(), "Katalog wzorów");
  assert.equal(catalogCopy.querySelector(".eyebrow"), null);
  assert.equal(catalogCopy.querySelector("p"), null);
  assert.doesNotMatch(normalizeText(catalogCopy), /Biblioteka inspiracji/);
  assert.doesNotMatch(
    normalizeText(catalogCopy),
    /Znajdź wzór, który pasuje do Twojej włóczki i kolejnego projektu\./,
  );
  assert.equal(document.getElementById("catalogThemeImage").dataset.lightSrc, "assets/color-yarn-cat.v1.webp");
  assert.equal(document.getElementById("catalogThemeImage").dataset.darkSrc, "assets/night-yarn-cat.v1.webp");
});

test("main navigation uses text labels without decorative symbols", () => {
  const navigation = indexHtml.match(/<nav class="app-nav"[\s\S]*?<\/nav>/)?.[0] || "";
  assert.match(navigation, />Magazyn<\/span>/);
  assert.match(navigation, />Dopasowanie<\/span>/);
  assert.match(navigation, />Katalog<\/span>/);
  assert.match(navigation, />Konto<\/span>/);
  assert.doesNotMatch(navigation, /aria-hidden="true"/);
  assert.doesNotMatch(navigation, /[⌂✦▦○]/);
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
  assert.equal(form.getAttribute("autocomplete"), "off");
  assert.equal(current.name, "currentSecret");
  assert.equal(current.autocomplete, "one-time-code");
  assert.equal(current.required, true);
  assert.equal(password.name, "newSecret");
  assert.equal(password.autocomplete, "new-password");
  assert.equal(password.minLength, 8);
  assert.equal(password.maxLength, 256);
  assert.equal(password.required, true);
  assert.equal(confirmation.name, "newSecretConfirmation");
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
  assert.match(appJs, /if \(formValues\.newSecret !== passwordConfirmation\) \{[\s\S]*?setAuthMessage\([^\n]+, "error"\);[\s\S]*?return;/);
  assert.match(appJs, /api\("\/api\/auth\/password\/change", \{[\s\S]*?method: "POST",[\s\S]*?buildAuthPayload\(\{[\s\S]*?currentPassword: formValues\.currentSecret,[\s\S]*?password: formValues\.newSecret,[\s\S]*?captchaToken: captchaTokens\.passwordChange/);
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
  assert.equal((indexHtml.match(/data-turnstile-for=/g) || []).length, 4);
  assert.match(indexHtml, /data-turnstile-for="passwordReset"/);
  assert.match(indexHtml, /data-turnstile-for="passwordChange"/);
  assert.match(appJs, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
});

test("inventory stats update together with the existing summary", () => {
  assert.match(appJs, /const inventoryStats = document\.getElementById\("inventoryStats"\)/);
  assert.match(appJs, /inventoryStats\?\.replaceChildren/);
  assert.match(appJs, /inventoryAddYarnBtn\.addEventListener/);
});

test("catalog controller asset has a deployment cache buster", () => {
  assert.match(
    indexHtml,
    /client\/catalog-controller\.js\?v=2\.0\.0-alpha\.38&rev=[a-f0-9]{7,40}/,
  );
});

test("theme artwork uses optimized immutable assets", () => {
  assert.equal(
    (indexHtml.match(/data-light-src="assets\/color-yarn-cat\.v1\.webp"/g) || []).length,
    4,
  );
  assert.equal(
    (indexHtml.match(/data-dark-src="assets\/night-yarn-cat\.v1\.webp"/g) || []).length,
    4,
  );
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
  assert.equal(secondary.querySelectorAll("select").length, 5);
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
