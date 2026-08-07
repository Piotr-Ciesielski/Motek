'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createCatalogController } = require('../client/catalog-controller');

test('catalog controller can load as a browser script without CommonJS module', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'client', 'catalog-controller.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.window.createCatalogController, 'function');
});

test('catalog controller exposes the required contract', () => {
  const controller = createCatalogController();
  for (const method of ['initialize', 'refresh', 'loadMore', 'resetFilters', 'showPattern']) {
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

  await controller.initialize();
  await controller.loadMore();
  assert.deepEqual(controller.getState().items, [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(calls.map((call) => call.page), [1, 2]);
  assert.equal(calls[0].filters.category, 'all');
});

test('resetFilters restores defaults and showPattern selects an item', async () => {
  let selected;
  const controller = createCatalogController({
    initialFilters: { category: 'all' },
    onShowPattern: (item) => { selected = item; },
    load: async ({ filters }) => ({ items: [{ id: 'p1', category: filters.category }], hasMore: false })
  });

  await controller.resetFilters({ category: 'new' });
  assert.equal(controller.getState().filters.category, 'new');
  assert.deepEqual(controller.showPattern('p1'), { id: 'p1', category: 'new' });
  assert.deepEqual(selected, { id: 'p1', category: 'new' });
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
