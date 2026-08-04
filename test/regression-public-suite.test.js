'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { runPublicRegression } = require('../scripts/regression/public-suite');

const SHA = '0123456789abcdef0123456789abcdef01234567';
const BASE_URL = 'https://www.rysia.org';
const APEX_URL = 'https://rysia.org';
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'",
  'X-Content-Type-Options': 'nosniff',
};

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function textResponse(status, body, headers = {}) {
  return new Response(body, { status, headers });
}

function validResponses(overrides = {}) {
  return {
    '/health/live': jsonResponse(200, { status: 'ok' }),
    '/health/ready': jsonResponse(200, { status: 'ready' }),
    '/health/release': jsonResponse(200, {
      status: 'ready', commit: SHA, environment: 'production', version: '2.0.0',
    }),
    '/': textResponse(200, '<title>Motek - dobierz wzór do włóczek</title>', SECURITY_HEADERS),
    '/styles.css': textResponse(200, ':root,\n[data-theme="light"] {\n  --hero-gradient: linear-gradient(145deg, #e94f4b, #a88be8);\n}'),
    '/app.js': textResponse(200, 'window.MotekClientPolicy;'),
    '/api/config': jsonResponse(200, {
      captcha: { enabled: true, provider: 'turnstile', siteKey: 'public-site-key' },
    }, SECURITY_HEADERS),
    '/api/patterns?limit=1&offset=0': jsonResponse(200, {
      items: [{ id: 1, name: 'Czapka' }], total: 1, limit: 1, offset: 0, hasMore: false,
    }),
    '/api/yarns': jsonResponse(401, { error: 'Wymagane logowanie.' }),
    '/api/matches': jsonResponse(401, { error: 'Wymagane logowanie.' }),
    'POST /api/yarns': jsonResponse(403, { error: 'Niedozwolone źródło.' }),
    '/internal/metrics': textResponse(404, 'Nie znaleziono'),
    'APEX /regression-check?source=post-deploy': textResponse(308, '', {
      Location: 'https://www.rysia.org/regression-check?source=post-deploy',
    }),
    ...overrides,
  };
}

function controlledFetch(responses, calls = []) {
  return async (input, options = {}) => {
    const url = new URL(input);
    const method = String(options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers);
    calls.push({ url: url.toString(), method, headers, redirect: options.redirect });
    const apex = url.origin === APEX_URL ? `APEX ${url.pathname}${url.search}` : null;
    const key = apex || (method === 'GET' ? `${url.pathname}${url.search}` : `${method} ${url.pathname}`);
    const response = responses[key];
    if (!response) throw new Error(`Unexpected test request: ${method} ${url}`);
    return response.clone();
  };
}

test('sprawdza pełną publiczną regresję w bezpiecznej kolejności', async () => {
  const calls = [];
  await runPublicRegression({
    baseUrl: BASE_URL,
    apexUrl: APEX_URL,
    expectedSha: SHA,
    expectedEnvironment: 'production',
    fetchImpl: controlledFetch(validResponses(), calls),
  });

  assert.deepEqual(calls.map(({ url, method }) => `${method} ${new URL(url).origin}${new URL(url).pathname}${new URL(url).search}`), [
    `GET ${BASE_URL}/health/live`,
    `GET ${BASE_URL}/health/ready`,
    `GET ${BASE_URL}/health/release`,
    `GET ${BASE_URL}/`,
    `GET ${BASE_URL}/styles.css`,
    `GET ${BASE_URL}/app.js`,
    `GET ${BASE_URL}/api/config`,
    `GET ${BASE_URL}/api/patterns?limit=1&offset=0`,
    `GET ${BASE_URL}/api/yarns`,
    `GET ${BASE_URL}/api/matches`,
    `POST ${BASE_URL}/api/yarns`,
    `GET ${BASE_URL}/internal/metrics`,
    `GET ${APEX_URL}/regression-check?source=post-deploy`,
  ]);
  assert.equal(calls[10].headers.get('origin'), 'https://regression.invalid');
  assert.equal(calls[12].redirect, 'manual');
  assert.equal(calls[12].headers.has('cookie'), false);
});

test('przerywa na niezgodnym SHA bez wykonywania dalszych żądań', async () => {
  const calls = [];
  const responses = validResponses({
    '/health/release': jsonResponse(200, {
      status: 'ready', commit: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd', environment: 'production',
    }),
  });
  await assert.rejects(
    runPublicRegression({ baseUrl: BASE_URL, expectedSha: SHA, expectedEnvironment: 'production', fetchImpl: controlledFetch(responses, calls) }),
    /release commit/i,
  );
  assert.equal(calls.length, 3);
});

test('odrzuca nagłówek CORS i sekret w publicznej konfiguracji CAPTCHA', async (t) => {
  await t.test('CORS', async () => {
    const responses = validResponses({
      '/': textResponse(200, '<title>Motek - dobierz wzór do włóczek</title>', {
        ...SECURITY_HEADERS, 'Access-Control-Allow-Origin': '*',
      }),
    });
    await assert.rejects(
      runPublicRegression({ baseUrl: BASE_URL, expectedSha: SHA, expectedEnvironment: 'production', fetchImpl: controlledFetch(responses) }),
      /Access-Control-Allow-Origin/i,
    );
  });

  await t.test('sekret CAPTCHA', async () => {
    const responses = validResponses({
      '/api/config': jsonResponse(200, {
        captcha: { enabled: true, provider: 'turnstile', siteKey: 'public-site-key', secretKey: 'do-not-expose' },
      }, SECURITY_HEADERS),
    });
    await assert.rejects(
      runPublicRegression({ baseUrl: BASE_URL, expectedSha: SHA, expectedEnvironment: 'production', fetchImpl: controlledFetch(responses) }),
      /secret/i,
    );
  });
});

test('odrzuca publicznie dostępne metryki i nie umieszcza ich treści w błędzie', async () => {
  const responses = validResponses({
    '/internal/metrics': textResponse(200, 'motek_secret_metric 12345'),
  });
  await assert.rejects(
    runPublicRegression({ baseUrl: BASE_URL, expectedSha: SHA, expectedEnvironment: 'production', fetchImpl: controlledFetch(responses) }),
    (error) => /internal\/metrics/.test(error.message) && !/motek_secret_metric|12345/.test(error.message),
  );
});

test('odrzuca arkusz bez stabilnego tokena wizualnego Motka', async () => {
  const responses = validResponses({
    '/styles.css': textResponse(200, ':root,\n[data-theme="light"] { color: black; }'),
  });
  await assert.rejects(
    runPublicRegression({ baseUrl: BASE_URL, expectedSha: SHA, expectedEnvironment: 'production', fetchImpl: controlledFetch(responses) }),
    /styles\.css.*Motek content marker/i,
  );
});

test('odrzuca nieprawdziwe pole patterns zamiast kontraktowego items', async () => {
  const responses = validResponses({
    '/api/patterns?limit=1&offset=0': jsonResponse(200, {
      patterns: [{ id: 1, name: 'Czapka' }], total: 1, limit: 1, offset: 0, hasMore: false,
    }),
  });
  await assert.rejects(
    runPublicRegression({ baseUrl: BASE_URL, expectedSha: SHA, expectedEnvironment: 'production', fetchImpl: controlledFetch(responses) }),
    /items/i,
  );
});

test('odrzuca błędne przekierowanie domeny apex', async () => {
  const responses = validResponses({
    'APEX /regression-check?source=post-deploy': textResponse(302, '', { Location: `${BASE_URL}/wrong` }),
  });
  await assert.rejects(
    runPublicRegression({ baseUrl: BASE_URL, apexUrl: APEX_URL, expectedSha: SHA, expectedEnvironment: 'production', fetchImpl: controlledFetch(responses) }),
    /apex redirect/i,
  );
});

test('używa globalnego fetch także dla niesesyjnego sprawdzenia apex', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = controlledFetch(validResponses(), calls);
  t.after(() => { globalThis.fetch = originalFetch; });

  await runPublicRegression({
    baseUrl: BASE_URL,
    apexUrl: APEX_URL,
    expectedSha: SHA,
    expectedEnvironment: 'production',
  });

  assert.equal(calls.at(-1).url, `${APEX_URL}/regression-check?source=post-deploy`);
});
