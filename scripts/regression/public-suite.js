'use strict';

const { createHttpSession } = require('./http-session');

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const APEX_PATH = '/regression-check?source=post-deploy';
const APEX_LOCATION = 'https://www.rysia.org/regression-check?source=post-deploy';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(response, label) {
  try {
    return JSON.parse(await response.text());
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

async function requireJson(session, path, expectedStatus = 200) {
  const response = await session.request(path);
  requireCondition(response.status === expectedStatus, `${path} returned status ${response.status}`);
  return { response, body: await readJson(response, path) };
}

function requireSecurityHeaders(response, label) {
  requireCondition(Boolean(response.headers.get('content-security-policy')), `${label} is missing Content-Security-Policy`);
  requireCondition(response.headers.get('x-content-type-options') === 'nosniff', `${label} is missing X-Content-Type-Options: nosniff`);
  requireCondition(!response.headers.has('access-control-allow-origin'), `${label} exposed Access-Control-Allow-Origin`);
}

function containsSecretField(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => /secret|private|token/i.test(key) || containsSecretField(child));
}

async function requireStaticMarker(session, path, marker) {
  const response = await session.request(path);
  requireCondition(response.status === 200, `${path} returned status ${response.status}`);
  const body = await response.text();
  requireCondition(marker.test(body), `${path} is missing its Motek content marker`);
  return response;
}

async function requireLegalPage(session, path) {
  const response = await session.request(path);
  requireCondition(response.status === 200, `${path} returned status ${response.status}`);
  requireSecurityHeaders(response, path);
  const body = await response.text();
  requireCondition(/data-legal-document/i.test(body), `${path} is missing its legal document marker`);
  for (const anchor of ['#regulamin', '#prywatnosc', '#prawa-autorskie']) {
    requireCondition(body.includes(`href="${anchor}"`), `${path} is missing legal anchor ${anchor}`);
  }
  requireCondition(/termsVersion|Regulamin/i.test(body), `${path} is missing the legal document version marker`);
  return response;
}

async function runPublicRegression({ baseUrl, expectedSha, expectedEnvironment, fetchImpl, apexUrl }) {
  requireCondition(SHA_PATTERN.test(String(expectedSha || '')), 'Expected release SHA must contain 40 lowercase hexadecimal characters');
  requireCondition(Boolean(expectedEnvironment), 'Expected release environment is required');

  const effectiveFetch = fetchImpl || globalThis.fetch;
  const trustedOrigin = new URL(baseUrl).origin;
  const session = createHttpSession({ baseUrl, origin: trustedOrigin, fetchImpl: effectiveFetch });

  const live = await requireJson(session, '/health/live');
  requireCondition(live.body.status === 'ok', '/health/live returned an unexpected status');

  const ready = await requireJson(session, '/health/ready');
  requireCondition(ready.body.status === 'ready', '/health/ready returned an unexpected status');

  const release = await requireJson(session, '/health/release');
  requireCondition(release.body.status === 'ready', '/health/release returned an unexpected status');
  requireCondition(SHA_PATTERN.test(String(release.body.commit || '')), '/health/release commit is not a 40-character lowercase SHA');
  requireCondition(release.body.commit === expectedSha, '/health/release commit does not match the expected release commit');
  requireCondition(release.body.environment === expectedEnvironment, '/health/release environment does not match the expected environment');

  const page = await requireStaticMarker(session, '/', /<title>Motek\b/i);
  requireSecurityHeaders(page, '/');
  await requireStaticMarker(session, '/styles.css', /--hero-gradient\s*:/);
  await requireStaticMarker(session, '/app.js', /MotekClientPolicy/);
  await requireLegalPage(session, '/informacje-prawne');
  await requireLegalPage(session, '/informacje-prawne/');

  const config = await requireJson(session, '/api/config');
  requireSecurityHeaders(config.response, '/api/config');
  requireCondition(config.body?.captcha?.enabled === true, '/api/config CAPTCHA is not enabled');
  requireCondition(config.body.captcha.provider === 'turnstile', '/api/config CAPTCHA provider is not turnstile');
  requireCondition(typeof config.body.captcha.siteKey === 'string' && config.body.captcha.siteKey.trim(), '/api/config CAPTCHA siteKey is empty');
  requireCondition(!containsSecretField(config.body), '/api/config contains a secret field');

  await requireJson(session, '/api/patterns?limit=1&offset=0', 401);

  await requireJson(session, '/api/yarns', 401);
  await requireJson(session, '/api/matches', 401);

  const hostileSession = createHttpSession({ baseUrl, origin: 'https://regression.invalid', fetchImpl: effectiveFetch });
  const mutation = await hostileSession.request('/api/yarns', { method: 'POST', body: {} });
  requireCondition(mutation.status === 403, `POST /api/yarns with foreign Origin returned status ${mutation.status}`);

  const metrics = await session.request('/internal/metrics');
  requireCondition(metrics.status === 404, `/internal/metrics must be private (received status ${metrics.status})`);

  if (apexUrl) {
    const apexTarget = new URL(APEX_PATH, apexUrl);
    let redirect;
    try {
      redirect = await effectiveFetch(apexTarget, { method: 'GET', redirect: 'manual', headers: new Headers() });
    } catch {
      throw new Error('Apex redirect request failed');
    }
    requireCondition(
      (redirect.status === 301 || redirect.status === 308) && redirect.headers.get('location') === APEX_LOCATION,
      'Apex redirect did not return the required permanent canonical Location',
    );
  }
}

module.exports = { runPublicRegression };
