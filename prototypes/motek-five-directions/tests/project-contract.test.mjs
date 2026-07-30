import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);

function read(relativePath) {
  return readFileSync(new URL(relativePath, root), "utf8");
}

test("defines five numbered visual variants with real image assets", () => {
  const source = read("src/variants/variants.mjs");
  const expected = [
    ["atelier", 1, "Atelier"],
    ["nordic", 2, "Nordic"],
    ["forest", 3, "Leśna Pracownia"],
    ["color", 4, "Koloroterapia"],
    ["night", 5, "Nocny Motek"],
  ];

  for (const [id, number, name] of expected) {
    assert.match(source, new RegExp(`id: [\"']${id}[\"']`));
    assert.match(source, new RegExp(`number: ${number}`));
    assert.match(source, new RegExp(`name: [\"']${name}[\"']`));
    assert.match(source, new RegExp(`/assets/${id}-yarn-cat\\.png`));
  }
});

test("selects a variant from the URL and numbers the browser title", () => {
  const source = read("src/App.jsx");
  assert.match(source, /URLSearchParams\(window\.location\.search\)/);
  assert.match(
    source,
    /document\.title = `\$\{variant\.number\} — \$\{variant\.name\} — Motek`/,
  );
});

test("includes all three interactive product views", () => {
  const source = read("src/App.jsx");
  for (const component of ["InventoryView", "MatchingView", "CatalogView"]) {
    assert.match(source, new RegExp(component));
  }
});

test("ships a separate visual stylesheet for every direction", () => {
  for (const id of ["atelier", "nordic", "forest", "color", "night"]) {
    assert.equal(existsSync(new URL(`src/styles/${id}.css`, root)), true);
  }
});

test("uses an icon exported by the pinned Lucide version", () => {
  const source = read("src/components/PatternCard.jsx");
  assert.doesNotMatch(source, /\bYarn\b/);
  assert.match(source, /\bCircleDotDashed\b/);
});
