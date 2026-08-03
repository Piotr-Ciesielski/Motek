const test = require('node:test');
const assert = require('node:assert/strict');

const { createHttpSession } = require('../scripts/regression/http-session');

test('creates an HTTPS regression session', () => {
  const session = createHttpSession({
    baseUrl: 'https://example.test',
    origin: 'https://example.test',
    fetchImpl: async () => new Response(null, { status: 204 }),
  });

  assert.equal(typeof session.request, 'function');
  assert.equal(typeof session.json, 'function');
  assert.equal(typeof session.getCookies, 'function');
});

function response({ status = 200, body = '', cookies = [], contentType = 'application/json' } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      getSetCookie: () => cookies,
      get: (name) => name.toLowerCase() === 'content-type' ? contentType : null,
    },
    text: async () => body,
  };
}

test('stores response cookies, sends them later, and adds Origin only to unsafe methods', async () => {
  const calls = [];
  const replies = [
    response({ cookies: ['session=abc; Path=/; HttpOnly'] }),
    response({ status: 204, contentType: null }),
    response({ status: 204, contentType: null }),
  ];
  const session = createHttpSession({
    baseUrl: 'https://api.example.test/root/',
    origin: 'https://app.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return replies.shift();
    },
  });

  await session.request('login');
  await session.request('items', { method: 'POST', body: { name: 'Motek' } });
  await session.request('items');

  assert.deepEqual(session.getCookies(), { session: 'abc' });
  assert.equal(calls[1].options.headers.get('Cookie'), 'session=abc');
  assert.equal(calls[1].options.headers.get('Origin'), 'https://app.example.test');
  assert.equal(calls[1].options.headers.get('Content-Type'), 'application/json');
  assert.equal(calls[1].options.body, '{"name":"Motek"}');
  assert.equal(calls[2].options.headers.has('Origin'), false);
});

test('keeps multiple Set-Cookie headers and overwrites or removes named cookies', async () => {
  const replies = [
    response({ cookies: ['session=old; Path=/', 'theme=dark; Path=/'] }),
    response({ cookies: ['session=new; Path=/', 'theme=; Max-Age=0; Path=/'] }),
  ];
  const session = createHttpSession({
    baseUrl: 'https://example.test',
    origin: 'https://example.test',
    fetchImpl: async () => replies.shift(),
  });

  await session.request('/first');
  assert.deepEqual(session.getCookies(), { session: 'old', theme: 'dark' });
  await session.request('/second');
  assert.deepEqual(session.getCookies(), { session: 'new' });
});

test('preserves explicit content headers when serializing an object body', async () => {
  let captured;
  const session = createHttpSession({
    baseUrl: 'https://example.test',
    origin: 'https://example.test',
    fetchImpl: async (_url, options) => {
      captured = options;
      return response({ status: 204 });
    },
  });

  await session.request('/items', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/merge-patch+json', 'X-Test': 'yes' },
    body: { enabled: true },
  });

  assert.equal(captured.headers.get('Content-Type'), 'application/merge-patch+json');
  assert.equal(captured.headers.get('X-Test'), 'yes');
  assert.equal(captured.body, '{"enabled":true}');
});

test('json rejects malformed JSON with a safe diagnostic', async () => {
  const session = createHttpSession({
    baseUrl: 'https://example.test',
    origin: 'https://example.test',
    fetchImpl: async () => response({ body: 'not-json SECRET_BODY' }),
  });

  await assert.rejects(
    session.json('/items?token=SECRET_QUERY'),
    (error) => error.message.includes('GET /items')
      && error.message.includes('invalid JSON')
      && !error.message.includes('SECRET_BODY')
      && !error.message.includes('SECRET_QUERY'),
  );
});

test('json rejects non-2xx without leaking body, cookies, authorization, or query values', async () => {
  const session = createHttpSession({
    baseUrl: 'https://example.test',
    origin: 'https://example.test',
    fetchImpl: async () => response({
      status: 403,
      body: '{"secret":"SECRET_BODY"}',
      cookies: ['session=SECRET_COOKIE; Path=/'],
    }),
  });

  await assert.rejects(
    session.json('/private?key=SECRET_QUERY', {
      headers: { Authorization: 'Bearer SECRET_AUTH' },
    }),
    (error) => error.message.includes('GET /private')
      && error.message.includes('403')
      && !/SECRET_BODY|SECRET_COOKIE|SECRET_QUERY|SECRET_AUTH/.test(error.message),
  );
});

test('uses AbortSignal.timeout with a ten-second default', async () => {
  const originalTimeout = AbortSignal.timeout;
  const marker = new AbortController().signal;
  let timeout;
  AbortSignal.timeout = (milliseconds) => {
    timeout = milliseconds;
    return marker;
  };
  try {
    let capturedSignal;
    const session = createHttpSession({
      baseUrl: 'https://example.test',
      origin: 'https://example.test',
      fetchImpl: async (_url, options) => {
        capturedSignal = options.signal;
        return response({ status: 204 });
      },
    });

    await session.request('/health');
    assert.equal(timeout, 10_000);
    assert.equal(capturedSignal, marker);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test('blocks plain HTTP except explicit localhost and 127.0.0.1 targets', () => {
  const create = (baseUrl) => createHttpSession({
    baseUrl,
    origin: 'http://localhost:3000',
    fetchImpl: async () => response({ status: 204 }),
  });

  assert.throws(() => create('http://example.test'), /HTTPS/);
  assert.throws(() => create('http://localhost.example.test'), /HTTPS/);
  assert.doesNotThrow(() => create('http://localhost:3000'));
  assert.doesNotThrow(() => create('http://127.0.0.1:3000'));
});

test('does not allow an absolute request path to bypass the HTTPS restriction', async () => {
  const session = createHttpSession({
    baseUrl: 'https://example.test',
    origin: 'https://example.test',
    fetchImpl: async () => response({ status: 204 }),
  });

  await assert.rejects(session.request('http://remote.example.test/private'), /HTTPS/);
});
