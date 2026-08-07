const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const indexHtml = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const appJs = readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function createDocument() {
  return new JSDOM(indexHtml).window.document;
}

test("design changes preserve the four routable application views", () => {
  const document = createDocument();
  const views = [...document.querySelectorAll("[data-view]")].map((view) => ({
    id: view.id,
    name: view.dataset.view,
  }));

  assert.deepEqual(views, [
    { id: "accountView", name: "account" },
    { id: "inventoryView", name: "inventory" },
    { id: "matchesView", name: "matches" },
    { id: "catalogView", name: "catalog" },
  ]);
  assert.equal(new Set(views.map(({ id }) => id)).size, views.length);
});

test("design changes preserve text-only navigation destinations", () => {
  const document = createDocument();
  const navigation = [...document.querySelectorAll(".app-nav [data-view-target]")].map((button) => ({
    target: button.dataset.viewTarget,
    label: button.textContent.trim(),
  }));

  assert.deepEqual(navigation, [
    { target: "inventory", label: "Magazyn" },
    { target: "matches", label: "Dopasowanie" },
    { target: "catalog", label: "Katalog" },
    { target: "account", label: "Konto" },
  ]);
  assert.ok(navigation.every(({ label }) => label.length > 0));
});

test("design changes preserve accessible theme control and paired artwork sources", () => {
  const document = createDocument();
  const themeToggle = document.getElementById("themeToggle");
  const themedImages = [...document.querySelectorAll("[data-light-src]")];

  assert.ok(themeToggle);
  assert.equal(themeToggle.getAttribute("type"), "button");
  assert.match(themeToggle.getAttribute("aria-label") || "", /tryb/i);
  assert.match(themeToggle.getAttribute("aria-pressed") || "", /^(true|false)$/);
  assert.ok(themeToggle.querySelector(".theme-toggle__icon"));
  assert.equal(themeToggle.querySelector("#themeToggleLabel"), null);
  assert.ok(themedImages.length >= 4);
  assert.deepEqual(
    ["inventoryThemeImage", "matchesThemeImage", "catalogThemeImage", "accountThemeImage"].map((id) => document.getElementById(id)?.id),
    ["inventoryThemeImage", "matchesThemeImage", "catalogThemeImage", "accountThemeImage"],
  );
  for (const id of ["inventoryThemeImage", "matchesThemeImage", "catalogThemeImage", "accountThemeImage"]) {
    assert.ok(document.getElementById(id).getAttribute("alt"));
    assert.match(appJs, new RegExp(id));
  }

  for (const image of themedImages) {
    assert.ok(image.dataset.darkSrc, `missing dark source for ${image.id}`);
    assert.match(image.dataset.lightSrc, /^assets\/color-yarn-cat\.v1\.webp$/);
    assert.match(image.dataset.darkSrc, /^assets\/night-yarn-cat\.v1\.webp$/);
  }

  assert.match(appJs, /window\.MotekThemePolicy/);
});

test("design changes preserve hooks used by inventory, catalog and account logic", () => {
  const document = createDocument();
  const requiredIds = [
    "inventoryStats",
    "inventoryAddYarnBtn",
    "matchesView",
    "catalogFilters",
    "patternCatalog",
    "accountView",
    "loginForm",
    "registerForm",
  ];

  for (const id of requiredIds) {
    assert.ok(document.getElementById(id), `missing protected DOM hook #${id}`);
  }

  assert.match(indexHtml, /client\/catalog-controller\.js/);
  assert.match(appJs, /catalogController/);
  assert.match(appJs, /inventoryAddYarnBtn\.addEventListener/);
});
