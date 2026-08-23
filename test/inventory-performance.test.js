const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

test(
  "500 kart magazynu mieszcza sie w budzecie renderowania i filtrowania",
  { skip: process.env.NODE_V8_COVERAGE ? "Budzety czasu nie sa miarodajne pod instrumentacja c8." : false },
  () => {
  const dom = new JSDOM("<main><input id='filter'><section id='inventory'></section></main>");
  const { document } = dom.window;
  const inventory = document.getElementById("inventory");
  const filter = document.getElementById("filter");
  const started = performance.now();

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 500; index += 1) {
    const card = document.createElement("article");
    card.className = "yarn-card";
    card.dataset.name = `Włóczka ${index}`;
    card.textContent = `Włóczka ${index}`;
    fragment.append(card);
  }
  inventory.replaceChildren(fragment);
  const renderMs = performance.now() - started;

  const filterStarted = performance.now();
  filter.value = "Włóczka 49";
  const query = filter.value.toLocaleLowerCase("pl");
  for (const card of inventory.children) {
    card.hidden = !card.dataset.name.toLocaleLowerCase("pl").includes(query);
  }
  const filterMs = performance.now() - filterStarted;

  assert.equal(inventory.children.length, 500);
  assert.equal([...inventory.children].filter((card) => !card.hidden).length, 11);
  // Budżet jest celowo szeroki dla CI; test wykrywa regresje rzędu sekund, nie mikrosekundy.
  assert.ok(renderMs < 1000, `renderowanie 500 kart trwało ${renderMs.toFixed(1)} ms`);
  assert.ok(filterMs < 250, `filtrowanie 500 kart trwało ${filterMs.toFixed(1)} ms`);
  },
);
