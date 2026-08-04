const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const indexHtml = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const stylesCss = readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const appJs = readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const staticFilesJs = readFileSync(path.join(__dirname, "..", "server", "static-files.js"), "utf8");

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
    /const recoveryHandled = await startPasswordRecovery\(\);[\s\S]*await Promise\.all\(\[[\s\S]*initializeCaptcha\(\)/,
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

test("mobile inventory orders stats before stock and artwork", () => {
  assert.match(indexHtml, /class="inventory-stock"/);
  assert.match(
    stylesCss,
    /grid-template-areas:[\s\S]*"heading visual"[\s\S]*"stats visual"[\s\S]*"stock visual"/,
  );
  assert.match(
    stylesCss,
    /@media \(max-width: 980px\)[\s\S]*grid-template-areas:[\s\S]*"heading"[\s\S]*"onboarding"[\s\S]*"stats"[\s\S]*"stock"[\s\S]*"visual"/,
  );
  assert.doesNotMatch(
    stylesCss,
    /inventory-layout__content > section:not\(#onboarding\)[\s\S]{0,120}grid-row: 4/,
  );
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
    2,
  );
  assert.equal(
    (indexHtml.match(/data-dark-src="assets\/night-yarn-cat\.v1\.webp"/g) || []).length,
    2,
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
    /#inventoryView \.inventory-layout__visual img[\s\S]*?object-position: right center;/,
  );
  assert.doesNotMatch(
    stylesCss,
    /#inventoryView \.inventory-layout__visual img[\s\S]*?object-fit: contain;/,
  );
});

test("inventory artwork panel stays within the viewport-sized layout", () => {
  const visualRule = stylesCss.match(
    /#inventoryView \.inventory-layout__visual \{([\s\S]*?)\n\}/,
  )?.[1] ?? "";

  assert.match(visualRule, /height: min\(820px, calc\(100vh - 120px\)\);/);
  assert.doesNotMatch(visualRule, /height: 100%;/);
});
