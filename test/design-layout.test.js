const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const indexHtml = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const stylesCss = readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const appJs = readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const serverJs = readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

test("inventory keeps the selected design composition", () => {
  assert.match(indexHtml, /class="inventory-layout"/);
  assert.match(indexHtml, /class="inventory-layout__visual"/);
  assert.match(indexHtml, /id="inventoryStats"/);
  assert.match(indexHtml, /id="inventoryAddYarnBtn"/);
  assert.match(indexHtml, /data-light-src="assets\/color-yarn-cat\.v1\.webp"/);
  assert.match(indexHtml, /data-dark-src="assets\/night-yarn-cat\.v1\.webp"/);
});

test("light and dark variants define the prototype layout rules", () => {
  assert.match(stylesCss, /\[data-theme="light"\] \.app-header/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.app-header/);
  assert.match(stylesCss, /#inventoryView \.inventory-layout/);
  assert.match(stylesCss, /grid-template-rows: auto auto minmax\(600px, auto\)/);
  assert.match(stylesCss, /grid-row: 1 \/ span 3/);
  assert.match(stylesCss, /object-position: center/);
});

test("inventory stats update together with the existing summary", () => {
  assert.match(appJs, /const inventoryStats = document\.getElementById\("inventoryStats"\)/);
  assert.match(appJs, /inventoryStats\?\.replaceChildren/);
  assert.match(appJs, /inventoryAddYarnBtn\.addEventListener/);
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
  assert.match(serverJs, /"\.webp": "image\/webp"/);
  assert.match(serverJs, /public, max-age=31536000, immutable/);
  assert.match(serverJs, /url\.pathname === "\/assets\/color-yarn-cat\.v1\.webp"/);
  assert.match(serverJs, /url\.pathname === "\/assets\/night-yarn-cat\.v1\.webp"/);
});

test("inventory artwork shows the full image without crop", () => {
  assert.match(
    stylesCss,
    /#inventoryView \.inventory-layout__visual img[\s\S]*?object-fit: contain;/,
  );
  assert.match(
    stylesCss,
    /#inventoryView \.inventory-layout__visual img[\s\S]*?object-position: center;/,
  );
});

test("inventory artwork panel stays within the viewport-sized layout", () => {
  const visualRule = stylesCss.match(
    /#inventoryView \.inventory-layout__visual \{([\s\S]*?)\n\}/,
  )?.[1] ?? "";

  assert.match(visualRule, /height: min\(820px, calc\(100vh - 120px\)\);/);
  assert.doesNotMatch(visualRule, /height: 100%;/);
});
