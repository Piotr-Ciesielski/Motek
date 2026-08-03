const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const { formatCatalogSummary } = require("../client-policy");

test("katalog rozróżnia liczbę pokazanych, załadowanych i wszystkich wzorów", () => {
  const dom = new JSDOM('<div id="summary" aria-live="polite"></div>');
  const summary = dom.window.document.getElementById("summary");

  summary.textContent = formatCatalogSummary({
    visible: 12,
    matching: 18,
    loaded: 50,
    total: 120,
    complete: false,
  });

  assert.match(summary.textContent, /Pokazano 12 z 18/);
  assert.match(summary.textContent, /Załadowano 50 z 120/);
  assert.match(summary.textContent, /Pobieram kolejne wzory/);
});
