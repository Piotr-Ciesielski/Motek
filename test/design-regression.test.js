const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const indexHtml = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const appJs = readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const stylesCss = readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

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
    { target: "inventory", label: "Moje włóczki" },
    { target: "matches", label: "Dopasowania" },
    { target: "catalog", label: "Wzory" },
    { target: "account", label: "Konto" },
  ]);
  assert.ok(navigation.every(({ label }) => label.length > 0));
});

test("design changes preserve the compact authentication header contract", () => {
  const document = createDocument();
  const actions = [...document.querySelectorAll(".app-header__actions > *")];

  assert.deepEqual(actions.map((node) => node.id), ["themeToggle", "headerAuthAction"]);
  assert.equal(document.getElementById("headerUser"), null);
  assert.equal(document.getElementById("headerAuthAction")?.getAttribute("type"), "button");
  assert.equal(document.getElementById("headerAuthAction")?.textContent.trim(), "Zaloguj");
  assert.match(document.getElementById("authProfileSummary").textContent, /Zalogowano jako:/);
  assert.equal(document.querySelector("#authLoggedIn > .auth-message"), null);
});

test("authenticated account disclosure remains compact and keyboard-visible", () => {
  assert.match(stylesCss, /#accountView\.is-authenticated[\s\S]*?\.account-danger-disclosure/);
  assert.match(stylesCss, /\.account-danger-disclosure summary:focus-visible/);
  assert.match(stylesCss, /\.account-danger-disclosure\[open\]/);
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
  assert.equal(themedImages.length, 4);
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

test("technique filters exist in both views and load policy before client policy", () => {
  const document = createDocument();

  for (const id of ["matchTechniqueFilter", "patternTechniqueFilter"]) {
    const select = document.getElementById(id);
    assert.ok(select, `brak filtru techniki ${id}`);
    assert.deepEqual(
      [...select.querySelectorAll("option")].map((option) => option.value),
      ["all", "knitting", "crochet"],
    );
  }

  const scripts = [...document.querySelectorAll("script[src]")].map((script) =>
    script.getAttribute("src").split("?")[1] === undefined
      ? script.getAttribute("src")
      : script.getAttribute("src").split("?")[0]
  );
  assert.ok(scripts.includes("technique-policy.js"), "index.html nie ładuje technique-policy.js");
  assert.ok(
    scripts.indexOf("material-policy.js") < scripts.indexOf("technique-policy.js")
    && scripts.indexOf("technique-policy.js") < scripts.indexOf("client-policy.js"),
    "technique-policy.js musi być załadowany po material-policy.js i przed client-policy.js",
  );

  const techniquePolicyJs = readFileSync(
    path.join(__dirname, "..", "technique-policy.js"),
    "utf8",
  );
  assert.match(techniquePolicyJs, /MotekTechniquePolicy/);
  assert.match(appJs, /patternTechniqueFilter/);
  assert.match(appJs, /matchTechniqueFilter/);
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

test("design changes keep the icon control touch-safe and respect reduced motion", () => {
  assert.match(
    stylesCss,
    /\.theme-toggle \{[\s\S]*?min-width: 44px;[\s\S]*?min-height: 44px;/,
  );
  assert.match(stylesCss, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\*::before/);
  assert.match(appJs, /prefers-reduced-motion: reduce/);
});

test("light coral actions use dark text and the skip link keeps a fixed contrast pair", () => {
  const lightTheme = stylesCss.match(
    /:root,\s*\[data-theme="light"\] \{([\s\S]*?)\n\}/,
  )?.[1] || "";
  const skipLink = stylesCss.match(/\.skip-link \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(lightTheme, /--accent: #e94f4b;/);
  assert.match(lightTheme, /--on-accent: #151334;/);
  assert.match(skipLink, /background: #151334;/);
  assert.match(skipLink, /color: #fffdf8;/);
  assert.doesNotMatch(skipLink, /(?:background|color): var\(--(?:text|on-accent)\);/);
});

test("dark inventory and matches artwork use the catalog exposure only in dark mode", () => {
  assert.match(
    stylesCss,
    /\[data-theme="dark"\] #inventoryView \.inventory-layout__visual,\s*\[data-theme="dark"\] #matchesView \.matches-hero__visual \{[\s\S]*?background: none;[\s\S]*?\}/,
  );
  assert.match(
    stylesCss,
    /\[data-theme="dark"\] #inventoryView \.inventory-layout__visual img,\s*\[data-theme="dark"\] #matchesView \.matches-hero__visual img \{[\s\S]*?opacity: 1;[\s\S]*?\}/,
  );
  assert.match(
    stylesCss,
    /\[data-theme="dark"\] #inventoryView \.inventory-layout__visual::after,\s*\[data-theme="dark"\] #matchesView \.matches-hero__visual::after \{[\s\S]*?background: none;[\s\S]*?\}/,
  );

  for (const selector of [
    "#inventoryView \\.inventory-layout__visual img",
    "#matchesView \\.matches-hero__visual img",
  ]) {
    const baseRules = [...stylesCss.matchAll(new RegExp(`(?:^|\\n)${selector} \\{([\\s\\S]*?)\\n\\}`, "g"))]
      .map((match) => match[1]);
    assert.ok(baseRules.some((rule) => /object-fit: cover;/.test(rule)));
    assert.ok(baseRules.some((rule) => /object-position: 72% center;/.test(rule)));
    assert.ok(baseRules.every((rule) => !/opacity:/.test(rule)));
  }
});
