'use strict';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const ENVIRONMENTS = new Set(['staging', 'production']);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function validateOptions({ baseUrl, expectedSha, expectedEnvironment, timeoutMs, intervalMs, fetchImpl }) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('Release base URL must be a valid HTTPS URL');
  }
  const localHttp = url.protocol === 'http:' && url.hostname === 'localhost';
  requireCondition(url.protocol === 'https:' || localHttp, 'Release base URL must use HTTPS (HTTP is allowed only for localhost tests)');
  requireCondition(!url.username && !url.password, 'Release base URL must not contain credentials');
  requireCondition(SHA_PATTERN.test(String(expectedSha || '')), 'Expected release SHA must contain 40 lowercase hexadecimal characters');
  requireCondition(ENVIRONMENTS.has(expectedEnvironment), 'Expected release environment must be staging or production');
  requireCondition(Number.isFinite(timeoutMs) && timeoutMs >= 0, 'Release timeout must be a non-negative number');
  requireCondition(Number.isFinite(intervalMs) && intervalMs > 0, 'Release polling interval must be a positive number');
  requireCondition(typeof fetchImpl === 'function', 'Release fetch implementation is required');
  return url;
}

async function waitForRelease({
  baseUrl,
  expectedSha,
  expectedEnvironment,
  timeoutMs = 900000,
  intervalMs = 10000,
  fetchImpl = globalThis.fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  nowImpl = Date.now,
} = {}) {
  const base = validateOptions({ baseUrl, expectedSha, expectedEnvironment, timeoutMs, intervalMs, fetchImpl });
  const endpoint = new URL('/health/release', base);
  const startedAt = nowImpl();

  while (true) {
    try {
      const response = await fetchImpl(endpoint, { method: 'GET', headers: new Headers() });
      if (response.status === 200) {
        let body;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        if (body?.status === 'ready' && body.commit === expectedSha) {
          if (body.environment !== expectedEnvironment) {
            throw new Error('Release environment does not match the expected environment');
          }
          return body;
        }
      }
    } catch (error) {
      if (error?.message === 'Release environment does not match the expected environment') throw error;
    }

    const elapsed = nowImpl() - startedAt;
    if (elapsed >= timeoutMs) throw new Error('Timed out waiting for the expected release');
    await sleepImpl(Math.min(intervalMs, timeoutMs - elapsed));
  }
}

module.exports = { waitForRelease };
