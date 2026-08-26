'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { createCatalogController, createCatalogFilterDisclosure } = require('../client/catalog-controller');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const browserScripts = [
  'theme-policy.js',
  'material-policy.js',
  'technique-policy.js',
  'client-policy.js',
  'client/api-client.js',
  'client/dom-utils.js',
  'client/catalog-controller.js',
  'client/idle-session-controller.js',
  'app.js',
].map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));

function loadApp(patterns = []) {
  const dom = new JSDOM(indexHtml, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.matchMedia = (query) => ({
    matches: query.includes('max-width'),
    addEventListener() {},
    removeEventListener() {},
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.fetch = async (input) => {
    const pathname = new URL(input, window.location.href).pathname;
    const payload = pathname === '/api/config'
      ? { captcha: { enabled: false } }
        : pathname === '/api/auth/session'
        ? {
          authenticated: true,
          user: { id: 'catalog-user', email: 'catalog@example.test' },
          legal: { currentVersion: '1.0', acceptedVersion: '1.0', acceptanceRequired: false },
        }
        : { items: patterns, total: patterns.length };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  browserScripts.forEach((source) => window.eval(source));
  return dom;
}

test('catalog controller can load as a browser script without CommonJS module', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'client', 'catalog-controller.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.window.createCatalogController, 'function');
});

test('catalog controller exposes the required contract', () => {
  const controller = createCatalogController();
  for (const method of ['refresh', 'loadMore', 'getState']) {
    assert.equal(typeof controller[method], 'function');
  }
});

test('refresh and loadMore manage pages and append catalog items', async () => {
  const calls = [];
  const controller = createCatalogController({
    initialFilters: { category: 'all' },
    load: async ({ page, filters }) => {
      calls.push({ page, filters });
      return { items: [{ id: page }], hasMore: page < 2 };
    }
  });

  await controller.refresh();
  await controller.loadMore();
  assert.deepEqual(controller.getState().items, [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(calls.map((call) => call.page), [1, 2]);
  assert.equal(calls[0].filters.category, 'all');
});

test('preserves server total while a large catalog still has more pages', async () => {
  const controller = createCatalogController({
    load: async () => ({ items: [{ id: 'p1' }], total: 250, hasMore: true })
  });
  await controller.refresh();
  assert.equal(controller.getState().total, 250);
  assert.equal(controller.getState().hasMore, true);
  assert.equal(controller.getState().items.length, 1);
});

test('ponawia nieudaną stronę katalogu bez duplikowania kart i czyści błąd', async () => {
  const calls = [];
  let secondPageFailed = false;
  const controller = createCatalogController({
    load: async ({ page }) => {
      calls.push(page);
      if (page === 1) return { items: [{ id: 1 }, { id: 2 }], total: 4, hasMore: true };
      if (!secondPageFailed) {
        secondPageFailed = true;
        throw new Error('chwilowy błąd strony 2');
      }
      return { items: [{ id: 2 }, { id: 3 }], total: 4, hasMore: true };
    },
  });

  await controller.refresh();
  await assert.rejects(controller.loadMore(), /chwilowy błąd strony 2/);
  assert.match(controller.getState().error.message, /chwilowy błąd strony 2/);

  await controller.loadMore();

  assert.deepEqual(calls, [1, 2, 2]);
  assert.deepEqual(controller.getState().items, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.equal(controller.getState().error, null);
});

test('odświeżenie porzuca wolniejszą, starszą odpowiedź po szybszej nowszej', async () => {
  const resolvers = [];
  const controller = createCatalogController({
    load: () => new Promise((resolve) => resolvers.push(resolve)),
  });

  const first = controller.refresh();
  const second = controller.refresh();

  resolvers[1]({ items: [{ id: 'nowszy' }], hasMore: false });
  await second;
  assert.deepEqual(controller.getState().items, [{ id: 'nowszy' }]);

  resolvers[0]({ items: [{ id: 'starszy' }], hasMore: false });
  await first;
  assert.deepEqual(controller.getState().items, [{ id: 'nowszy' }]);
  assert.equal(controller.getState().loading, false);
  assert.equal(controller.getState().error, null);
});

test('mobilny panel filtrów zachowuje wartości, stan dostępności i zamyka się klawiszem Escape', () => {
  const dom = new JSDOM(indexHtml, { pretendToBeVisual: true });
  const { document, KeyboardEvent } = dom.window;
  const toggle = document.getElementById('catalogFiltersToggle');
  const panel = document.getElementById('catalogSecondaryFilters');
  const material = document.getElementById('patternMaterialFilter');
  const disclosure = createCatalogFilterDisclosure({
    toggle,
    panel,
    mobileQuery: { matches: true, addEventListener() {}, removeEventListener() {} },
  });

  assert.equal(toggle.getAttribute('aria-controls'), 'catalogSecondaryFilters');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  disclosure.updateCount(1);
  assert.equal(toggle.textContent, 'Filtry (1)');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.hidden, false);

  material.append(new dom.window.Option('Wełna', 'wool'));
  material.value = 'wool';
  panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.hidden, true);
  assert.equal(material.value, 'wool');
  assert.equal(document.activeElement, toggle);
});

test('pusty wynik pozwala wyczyścić filtry i wrócić do wyszukiwania', async () => {
  const dom = loadApp();
  const { document, Event } = dom.window;
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

  const language = document.getElementById('patternLanguageFilter');
  language.value = 'pl';
  language.dispatchEvent(new Event('change', { bubbles: true }));
  const action = [...document.querySelectorAll('#patternCatalog button')]
    .find((button) => button.textContent === 'Wyczyść filtry');

  assert.ok(action);
  action.click();
  assert.equal(language.value, 'all');
  assert.equal(document.activeElement, document.getElementById('patternSearch'));
  // Reset pobiera teraz katalog ponownie z serwera; czekamy na ustanie odświeżania.
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));
  dom.window.close();
});

test('przycisk doładowania podaje liczbę kart, które pokaże', async () => {
  const patterns = Array.from({ length: 15 }, (_, index) => ({
    id: `p${index}`,
    name: `Wzór ${String(index).padStart(2, '0')}`,
    description: 'Opis',
    projectType: 'other',
    sourceLanguage: 'pl',
    needsReview: false,
    materials: [],
    yarnRequirements: [],
  }));
  const dom = loadApp(patterns);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

  assert.equal(dom.window.document.getElementById('loadMorePatternsBtn').textContent, 'Pokaż 3 kolejne wzory');
  dom.window.close();
});

test('katalog wyróżnia pierwszy wzór i najwyżej trzy kolejne lekkie karty', async () => {
  const patterns = Array.from({ length: 5 }, (_, index) => ({
    id: `featured-${index}`,
    name: `Wzór ${index}`,
    description: `Opis ${index}`,
    projectType: 'sweater',
    sourceLanguage: 'pl',
    technique: 'knitting',
    needsReview: false,
    officialSourceUrl: `https://example.test/pattern-${index}`,
    materials: ['wełna'],
    yarnRequirements: [{ yarn_name: 'Merino', role: 'główna' }],
  }));
  const dom = loadApp(patterns);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

  try {
    const cards = [...dom.window.document.querySelectorAll('#patternCatalog .pattern-card')];
    assert.equal(cards.length, 5);
    assert.equal(cards.filter((card) => card.classList.contains('pattern-card--featured')).length, 1);
    assert.equal(cards.filter((card) => card.classList.contains('pattern-card--compact')).length, 3);
    assert.ok(cards[0].classList.contains('pattern-card--featured'));
    assert.equal(cards[4].classList.contains('pattern-card--compact'), false);
    assert.equal(cards[0].querySelector('.pattern-card__details').open, true);
    assert.match(cards[0].querySelector('.pattern-card__kicker').textContent, /Sweter · Druty/);
    assert.equal(cards[0].querySelector('.pattern-card__source').textContent, 'Zobacz wzór');
    assert.ok(cards[0].querySelector('.pattern-card__source').classList.contains('button'));
    assert.equal(cards.some((card) => card.querySelector('img')), false);
  } finally {
    dom.window.close();
  }
});

test('akcje wzorów zachowują krótki tekst i rozróżniają nazwy dla czytnika ekranu', async () => {
  const patterns = ['Atlas', 'Północ'].map((name, index) => ({
    id: `action-${index}`,
    name,
    description: 'Opis',
    projectType: 'sweater',
    sourceLanguage: 'pl',
    technique: 'knitting',
    needsReview: false,
    officialSourceUrl: `https://example.test/${index}`,
    materials: [],
    yarnRequirements: [],
  }));
  const dom = loadApp(patterns);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

  try {
    const links = [...dom.window.document.querySelectorAll('#patternCatalog .pattern-card__source')];
    assert.deepEqual(links.map((link) => link.textContent), ['Zobacz wzór', 'Zobacz wzór']);
    assert.deepEqual(links.map((link) => link.getAttribute('aria-label')), [
      'Zobacz wzór: Atlas',
      'Zobacz wzór: Północ',
    ]);
  } finally {
    dom.window.close();
  }
});
