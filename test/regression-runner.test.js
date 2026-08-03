'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OLD_SHA = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('czeka na właściwe SHA i ponawia 503 oraz błąd sieci bez realnego czekania', async () => {
  const { waitForRelease } = require('../scripts/regression/wait-for-release');
  const outcomes = [
    jsonResponse(200, { status: 'ready', commit: OLD_SHA, environment: 'staging' }),
    jsonResponse(503, { secret: 'nie ujawniaj' }),
    new Error('network secret'),
    jsonResponse(200, { status: 'ready', commit: SHA, environment: 'staging' }),
  ];
  let now = 0;
  const calls = [];

  const release = await waitForRelease({
    baseUrl: 'https://staging.example.test', expectedSha: SHA, expectedEnvironment: 'staging', timeoutMs: 10,
    intervalMs: 1, nowImpl: () => now, sleepImpl: async (ms) => { now += ms; },
    fetchImpl: async (url) => {
      calls.push(String(url));
      const outcome = outcomes.shift();
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  });

  assert.equal(release.commit, SHA);
  assert.equal(calls.length, 4);
  assert.ok(calls.every((url) => url === 'https://staging.example.test/health/release'));
});

test('kończy natychmiast błędem przy właściwym SHA w innym środowisku', async () => {
  const { waitForRelease } = require('../scripts/regression/wait-for-release');
  let calls = 0;
  await assert.rejects(waitForRelease({
    baseUrl: 'https://staging.example.test', expectedSha: SHA, expectedEnvironment: 'staging',
    sleepImpl: async () => { throw new Error('nie powinien czekać'); },
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(200, { status: 'ready', commit: SHA, environment: 'production' });
    },
  }), /environment/i);
  assert.equal(calls, 1);
});

test('kończy natychmiast błędem przy innym środowisku także dla starego SHA', async () => {
  const { waitForRelease } = require('../scripts/regression/wait-for-release');
  let calls = 0;
  await assert.rejects(waitForRelease({
    baseUrl: 'https://staging.example.test', expectedSha: SHA, expectedEnvironment: 'staging',
    sleepImpl: async () => { throw new Error('nie powinien czekać'); },
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(200, { status: 'ready', commit: OLD_SHA, environment: 'production' });
    },
  }), /environment/i);
  assert.equal(calls, 1);
});

test('kończy oczekiwanie po timeout i nie ujawnia body odpowiedzi', async () => {
  const { waitForRelease } = require('../scripts/regression/wait-for-release');
  let now = 0;
  await assert.rejects(waitForRelease({
    baseUrl: 'http://localhost:3000', expectedSha: SHA, expectedEnvironment: 'staging', timeoutMs: 2,
    intervalMs: 1, nowImpl: () => now, sleepImpl: async (ms) => { now += ms; },
    fetchImpl: async () => jsonResponse(503, { password: 'bardzo-tajne' }),
  }), (error) => /timed out/i.test(error.message) && !/bardzo-tajne|password/i.test(error.message));
});

test('deadline przerywa zawieszony fetch i przekazuje mu sygnał anulowania', async () => {
  const { waitForRelease } = require('../scripts/regression/wait-for-release');
  let receivedSignal;
  const startedAt = Date.now();
  await assert.rejects(waitForRelease({
    baseUrl: 'https://staging.example.test', expectedSha: SHA, expectedEnvironment: 'staging',
    timeoutMs: 20, intervalMs: 5,
    fetchImpl: async (_url, options) => {
      receivedSignal = options.signal;
      return new Promise(() => {});
    },
  }), /timed out/i);
  assert.ok(receivedSignal instanceof AbortSignal);
  assert.equal(receivedSignal.aborted, true);
  assert.ok(Date.now() - startedAt < 500);
});

test('zamrożony zegar i natychmiastowy sleep nie tworzą nieskończonej pętli', async () => {
  const { waitForRelease } = require('../scripts/regression/wait-for-release');
  let calls = 0;
  await assert.rejects(waitForRelease({
    baseUrl: 'https://staging.example.test', expectedSha: SHA, expectedEnvironment: 'staging',
    timeoutMs: 3, intervalMs: 1, nowImpl: () => 0, sleepImpl: async () => {},
    fetchImpl: async () => { calls += 1; return jsonResponse(503, {}); },
  }), /timed out/i);
  assert.equal(calls, 3);
});

test('odrzuca niebezpieczny URL i niepełny lub wielkoliterowy SHA', async () => {
  const { waitForRelease } = require('../scripts/regression/wait-for-release');
  const fetchImpl = async () => { throw new Error('fetch nie powinien ruszyć'); };
  await assert.rejects(waitForRelease({ baseUrl: 'http://example.test', expectedSha: SHA, expectedEnvironment: 'staging', fetchImpl }), /HTTPS/i);
  await assert.rejects(waitForRelease({ baseUrl: 'https://example.test', expectedSha: 'abc123', expectedEnvironment: 'staging', fetchImpl }), /SHA/i);
  await assert.rejects(waitForRelease({ baseUrl: 'https://example.test', expectedSha: 'A'.repeat(40), expectedEnvironment: 'staging', fetchImpl }), /SHA/i);
});

test('waliduje całą konfigurację przed pierwszym żądaniem', async () => {
  const { loadConfig, runRegression } = require('../scripts/run-regression');
  assert.throws(() => loadConfig('smoke', { MOTEK_BASE_URL: 'https://example.test', MOTEK_EXPECTED_SHA: SHA }), /MOTEK_ENVIRONMENT/);
  let fetched = false;
  await assert.rejects(runRegression({ profile: 'full', baseUrl: 'https://example.test', expectedSha: SHA, environment: 'production' }, {
    waitForRelease: async () => { fetched = true; },
  }), /staging/i);
  assert.equal(fetched, false);
});

test('pełny profil wymaga stagingu i danych QA, ale żadnego sekretu administratora', () => {
  const { loadConfig, DUMMY_CAPTCHA_TOKEN } = require('../scripts/run-regression');
  const base = { MOTEK_BASE_URL: 'https://staging.example.test', MOTEK_EXPECTED_SHA: SHA, MOTEK_ENVIRONMENT: 'staging' };
  assert.throws(() => loadConfig('full', base), /MOTEK_QA_EMAIL/);
  assert.throws(() => loadConfig('full', { ...base, MOTEK_QA_EMAIL: 'qa@example.test' }), /MOTEK_QA_PASSWORD/);
  assert.throws(() => loadConfig('full', { ...base, MOTEK_QA_EMAIL: 'qa@example.test', MOTEK_QA_PASSWORD: 'x', MOTEK_ENVIRONMENT: 'production' }), /staging/i);
  const config = loadConfig('full', { ...base, MOTEK_QA_EMAIL: 'qa@example.test', MOTEK_QA_PASSWORD: 'x' });
  assert.equal(config.captchaToken, DUMMY_CAPTCHA_TOKEN);
  assert.equal(config.supabaseSecret, undefined);
});

test('sanityzuje komunikat regresji bez ujawniania sekretów ani pełnych URL-i', () => {
  const { sanitizeErrorMessage } = require('../scripts/run-regression');
  const message = sanitizeErrorMessage(
    new Error('POST https://staging.example.test/api/auth/login failed for qa@example.test with pass-123'),
    { MOTEK_QA_EMAIL: 'qa@example.test', MOTEK_QA_PASSWORD: 'pass-123' },
  );
  assert.equal(message, 'POST [url] failed for [redacted] with [redacted]');
});

test('uruchamia wait, public i authenticated w kolejności oraz przekazuje apex dla produkcji smoke', async (t) => {
  const { loadConfig, runRegression } = require('../scripts/run-regression');
  await t.test('full staging', async () => {
    const calls = [];
    const config = loadConfig('full', {
      MOTEK_BASE_URL: 'https://staging.example.test', MOTEK_EXPECTED_SHA: SHA, MOTEK_ENVIRONMENT: 'staging',
      MOTEK_QA_EMAIL: 'qa@example.test', MOTEK_QA_PASSWORD: 'haslo',
    });
    await runRegression(config, {
      waitForRelease: async () => calls.push('wait'),
      runPublicRegression: async () => calls.push('public'),
      runAuthenticatedRegression: async (options) => { calls.push('authenticated'); assert.equal(options.captchaToken, 'XXXX.DUMMY.TOKEN.XXXX'); },
      createRunId: () => 'run-1',
    });
    assert.deepEqual(calls, ['wait', 'public', 'authenticated']);
  });

  await t.test('production smoke', async () => {
    let publicOptions;
    const config = loadConfig('smoke', {
      MOTEK_BASE_URL: 'https://www.rysia.org', MOTEK_EXPECTED_SHA: SHA, MOTEK_ENVIRONMENT: 'production',
    });
    await runRegression(config, {
      waitForRelease: async () => {},
      runPublicRegression: async (options) => { publicOptions = options; },
      runAuthenticatedRegression: async () => assert.fail('authenticated suite nie powinna ruszyć'),
    });
    assert.equal(publicOptions.apexUrl, 'https://rysia.org');
  });
});
