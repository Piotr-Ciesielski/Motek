const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const indexHtml = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const stylesCss = readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const appJs = readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const serverJs = readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
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
    /const recoveryHandled = await startPasswordRecovery\(\);[\s\S]*await initializeCaptcha\(\)/,
  );
  assert.doesNotMatch(appJs, /const recoveryHandled = await startPasswordRecovery\(\);\s*if \(recoveryHandled\) return;/);
});

test("CSP pozwala widgetowi Turnstile komunikować się z Cloudflare", () => {
  assert.match(
    serverJs,
    /connect-src 'self' https:\/\/challenges\.cloudflare\.com https:\/\/fonts\.googleapis\.com/,
  );
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

test("dark hero panel keeps readable text on its dark gradient", () => {
  assert.match(stylesCss, /--on-hero:\s*#f3eadc/);
  assert.match(stylesCss, /\.auth-visual\s*\{[\s\S]*?color:\s*var\(--on-hero\)/);
  assert.match(stylesCss, /\.auth-visual::after\s*\{[\s\S]*?var\(--on-hero\)/);
  assert.match(stylesCss, /\.auth-visual h1\s*\{[\s\S]*?color:\s*var\(--on-hero\)/);
  assert.match(stylesCss, /\.auth-visual \.lead\s*\{[\s\S]*?var\(--on-hero\)/);
  assert.match(stylesCss, /\.hero-cta\s*\{[\s\S]*?color:\s*var\(--on-hero\)/);
  assert.match(stylesCss, /\.hero-cta\s*\{[\s\S]*?color-mix\(in srgb, var\(--on-hero\)/);
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

test("hero copy stays focused and uses the Dopasowanie heading type", () => {
  const document = new JSDOM(indexHtml).window.document;

  assert.equal(document.querySelector("#inventoryView .inventory-heading .eyebrow"), null);
  assert.equal(document.querySelector("#inventoryView .inventory-heading > div:first-child > p:not(.eyebrow)"), null);
  assert.equal(document.querySelector("#matchesView .matches-hero__copy .eyebrow")?.textContent, "Pomysły z Twojego zapasu");
  assert.equal(document.querySelector("#matchesView .matches-hero__copy .page-heading > div > p:not(.eyebrow)")?.textContent, "Ustaw kryteria i zobacz pasujące wzory na żywo.");
  assert.equal(document.querySelector("#catalogView .catalog-hero__copy .eyebrow")?.textContent, "Biblioteka inspiracji");
  assert.equal(document.querySelector("#catalogView .catalog-hero__copy > p:not(.eyebrow)")?.textContent, "Znajdź wzór, który pasuje do Twojej włóczki i kolejnego projektu.");

  assert.doesNotMatch(
    stylesCss,
    /\[data-theme="light"\] #inventoryView h1,[\s\S]*?font-family: "Inter", sans-serif;/,
  );
  assert.match(
    stylesCss,
    /#inventoryView \.inventory-heading h1,\s*#matchesView \.matches-hero__copy h1,\s*#catalogView \.catalog-hero__copy h1\s*\{[\s\S]*?font-family: "Fraunces", serif;/,
  );
});

test("inventory artwork fills the hero without an opaque copy panel", () => {
  assert.match(
    stylesCss,
    /\[data-theme="light"\] #inventoryView \.inventory-heading,[\s\S]*?\[data-theme="dark"\] #inventoryView \.inventory-heading > div:first-child\s*\{[\s\S]*?background: transparent;/,
  );
  assert.match(
    stylesCss,
    /#inventoryView \.inventory-layout__visual img\s*\{[\s\S]*?object-position: 58% center;/,
  );
});

test("inventory hero matches the shared hero height and keeps actions below the title", () => {
  assert.match(
    stylesCss,
    /#inventoryView \.inventory-hero\s*\{[\s\S]*?min-height: clamp\(360px, 36vw, 500px\);/,
  );
  assert.match(
    stylesCss,
    /#inventoryView \.inventory-heading\s*\{[\s\S]*?min-height: clamp\(360px, 36vw, 500px\);[\s\S]*?flex-direction: column;/,
  );
  assert.match(
    stylesCss,
    /#inventoryView \.inventory-heading__actions\s*\{[\s\S]*?margin-top: 30px;[\s\S]*?margin-left: 24px;/,
  );
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
    /client\/catalog-controller\.js\?v=2\.0\.0-alpha\.39&rev=[a-f0-9]{7,40}/,
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
    /(?:^|\n)#inventoryView \.inventory-layout__visual \{([\s\S]*?)\n\}/,
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

test("account keeps only real authentication and account-management surfaces", () => {
  assert.match(indexHtml, /id="accountThemeImage"/);
  assert.match(indexHtml, /id="authLoggedIn"/);
  assert.match(indexHtml, /id="deleteAccountForm"/);
  assert.doesNotMatch(indexHtml, /id="accountProjects"/);
  assert.doesNotMatch(indexHtml, /id="accountMetrics"/);
  assert.doesNotMatch(indexHtml, /data-account-action=/);
});

test("authenticated header and account disclosure use the compact DOM contract", () => {
  const document = new JSDOM(indexHtml).window.document;
  const actions = [...document.querySelectorAll(".app-header__actions > *")];

  assert.deepEqual(actions.map((node) => node.id), ["themeToggle", "headerAuthAction"]);
  assert.equal(document.getElementById("headerAuthAction")?.getAttribute("type"), "button");
  assert.equal(document.getElementById("headerAuthAction")?.textContent.trim(), "Zaloguj");
  assert.equal(document.getElementById("headerUser"), null);
  assert.match(document.getElementById("authProfileSummary").textContent, /Zalogowano jako:/);
  assert.equal(document.querySelector("#authLoggedIn > .auth-message"), null);

  const disclosure = document.getElementById("deleteAccountDisclosure");
  assert.ok(disclosure);
  assert.equal(disclosure.hasAttribute("open"), false);
  assert.equal(disclosure?.tagName, "DETAILS");
  assert.equal(disclosure?.className, "account-danger-disclosure");
  assert.equal(disclosure?.open, false);
  const disclosureSummary = disclosure?.querySelector("summary");
  assert.match(disclosureSummary?.textContent ?? "", /Usuń konto/);
  assert.match(disclosureSummary?.textContent ?? "", /Tej operacji nie można cofnąć\./);
  assert.equal(disclosure?.querySelector("#deleteAccountForm")?.id, "deleteAccountForm");
});

test("compact auth controls expose their required CSS contracts", () => {
  assert.match(stylesCss, /\.header-auth-action[\s\S]*min-(?:width|height): 44px/);
  assert.match(stylesCss, /\.header-auth-action[\s\S]*font-size: 0\.9rem/);
  assert.match(stylesCss, /\.header-auth-action[\s\S]*font-weight: 650/);
  assert.match(stylesCss, /\.header-auth-action[\s\S]*color: var\(--muted\)/);
  assert.match(stylesCss, /\.account-danger-disclosure/);
});

test("authenticated password-change section spans the account grid", () => {
  assert.match(
    stylesCss,
    /#accountView\.is-authenticated \.account-security-zone\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;/,
  );
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
