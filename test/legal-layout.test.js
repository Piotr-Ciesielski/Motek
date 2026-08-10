const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const stylesCss = readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

test("strona prawna ma czytelny kontrakt ekranowy i mobilny", () => {
  assert.match(stylesCss, /\.legal-shell\s*\{/);
  assert.match(stylesCss, /\.legal-document\s*\{/);
  assert.match(stylesCss, /\.legal-toc\s*\{/);
  assert.match(stylesCss, /\.legal-section\s*\{/);
  assert.match(stylesCss, /\.legal-meta\s*\{/);
  assert.match(stylesCss, /@media \(max-width: 640px\)[\s\S]*?\.legal-shell/);
  assert.match(stylesCss, /@media \(max-width: 640px\)[\s\S]*?\.legal-toc/);
  assert.match(stylesCss, /\.legal-section\s*\{[\s\S]*?break-inside:\s*avoid/);
});

test("wydruk dokumentu prawnego ukrywa nawigację i wymusza kontrast", () => {
  const printRules = stylesCss.match(/@media print\s*\{([\s\S]*?)\n\}/)?.[1] || "";

  assert.notEqual(printRules, "");
  assert.match(printRules, /\.app-header/);
  assert.match(printRules, /\.legal-actions/);
  assert.match(printRules, /\.app-footer/);
  assert.match(printRules, /background:\s*#fff/);
  assert.match(printRules, /color:\s*#000/);
  assert.match(printRules, /break-inside:\s*avoid/);
});

test("pola zgody i linki prawne zachowują widoczny focus", () => {
  assert.match(stylesCss, /\.legal-consent[\s\S]*?border/);
  assert.match(stylesCss, /\.legal-consent__checkbox[\s\S]*?focus-within/);
  assert.match(stylesCss, /\.legal-shell a:focus-visible/);
});
