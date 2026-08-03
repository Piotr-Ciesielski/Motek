'use strict';

const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function validateBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  const localHttp = url.protocol === 'http:'
    && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !localHttp) {
    throw new Error('Regression HTTP sessions require HTTPS (except localhost tests)');
  }
  return url;
}

function setCookieValues(headers) {
  if (typeof headers?.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const combined = headers?.get?.('set-cookie');
  return combined ? combined.split(/,(?=\s*[^;,=]+=[^;,]*)/) : [];
}

function updateCookieJar(jar, headers) {
  for (const header of setCookieValues(headers)) {
    const parts = header.split(';').map((part) => part.trim());
    const separator = parts[0].indexOf('=');
    if (separator <= 0) continue;
    const name = parts[0].slice(0, separator);
    const value = parts[0].slice(separator + 1);
    const attributes = parts.slice(1);
    const expired = attributes.some((attribute) => {
      const [rawName, ...rawValue] = attribute.split('=');
      const attributeName = rawName.toLowerCase();
      const attributeValue = rawValue.join('=');
      if (attributeName === 'max-age') return Number(attributeValue) <= 0;
      if (attributeName === 'expires') return Date.parse(attributeValue) <= Date.now();
      return false;
    });
    if (!value || expired) jar.delete(name);
    else jar.set(name, value);
  }
}

function safeRequestLabel(method, url) {
  return `${method} ${url.pathname}`;
}

function isJsonBody(body) {
  if (body === null || typeof body !== 'object') return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return false;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false;
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return false;
  return true;
}

function createHttpSession({ baseUrl, origin, fetchImpl = globalThis.fetch }) {
  const base = validateBaseUrl(baseUrl);
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const jar = new Map();

  async function request(path, options = {}) {
    const url = new URL(path, base);
    validateBaseUrl(url);
    const method = String(options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers);
    let body = options.body;

    if (jar.size > 0 && !headers.has('Cookie')) {
      headers.set('Cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
    }
    if (UNSAFE_METHODS.has(method)) headers.set('Origin', origin);
    if (isJsonBody(body)) {
      body = JSON.stringify(body);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    }

    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        method,
        headers,
        body,
        signal: options.signal || AbortSignal.timeout(10_000),
      });
    } catch (error) {
      const reason = error?.name || 'request failed';
      throw new Error(`${safeRequestLabel(method, url)} failed: ${reason}`);
    }
    updateCookieJar(jar, response.headers);
    return response;
  }

  async function json(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const url = new URL(path, base);
    const response = await request(path, options);
    if (!response.ok) {
      throw new Error(`${safeRequestLabel(method, url)} failed with status ${response.status}`);
    }
    try {
      return JSON.parse(await response.text());
    } catch {
      throw new Error(`${safeRequestLabel(method, url)} failed: invalid JSON`);
    }
  }

  return {
    request,
    json,
    getCookies: () => Object.fromEntries(jar),
  };
}

module.exports = { createHttpSession };
