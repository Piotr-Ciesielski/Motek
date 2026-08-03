'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = 'https://staging.example.test';
const credentials = {
  baseUrl: BASE_URL,
  email: 'qa-secret@example.test',
  password: 'password-secret-123',
  captchaToken: 'captcha-secret-token',
  runId: 'run-123',
};

function jsonResponse(status, body, headers = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function scriptedFetch(steps) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const call = {
      method: options.method,
      path: url.pathname,
      headers: options.headers,
      body: options.body ? JSON.parse(options.body) : undefined,
    };
    calls.push(call);
    const step = steps.shift();
    assert.ok(step, `unexpected request ${call.method} ${call.path}`);
    assert.equal(`${call.method} ${call.path}`, step.request);
    if (step.check) step.check(call);
    if (step.error) throw step.error;
    return step.response;
  };
  return { fetchImpl, calls, remaining: steps };
}

function successSteps() {
  return [
    { request: 'POST /api/auth/login', check: ({ body }) => assert.deepEqual(body, {
      email: credentials.email,
      password: credentials.password,
      captchaToken: credentials.captchaToken,
    }), response: jsonResponse(200, { user: { id: 'user-1' } }, { 'set-cookie': 'motek_access_token=cookie; Path=/; HttpOnly' }) },
    { request: 'GET /api/auth/session', response: jsonResponse(200, { authenticated: true, user: { id: 'user-1' } }) },
    { request: 'GET /api/yarns', response: jsonResponse(200, [{ id: 99, name: 'foreign' }], { etag: '"v1"' }) },
    { request: 'POST /api/yarns', check: ({ body, headers }) => {
      assert.deepEqual(body, { name: 'regression-run-123', color: 'zielony', materials: ['wełna'], weightClass: 'dk', length: 300, weight: 100 });
      assert.equal(headers.get('if-match'), '"v1"');
    }, response: jsonResponse(201, { id: 41, name: 'regression-run-123' }, { etag: '"v2"' }) },
    { request: 'GET /api/yarns', response: jsonResponse(200, [{ id: 99 }, { id: 41 }], { etag: '"v2"' }) },
    { request: 'PATCH /api/yarns/41', check: ({ headers }) => assert.equal(headers.get('if-match'), '"v2"'), response: jsonResponse(200, { id: 41 }, { etag: '"v3"' }) },
    { request: 'PATCH /api/yarns/41', check: ({ headers }) => assert.equal(headers.get('if-match'), '"v2"'), response: jsonResponse(409, { error: 'conflict' }) },
    { request: 'GET /api/matches', response: jsonResponse(200, []) },
    { request: 'GET /api/yarns', response: jsonResponse(200, [{ id: 99 }, { id: 41 }], { etag: '"v3"' }) },
    { request: 'DELETE /api/yarns/41', check: ({ headers }) => assert.equal(headers.get('if-match'), '"v3"'), response: jsonResponse(204) },
    { request: 'POST /api/auth/logout', response: jsonResponse(200, { authenticated: false }) },
    { request: 'GET /api/auth/session', response: jsonResponse(200, { authenticated: false, user: null }) },
  ];
}

test('runs the complete authenticated regression using only the created yarn id', async () => {
  const { runAuthenticatedRegression } = require('../scripts/regression/authenticated-suite');
  const script = scriptedFetch(successSteps());

  await runAuthenticatedRegression({ ...credentials, fetchImpl: script.fetchImpl });

  assert.equal(script.remaining.length, 0);
  assert.equal(script.calls.filter(({ path }) => path === '/api/yarns/99').length, 0);
});

test('cleans up the exact created yarn after a later failure', async () => {
  const { runAuthenticatedRegression } = require('../scripts/regression/authenticated-suite');
  const steps = successSteps().slice(0, 6);
  steps.push(
    { request: 'PATCH /api/yarns/41', response: jsonResponse(500, { error: 'failed' }) },
    { request: 'GET /api/yarns', response: jsonResponse(200, [{ id: 99 }, { id: 41 }], { etag: '"cleanup"' }) },
    { request: 'DELETE /api/yarns/41', check: ({ headers }) => assert.equal(headers.get('if-match'), '"cleanup"'), response: jsonResponse(204) },
    { request: 'POST /api/auth/logout', response: jsonResponse(200, { authenticated: false }) },
  );
  const script = scriptedFetch(steps);

  await assert.rejects(runAuthenticatedRegression({ ...credentials, fetchImpl: script.fetchImpl }), /PATCH \/api\/yarns\/41.*500/);
  assert.equal(script.remaining.length, 0);
  assert.equal(script.calls.some(({ path }) => path === '/api/yarns/99'), false);
});

test('preserves the primary failure and attaches a cleanup failure', async () => {
  const { runAuthenticatedRegression } = require('../scripts/regression/authenticated-suite');
  const steps = successSteps().slice(0, 6);
  steps.push(
    { request: 'PATCH /api/yarns/41', response: jsonResponse(500, {}) },
    { request: 'GET /api/yarns', response: jsonResponse(503, {}) },
    { request: 'POST /api/auth/logout', response: jsonResponse(200, { authenticated: false }) },
  );
  const script = scriptedFetch(steps);

  const error = await runAuthenticatedRegression({ ...credentials, fetchImpl: script.fetchImpl }).catch((caught) => caught);

  assert.match(error.message, /PATCH \/api\/yarns\/41.*500/);
  assert.match(error.cleanupError.message, /GET \/api\/yarns.*503/);
  assert.equal(script.remaining.length, 0);
});

test('never deletes a foreign yarn when creation did not return a valid id', async () => {
  const { runAuthenticatedRegression } = require('../scripts/regression/authenticated-suite');
  const steps = successSteps().slice(0, 3);
  steps.push(
    { request: 'POST /api/yarns', response: jsonResponse(201, { id: 0 }, { etag: '"v2"' }) },
    { request: 'POST /api/auth/logout', response: jsonResponse(200, { authenticated: false }) },
  );
  const script = scriptedFetch(steps);

  await assert.rejects(runAuthenticatedRegression({ ...credentials, fetchImpl: script.fetchImpl }), /created yarn id/i);
  assert.equal(script.calls.some(({ method }) => method === 'DELETE'), false);
});

test('rejects unsafe input without exposing credentials in errors', async () => {
  const { runAuthenticatedRegression } = require('../scripts/regression/authenticated-suite');
  const secrets = [credentials.email, credentials.password, credentials.captchaToken];

  for (const overrides of [{ runId: '../unsafe' }, { email: '' }, { password: '' }, { captchaToken: '' }]) {
    const error = await runAuthenticatedRegression({ ...credentials, ...overrides, fetchImpl: async () => assert.fail('must not fetch') }).catch((caught) => caught);
    assert.ok(error instanceof Error);
    for (const secret of secrets) assert.equal(error.message.includes(secret), false);
  }
});
