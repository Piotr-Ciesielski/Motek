const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const expected = "2.0.0-alpha.38";

test("publikowane pliki wskazują jedną wersję alpha.38", () => {
  const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  const packageJson = require(path.join(root, "package.json"));
  const lock = require(path.join(root, "package-lock.json"));
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

  assert.equal(version, expected);
  assert.equal(packageJson.version, expected);
  assert.equal(lock.version, expected);
  assert.equal(lock.packages[""].version, expected);
  assert.doesNotMatch(html, /2\.0\.0-alpha\.37/);
  // The catalog controller is a versioned browser asset loaded alongside app.js.
  assert.equal((html.match(/2\.0\.0-alpha\.38/g) || []).length, 6);
});
