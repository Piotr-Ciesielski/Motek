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

test("design reference exposes exactly four paired theme artwork hooks", () => {
  const document = createDocument();
  const themedImages = [...document.querySelectorAll("[data-light-src][data-dark-src]")];

  assert.equal(themedImages.length, 4);
  assert.deepEqual(
    themedImages.map((image) => image.id),
    ["accountThemeImage", "inventoryThemeImage", "matchesThemeImage", "catalogThemeImage"],
  );
  for (const image of themedImages) {
    assert.ok(image.dataset.lightSrc, `missing light source for ${image.id}`);
    assert.ok(image.dataset.darkSrc, `missing dark source for ${image.id}`);
  }
});

test("design reference preserves the key functional hook in each visual view", () => {
  const document = createDocument();
  const viewHooks = {
    account: ["#accountThemeImage", "#loginForm", "#registerForm"],
    inventory: ["#inventoryThemeImage", "#inventoryStats", "#inventoryAddYarnBtn"],
    matches: ["#matchesThemeImage"],
    catalog: ["#catalogThemeImage", "#catalogFilters", "#patternCatalog"],
  };

  for (const [viewName, selectors] of Object.entries(viewHooks)) {
    const view = document.querySelector(`[data-view="${viewName}"]`);
    assert.ok(view, `missing reference view ${viewName}`);
    for (const selector of selectors) {
      assert.ok(view.querySelector(selector), `missing ${selector} in ${viewName}`);
    }
  }
});

test("design reference keeps stable layout anchors for all four visual views", () => {
  const document = createDocument();
  const layouts = [
    ["#inventoryView", ".inventory-layout__visual", ".inventory-stats", '[data-design-anchor="shelf-list"]'],
    ["#matchesView", ".matches-hero", '[data-design-anchor="expert-results"]'],
    ["#catalogView", ".catalog-header__visual", '[data-design-anchor="filter-layout"]'],
    ["#accountView", ".auth-visual", '[data-design-anchor="account-panel"]'],
  ];

  for (const [view, ...anchors] of layouts) {
    const root = document.querySelector(view);
    assert.ok(root, `missing reference view ${view}`);

    for (const anchor of anchors) {
      assert.ok(root.querySelector(anchor), `missing ${anchor} in ${view}`);
    }
  }
});

test("design reference exposes the editorial structures for matches, catalog and account", () => {
  const document = createDocument();
  const requiredStructures = {
    matches: ["[data-design-layout=expert]", ".matches-criteria", '[data-match-criterion="project-type"]', "#results"],
    catalog: ["[data-design-layout=library]", "#catalogFilters", "#patternCatalog"],
    account: ["[data-design-layout=dashboard]", ".account-dashboard__profile", ".account-dashboard__security", "#authForms", "#authLoggedIn"],
  };

  for (const [viewName, selectors] of Object.entries(requiredStructures)) {
    const view = document.querySelector(`[data-view="${viewName}"]`);
    assert.ok(view, `missing view ${viewName}`);
    for (const selector of selectors) {
      assert.ok(view.querySelector(selector), `missing ${selector} in ${viewName}`);
    }
  }
});

test("match criteria filter uses normalized requirement weight classes", () => {
  assert.match(appJs, /function readMatchCriteria\(\)/);
  assert.match(appJs, /function filterMatchesByCriteria\(matches\)/);
  assert.match(appJs, /pattern\.matchingRequirements/);
  assert.match(appJs, /requirement\.weightClasses\.includes\(criteria\.weightClass\)/);
  assert.doesNotMatch(appJs, /JSON\.stringify\(pattern\)\.toLowerCase\(\)/);
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
