'use strict';

const { createHttpSession } = require('./http-session');

const RUN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function summarizeSessionState(body) {
  return JSON.stringify({
    authenticated: body?.authenticated === true,
    userPresent: Boolean(body?.user),
    profilePresent: Boolean(body?.profile),
    legal: body?.legal
      ? {
        currentVersion: body.legal.currentVersion || null,
        acceptedVersion: body.legal.acceptedVersion || null,
        acceptanceRequired: body.legal.acceptanceRequired === true,
      }
      : null,
  });
}

function summarizeSetCookieHeaders(headers) {
  const values = typeof headers?.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [];
  return values.map((header) => {
    const parts = header.split(';').map((part) => part.trim());
    const separator = parts[0].indexOf('=');
    const name = separator > 0 ? parts[0].slice(0, separator) : 'invalid';
    const value = separator > 0 ? parts[0].slice(separator + 1) : '';
    const maxAge = parts.find((part) => part.toLowerCase().startsWith('max-age=')) || 'none';
    return `${name}:len=${value.length}:${maxAge}`;
  }).join(',');
}

function validateInputs({ baseUrl, email, password, captchaToken, runId }) {
  requireCondition(typeof baseUrl === 'string' && baseUrl.trim(), 'Regression base URL is required');
  requireCondition(typeof email === 'string' && email.trim(), 'Regression email is required');
  requireCondition(typeof password === 'string' && password, 'Regression password is required');
  requireCondition(typeof captchaToken === 'string' && captchaToken.trim(), 'Regression CAPTCHA token is required');
  requireCondition(RUN_ID_PATTERN.test(String(runId || '')), 'Regression runId must be a short safe identifier');
}

async function readJson(response, label) {
  try {
    return JSON.parse(await response.text());
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

async function requireResponse(session, path, options, expectedStatus) {
  const method = String(options?.method || 'GET').toUpperCase();
  const response = await session.request(path, options);
  requireCondition(response.status === expectedStatus, `${method} ${path} returned status ${response.status}`);
  return response;
}

async function requireJson(session, path, options = {}, expectedStatus = 200) {
  const response = await requireResponse(session, path, options, expectedStatus);
  return { response, body: await readJson(response, `${String(options.method || 'GET').toUpperCase()} ${path}`) };
}

function requireEtag(response, label) {
  const etag = response.headers.get('etag');
  requireCondition(Boolean(etag), `${label} did not return an ETag`);
  return etag;
}

function yarnPayload(runId) {
  return {
    name: `regression-${runId}`,
    color: 'zielony',
    materials: ['wełna'],
    weightClass: 'dk',
    length: 300,
    weight: 100,
  };
}

function matchesYarnPayload(yarn, payload) {
  return yarn?.name === payload.name
    && yarn.color === payload.color
    && Array.isArray(yarn.materials)
    && yarn.materials.length === payload.materials.length
    && yarn.materials.every((material, index) => material === payload.materials[index])
    && yarn.weightClass === payload.weightClass
    && yarn.length === payload.length
    && yarn.weight === payload.weight;
}

async function runAuthenticatedRegression(options) {
  validateInputs(options || {});
  const { baseUrl, email, password, captchaToken, runId, fetchImpl } = options;
  const session = createHttpSession({ baseUrl, origin: new URL(baseUrl).origin, fetchImpl: fetchImpl || globalThis.fetch });
  const payload = yarnPayload(runId);
  let createdId = null;
  let recordMayExist = false;
  let expectedStoredPayload = payload;
  let logoutAttempted = false;
  let primaryError = null;
  let cleanupError = null;
  let logoutError = null;

  try {
    const login = await requireJson(session, '/api/auth/login', {
      method: 'POST',
      body: { email, password, captchaToken },
    });
    const cookiesAfterLogin = Object.keys(session.getCookies()).sort().join(',');

    const authenticated = await requireJson(session, '/api/auth/session');
    requireCondition(
      authenticated.body?.authenticated === true,
      `Authenticated session was not established (${summarizeSessionState(authenticated.body)}; cookiesBeforeSession=${cookiesAfterLogin}; cookiesAfterSession=${Object.keys(session.getCookies()).sort().join(',')}; setCookies=${summarizeSetCookieHeaders(login.response.headers)})`,
    );

    if (authenticated.body?.legal?.acceptanceRequired) {
      const currentVersion = authenticated.body.legal.currentVersion;
      requireCondition(typeof currentVersion === 'string' && currentVersion, 'Current legal document version is missing');
      await requireJson(session, '/api/legal/acceptance', {
        method: 'POST',
        body: { version: currentVersion },
      });
      const accepted = await requireJson(session, '/api/auth/session');
      requireCondition(accepted.body?.authenticated === true, 'Authenticated session was not restored after legal acceptance');
    }

    const activity = await requireJson(session, '/api/auth/activity', { method: 'POST' });
    requireCondition(activity.body?.authenticated === true, 'Authenticated activity refresh failed');

    const initial = await requireJson(session, '/api/yarns');
    const initialEtag = requireEtag(initial.response, 'GET /api/yarns');
    const created = await requireJson(session, '/api/yarns', {
      method: 'POST',
      headers: { 'If-Match': initialEtag },
      body: payload,
    }, 201);
    requireCondition(
      Number.isInteger(created.body?.id) && created.body.id > 0 && matchesYarnPayload(created.body, payload),
      'POST /api/yarns did not return the unique created yarn',
    );
    createdId = created.body.id;
    recordMayExist = true;

    const afterCreate = await requireJson(session, '/api/yarns');
    const afterCreateEtag = requireEtag(afterCreate.response, 'GET /api/yarns');
    requireCondition(
      Array.isArray(afterCreate.body)
        && afterCreate.body.some((yarn) => yarn?.id === createdId && matchesYarnPayload(yarn, payload)),
      'GET /api/yarns did not confirm the unique created yarn',
    );
    const yarnPath = `/api/yarns/${createdId}`;
    const patchedPayload = { ...payload, color: 'granatowy' };
    await requireJson(session, yarnPath, {
      method: 'PATCH',
      headers: { 'If-Match': afterCreateEtag },
      body: patchedPayload,
    });
    expectedStoredPayload = patchedPayload;
    await requireResponse(session, yarnPath, {
      method: 'PATCH',
      headers: { 'If-Match': afterCreateEtag },
      body: payload,
    }, 409);

    await requireJson(session, '/api/matches');
    const beforeDelete = await requireJson(session, '/api/yarns');
    const beforeDeleteEtag = requireEtag(beforeDelete.response, 'GET /api/yarns');
    requireCondition(
      Array.isArray(beforeDelete.body)
        && beforeDelete.body.some((yarn) => yarn?.id === createdId && matchesYarnPayload(yarn, expectedStoredPayload)),
      'GET /api/yarns did not confirm the yarn before delete',
    );
    await requireResponse(session, yarnPath, {
      method: 'DELETE',
      headers: { 'If-Match': beforeDeleteEtag },
    }, 204);
    recordMayExist = false;

    logoutAttempted = true;
    await requireJson(session, '/api/auth/logout', { method: 'POST' });
    const loggedOut = await requireJson(session, '/api/auth/session');
    requireCondition(loggedOut.body?.authenticated === false, 'Session remained authenticated after logout');
  } catch (error) {
    primaryError = error;
  } finally {
    if (recordMayExist && createdId !== null) {
      try {
        const current = await requireJson(session, '/api/yarns');
        const stillExists = Array.isArray(current.body)
          && current.body.some((yarn) => yarn?.id === createdId && matchesYarnPayload(yarn, expectedStoredPayload));
        if (stillExists) {
          await requireResponse(session, `/api/yarns/${createdId}`, {
            method: 'DELETE',
            headers: { 'If-Match': requireEtag(current.response, 'GET /api/yarns during cleanup') },
          }, 204);
        }
      } catch (error) {
        cleanupError = error;
      }
    }

    if (!logoutAttempted) {
      try {
        await requireJson(session, '/api/auth/logout', { method: 'POST' });
      } catch (error) {
        logoutError = error;
      }
    }
  }

  if (primaryError) {
    if (cleanupError) primaryError.cleanupError = cleanupError;
    if (logoutError) primaryError.logoutError = logoutError;
    throw primaryError;
  }
  if (cleanupError) throw cleanupError;
  if (logoutError) throw logoutError;
}

module.exports = { runAuthenticatedRegression };
