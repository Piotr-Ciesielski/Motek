const assert = require("node:assert/strict");
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

test("main navigation uses text labels without decorative symbols", () => {
  const navigation = indexHtml.match(/<nav class="app-nav"[\s\S]*?<\/nav>/)?.[0] || "";
  assert.match(navigation, />Magazyn<\/span>/);
  assert.match(navigation, />Dopasowanie<\/span>/);
  assert.match(navigation, />Katalog<\/span>/);
  assert.match(navigation, />Konto<\/span>/);
  assert.doesNotMatch(navigation, /aria-hidden="true"/);
  assert.doesNotMatch(navigation, /[⌂✦▦○]/);
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
  assert.match(appJs, /body: JSON\.stringify\(\{ code \}\)/);
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
  assert.equal(document.querySelectorAll("[data-view]").length, 4);
});

test("captcha remains available in every auth flow", () => {
  assert.equal((indexHtml.match(/data-turnstile-for=/g) || []).length, 3);
  assert.match(indexHtml, /data-turnstile-for="passwordReset"/);
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
