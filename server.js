const http = require("http");
const net = require("net");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {
  createSupabaseAuthClient,
  createSupabaseConnection,
  readSupabaseAuthConfig,
} = require("./supabase");
const { validateRegistrationLegalInput } = require("./registration-policy");
const { createLegalAccessService } = require("./legal-access-service");
const {
  maxYarnsPerUser: MAX_YARNS_PER_USER,
  maxPatternCatalogRecords: MAX_PATTERN_CATALOG_RECORDS,
  maxMatchingVariantsPerPattern: MAX_MATCH_VARIANTS,
} = require("./limits");
const {
  normalizeYarnMaterials,
} = require("./material-policy");
const {
  normalizeMatchingDocument,
} = require("./matching-policy");
const { ACCOUNT_DELETION_PHRASE, validateAccountDeletionInput } = require("./account-deletion-policy");
const { deleteSupabaseAccount } = require("./account-deletion-service");
const {
  normalizeCaptchaToken,
  readCaptchaConfig,
  validateDeploymentConfig,
} = require("./deployment-policy");
const { createMetricsRegistry } = require("./observability");
const {
  evaluateMatchingVariantsWithDiagnostics,
  evaluateMatchingVariants,
  scorePattern,
  selectMatchingYarns,
} = require("./server/matching-service");
const { createStaticFileHandler } = require("./server/static-files");
const { createPatternRouter } = require("./server/pattern-routes");
const { createYarnRouter } = require("./server/yarn-routes");
const { readReleaseInfo } = require("./release-info");
const { CURRENT_LEGAL_DOCUMENT } = require("./legal-document");
const { readLegalPublicationEnforcement, validateLegalPublication } = require("./legal-publication-policy");

const rootDir = __dirname;
let server;
let supabaseConnection;
let supabaseAuthConfig;
let supabaseAuthClientFactory = createSupabaseAuthClient;
let legalAccessService;
let captchaConfig = readCaptchaConfig();
let metricsEnabled = false;
let metricsRegistry = createMetricsRegistry();
let shuttingDown = false;
let readinessTimer = null;

const MAX_JSON_BODY_BYTES = 16 * 1024;
const AUTH_ACCESS_COOKIE = "motek_access_token";
const AUTH_REFRESH_COOKIE = "motek_refresh_token";
const AUTH_IDLE_COOKIE = "motek_idle_activity";
const AUTH_RECOVERY_GRANT_COOKIE = "motek_recovery_grant";
const AUTH_ACCESS_MAX_AGE = 60 * 60;
const AUTH_REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
const AUTH_IDLE_TIMEOUT_SECONDS = 2 * 60 * 60;
const AUTH_RECOVERY_GRANT_MAX_AGE = 10 * 60;
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_FAILURES = 5;
const AUTH_RATE_LIMIT_BLOCK_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ENTRIES = 10_000;
const AUTH_REQUEST_WINDOW_MS = 60 * 1000;
const AUTH_REQUEST_MAX = 30;
const AUTH_REQUEST_BLOCK_MS = 60 * 1000;
const AUTH_REQUEST_LIMITS = Object.freeze({
  "password-reset-request": {
    windowMs: 15 * 60 * 1000,
    maxRequests: 3,
    blockMs: 15 * 60 * 1000,
  },
  "password-change": {
    windowMs: 15 * 60 * 1000,
    maxRequests: 30,
    blockMs: 15 * 60 * 1000,
  },
  recovery: { windowMs: 10 * 60 * 1000, maxRequests: 5, blockMs: 10 * 60 * 1000 },
});
const YARN_WRITE_WINDOW_MS = 60 * 1000;
const YARN_WRITE_MAX = 600;
const YARN_WRITE_BLOCK_MS = 60 * 1000;
const MATCH_REQUEST_WINDOW_MS = 60 * 1000;
const MATCH_REQUEST_MAX = 30;
const MATCH_REQUEST_BLOCK_MS = 60 * 1000;
const HTTP_REQUEST_TIMEOUT_MS = 30 * 1000;
const HTTP_HEADERS_TIMEOUT_MS = 10 * 1000;
const HTTP_KEEP_ALIVE_TIMEOUT_MS = 5 * 1000;
const HTTP_BODY_TIMEOUT_MS = 10 * 1000;
const MAX_PATTERN_PAGE_SIZE = 50;
const authRateLimiter = createAuthRateLimiter();
const accountDeletionRateLimiter = createAccountDeletionRateLimiter();
const authRequestRateLimiter = createRequestRateLimiter({
  windowMs: AUTH_REQUEST_WINDOW_MS,
  maxRequests: AUTH_REQUEST_MAX,
  blockMs: AUTH_REQUEST_BLOCK_MS,
});
const authRequestRateLimiters = createAuthRequestRateLimiters();
const yarnWriteRateLimiter = createRequestRateLimiter({
  windowMs: YARN_WRITE_WINDOW_MS,
  maxRequests: YARN_WRITE_MAX,
  blockMs: YARN_WRITE_BLOCK_MS,
});
const matchRateLimiter = createRequestRateLimiter({
  windowMs: MATCH_REQUEST_WINDOW_MS,
  maxRequests: MATCH_REQUEST_MAX,
  blockMs: MATCH_REQUEST_BLOCK_MS,
});
const MAX_TEXT_LENGTH = {
  name: 100,
  color: 50,
};
const MAX_MEASUREMENT = 1_000_000;
const ALLOWED_WEIGHT_CLASSES = new Set(["lace", "fingering", "sport", "dk", "worsted", "bulky"]);
const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' https://challenges.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "frame-src https://challenges.cloudflare.com",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
});

const staticFileHandler = createStaticFileHandler({
  rootDir,
  securityHeaders: SECURITY_HEADERS,
  files: {
    "/": "index.html",
    "/index.html": "index.html",
    "/informacje-prawne": "informacje-prawne.html",
    "/informacje-prawne/": "informacje-prawne.html",
    "/legal-document.js": "legal-document.js",
    "/client/legal-page.js": "client/legal-page.js",
    "/client/legal-acceptance-controller.js": "client/legal-acceptance-controller.js",
    "/styles.css": "styles.css",
    "/app.js": "app.js",
    "/client-policy.js": "client-policy.js",
    "/theme-policy.js": "theme-policy.js",
    "/material-policy.js": "material-policy.js",
    "/client/api-client.js": "client/api-client.js",
    "/client/dom-utils.js": "client/dom-utils.js",
    "/client/catalog-controller.js": "client/catalog-controller.js",
    "/client/idle-session-controller.js": "client/idle-session-controller.js",
    "/assets/color-yarn-cat.png": "assets/color-yarn-cat.png",
    "/assets/night-yarn-cat.png": "assets/night-yarn-cat.png",
    "/assets/color-yarn-cat.v1.webp": "assets/color-yarn-cat.v1.webp",
    "/assets/night-yarn-cat.v1.webp": "assets/night-yarn-cat.v1.webp",
    "/favicon.svg": "favicon.svg",
  },
});

const patternRouter = createPatternRouter({
  sendJson,
  requireAuthenticatedSession,
  requireCurrentTermsSession,
  getCatalogPatterns,
  getSupabaseMatches,
  parsePatternPage,
  enforceRequestRateLimit,
  getMatchRateLimitKeys,
  matchRateLimiter,
});

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(text);
}

const yarnRouter = createYarnRouter({
  ApiError,
  sendJson,
  getYarnCollectionVersion,
  getSupabaseYarns,
  getSupabaseYarnVersion,
  insertSupabaseYarn,
  updateSupabaseYarn,
  deleteSupabaseYarn,
  sendYarnMutationResponse,
  requireAuthenticatedSession: requireCurrentTermsSession,
  requireCurrentYarnVersion,
  validateYarn,
  readBody,
  enforceRequestRateLimit,
  yarnWriteRateLimiter,
});

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return cookies;
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
      return cookies;
    }, {});
}

function appendSetCookie(res, value) {
  const current = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(current) ? current : current ? [current] : [];
  res.setHeader("Set-Cookie", [...cookies, value]);
}

function shouldUseSecureCookies(env = process.env) {
  const configured = String(env.COOKIE_SECURE || "").trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return env.NODE_ENV === "production";
}

function createAuthRateLimiter(options = {}) {
  const windowMs = options.windowMs || AUTH_RATE_LIMIT_WINDOW_MS;
  const maxFailures = options.maxFailures || AUTH_RATE_LIMIT_MAX_FAILURES;
  const blockMs = options.blockMs || AUTH_RATE_LIMIT_BLOCK_MS;
  const maxEntries = Math.max(1, options.maxEntries || AUTH_RATE_LIMIT_MAX_ENTRIES);
  const now = options.now || (() => Date.now());
  const entries = new Map();

  function pruneExpired(currentTime) {
    for (const [key, entry] of entries) {
      if (entry.blockedUntil <= currentTime && currentTime - entry.windowStartedAt >= windowMs) {
        entries.delete(key);
      }
    }
  }

  function getEntry(key) {
    const currentTime = now();
    pruneExpired(currentTime);
    const current = entries.get(key);
    if (!current || currentTime - current.windowStartedAt >= windowMs) {
      if (!current && entries.size >= maxEntries) {
        entries.delete(entries.keys().next().value);
      }
      const fresh = { failures: 0, windowStartedAt: currentTime, blockedUntil: 0 };
      entries.set(key, fresh);
      return fresh;
    }
    return current;
  }

  return {
    getRetryAfterMs(key) {
      const currentTime = now();
      pruneExpired(currentTime);
      const entry = entries.get(key);
      if (!entry || entry.blockedUntil <= currentTime) return 0;
      return entry.blockedUntil - currentTime;
    },
    recordFailure(key) {
      const entry = getEntry(key);
      entry.failures += 1;
      if (entry.failures >= maxFailures) {
        entry.blockedUntil = now() + blockMs;
      }
    },
    clear(key) {
      entries.delete(key);
    },
    size() {
      pruneExpired(now());
      return entries.size;
    },
  };
}

function createAccountDeletionRateLimiter(options = {}) {
  return createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxFailures: 5,
    blockMs: 15 * 60 * 1000,
    ...options,
  });
}

function createRequestRateLimiter(options = {}) {
  const limiter = createAuthRateLimiter({
    windowMs: options.windowMs,
    maxFailures: options.maxRequests,
    blockMs: options.blockMs,
    maxEntries: options.maxEntries,
    now: options.now,
  });

  return {
    getRetryAfterMs: limiter.getRetryAfterMs,
    recordRequest: limiter.recordFailure,
    size: limiter.size,
  };
}

function createAuthRequestRateLimiters({ now } = {}) {
  return Object.fromEntries(
    Object.entries(AUTH_REQUEST_LIMITS).map(([operation, options]) => [
      operation,
      createRequestRateLimiter({ ...options, ...(now ? { now } : {}) }),
    ]),
  );
}

function getClientAddress(req, env = process.env) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "")
    .split(",", 1)[0]
    .trim();
  const address = String(env.TRUST_PROXY || "").toLowerCase() === "true"
    && net.isIP(forwarded)
    ? forwarded
    : req.socket?.remoteAddress || "unknown";
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

function getAuthRateLimitKeys(req, email) {
  return [`ip:${getClientAddress(req)}`, `email:${email}`];
}

function getMatchRateLimitKeys(req, session) {
  return [`ip:${getClientAddress(req)}`, `user:${session.user.id}`];
}

function enforceAuthRateLimit(keys, res) {
  const retryAfterMs = Math.max(...keys.map((key) => authRateLimiter.getRetryAfterMs(key)));
  if (retryAfterMs > 0) {
    res?.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    throw new ApiError(429, "Zbyt wiele nieudanych prób. Spróbuj ponownie później.");
  }
}

function enforceRequestRateLimit(keys, limiter, res) {
  const retryAfterMs = Math.max(...keys.map((key) => limiter.getRetryAfterMs(key)));
  if (retryAfterMs > 0) {
    res?.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    throw new ApiError(429, "Zbyt wiele żądań. Spróbuj ponownie później.");
  }
  keys.forEach((key) => limiter.recordRequest(key));
}

function recordAuthFailure(keys) {
  keys.forEach((key) => authRateLimiter.recordFailure(key));
}

function clearAuthFailures(keys) {
  keys.forEach((key) => authRateLimiter.clear(key));
}

function validateCookieSecurityConfig(env = process.env) {
  if (env.NODE_ENV === "production" && String(env.COOKIE_SECURE).toLowerCase() !== "true") {
    throw new Error("W środowisku produkcyjnym COOKIE_SECURE=true jest wymagane dla ciasteczek sesji.");
  }
}

function validateOriginConfig(env = process.env) {
  if (env.NODE_ENV !== "production") return;
  const configured = String(env.APP_ORIGIN || "").trim();
  if (!configured) {
    throw new Error("W środowisku produkcyjnym APP_ORIGIN jest wymagane dla ochrony CSRF.");
  }
  try {
    const origin = new URL(configured);
    if (!origin.origin || origin.pathname !== "/" || origin.search || origin.hash) {
      throw new Error("invalid origin");
    }
  } catch {
    throw new Error("APP_ORIGIN musi być pełnym adresem origin, np. https://motek.example.com.");
  }
}

function getExpectedOrigin(req) {
  const configured = String(process.env.APP_ORIGIN || "").trim();
  if (configured) return new URL(configured).origin;
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${req.headers.host}`;
}

function requireTrustedOrigin(req) {
  const suppliedOrigin = req.headers.origin || req.headers.referer;
  if (!suppliedOrigin) {
    throw new ApiError(403, "Brak wymaganego zabezpieczenia pochodzenia żądania.");
  }

  let actualOrigin;
  try {
    actualOrigin = new URL(suppliedOrigin).origin;
  } catch {
    throw new ApiError(403, "Nieprawidłowe pochodzenie żądania.");
  }

  if (actualOrigin !== getExpectedOrigin(req)) {
    throw new ApiError(403, "Żądanie pochodzi z niedozwolonego źródła.");
  }
}

function buildAuthCookie(name, value, maxAge, env = process.env) {
  const secure = shouldUseSecureCookies(env) ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function getIdleTimeoutSeconds(env = process.env) {
  const raw = env.AUTH_IDLE_TIMEOUT_SECONDS;
  if (raw === undefined || raw === null || String(raw).trim() === "") return AUTH_IDLE_TIMEOUT_SECONDS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("AUTH_IDLE_TIMEOUT_SECONDS musi być dodatnią liczbą całkowitą.");
  }
  return value;
}

function getIdleTimeoutMs(env = process.env) {
  return getIdleTimeoutSeconds(env) * 1000;
}

function getIdleSessionSecret(env = process.env) {
  const secret = String(env.IDLE_SESSION_SECRET || env.SUPABASE_SECRET_KEY || "");
  if (!secret) throw new Error("Brak sekretu podpisu sesji bezczynności.");
  return secret;
}

function getRecoveryGrantSecret(env = process.env) {
  const secret = String(env.RECOVERY_GRANT_SECRET || env.IDLE_SESSION_SECRET || env.SUPABASE_SECRET_KEY || "");
  if (!secret) throw new Error("Brak sekretu podpisu grantu odzyskiwania hasła.");
  return secret;
}

function buildRecoveryGrantCookie(userId, options = {}) {
  const jti = typeof options.jti === "string" && options.jti ? options.jti : crypto.randomUUID();
  const timestamp = Math.floor(Number(options.timestamp ?? Date.now() / 1000));
  const env = options.env || process.env;
  const payload = `${userId}.${jti}.${timestamp}`;
  const signature = crypto.createHmac("sha256", getRecoveryGrantSecret(env))
    .update(`recovery:${payload}`)
    .digest("base64url");
  return buildAuthCookie(AUTH_RECOVERY_GRANT_COOKIE, `${payload}.${signature}`, AUTH_RECOVERY_GRANT_MAX_AGE, env);
}

function parseRecoveryGrantCookie(value, userId, now = Math.floor(Date.now() / 1000), env = process.env) {
  if (typeof value !== "string" || typeof userId !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const [rawUserId, jti, rawTimestamp, signature] = parts;
  const timestamp = Number(rawTimestamp);
  if (!rawUserId || rawUserId !== userId || !jti || !Number.isSafeInteger(timestamp) || !signature) return false;
  const expected = crypto.createHmac("sha256", getRecoveryGrantSecret(env))
    .update(`recovery:${rawUserId}.${jti}.${timestamp}`)
    .digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    && now >= timestamp
    && now - timestamp <= AUTH_RECOVERY_GRANT_MAX_AGE;
}

function getRecoveryGrantJti(value, userId) {
  if (!parseRecoveryGrantCookie(value, userId)) return null;
  const [, jti] = value.split(".");
  return jti || null;
}

function signIdleActivity(timestamp, env = process.env) {
  return crypto.createHmac("sha256", getIdleSessionSecret(env))
    .update(String(timestamp))
    .digest("base64url");
}

function buildIdleActivityCookie(timestamp, env = process.env) {
  const normalizedTimestamp = Math.floor(Number(timestamp));
  const value = `${normalizedTimestamp}.${signIdleActivity(normalizedTimestamp, env)}`;
  return buildAuthCookie(AUTH_IDLE_COOKIE, value, getIdleTimeoutSeconds(env), env);
}

function parseIdleActivityCookie(value, env = process.env, now = Math.floor(Date.now() / 1000)) {
  if (typeof value !== "string") return null;
  const [rawTimestamp, signature] = value.split(".");
  const timestamp = Number(rawTimestamp);
  if (!Number.isSafeInteger(timestamp) || !signature) return null;
  const expectedBuffer = Buffer.from(signIdleActivity(timestamp, env));
  const receivedBuffer = Buffer.from(signature);
  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  const age = now - timestamp;
  return age >= 0 && age <= getIdleTimeoutSeconds(env) ? timestamp : null;
}

function setIdleActivityCookie(res, timestamp = Math.floor(Date.now() / 1000)) {
  appendSetCookie(res, buildIdleActivityCookie(timestamp));
}

function setAuthCookies(res, session) {
  if (!session?.access_token || !session?.refresh_token) return;
  appendSetCookie(
    res,
    buildAuthCookie(AUTH_ACCESS_COOKIE, session.access_token, AUTH_ACCESS_MAX_AGE)
  );
  appendSetCookie(
    res,
    buildAuthCookie(AUTH_REFRESH_COOKIE, session.refresh_token, AUTH_REFRESH_MAX_AGE)
  );
  setIdleActivityCookie(res);
}

function clearAuthCookies(res) {
  appendSetCookie(res, buildAuthCookie(AUTH_ACCESS_COOKIE, "", 0));
  appendSetCookie(res, buildAuthCookie(AUTH_REFRESH_COOKIE, "", 0));
  appendSetCookie(res, buildAuthCookie(AUTH_IDLE_COOKIE, "", 0));
  appendSetCookie(res, buildAuthCookie(AUTH_RECOVERY_GRANT_COOKIE, "", 0));
}

function normalizeAuthEmail(value) {
  if (typeof value !== "string") {
    throw new ApiError(400, "Podaj prawidłowy adres e-mail.");
  }

  const email = value.trim().toLowerCase();
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  ) {
    throw new ApiError(400, "Podaj prawidłowy adres e-mail.");
  }
  return email;
}

function normalizeRecoveryToken(value, field) {
  if (typeof value !== "string" || !value.trim() || value.length > 4096) {
    throw new ApiError(400, `Token ${field} jest nieprawidłowy lub wygasł.`);
  }
  return value.trim();
}

function normalizeAuthLogin(value) {
  return normalizeAuthEmail(value);
}

function validateAuthPassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 256) {
    throw new ApiError(400, "Hasło musi mieć od 8 do 256 znaków.");
  }
  if (/^\s+$/u.test(value)) {
    throw new ApiError(400, "Hasło nie może składać się wyłącznie ze spacji.");
  }
  if (!/\p{Ll}/u.test(value) || !/\p{Lu}/u.test(value) || !/\p{Nd}/u.test(value) || !/[^\p{L}\p{N}\s]/u.test(value)) {
    throw new ApiError(400, "Hasło musi zawierać małą i wielką literę Unicode, cyfrę Unicode oraz znak specjalny.");
  }
  return value;
}

function authClient() {
  if (!supabaseAuthConfig) {
    throw new ApiError(503, "Logowanie nie jest jeszcze skonfigurowane.");
  }
  return supabaseAuthClientFactory(supabaseAuthConfig);
}

function sanitizeAuthUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    metadata: {
      login: user.user_metadata?.login || null,
    },
  };
}

function genericAuthError(operation) {
  if (operation === "login") {
    return new ApiError(401, "Nieprawidłowy e-mail lub hasło.");
  }
  if (operation === "confirmation") {
    return new ApiError(400, "Link potwierdzający jest nieprawidłowy lub wygasł.");
  }
  return new ApiError(400, "Nie udało się utworzyć konta. Sprawdź dane i spróbuj ponownie.");
}

function isTransientAuthError(error) {
  const status = Number(error?.status);
  return error?.name === "AuthRetryableFetchError"
    || status === 408
    || status === 429
    || status >= 500;
}

function isUncertainPasswordChangeError(error) {
  return error?.name === "AuthSessionMissingError" || isTransientAuthError(error);
}

async function updateLastLogin(userId) {
  if (!supabaseConnection?.client || !userId) return;
  const { error } = await supabaseConnection.client
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    console.warn("Nie udało się zaktualizować daty ostatniego logowania.");
  }
}

async function getAuthenticatedSession(req, res) {
  if (!supabaseAuthConfig) return null;

  const cookies = parseCookies(req.headers.cookie);
  const accessToken = cookies[AUTH_ACCESS_COOKIE];
  const refreshToken = cookies[AUTH_REFRESH_COOKIE];
  if (!accessToken && !refreshToken) return null;
  if (!parseIdleActivityCookie(cookies[AUTH_IDLE_COOKIE])) {
    clearAuthCookies(res);
    return null;
  }

  const client = supabaseAuthClientFactory(supabaseAuthConfig);
  let activeAccessToken = accessToken;
  let activeRefreshToken = refreshToken;
  let userResult = accessToken
    ? await client.auth.getUser(accessToken)
    : { data: null, error: new Error("Brak tokenu dostępu") };

  if (userResult.error && refreshToken) {
    const refreshed = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.data?.session) {
      setAuthCookies(res, refreshed.data.session);
      activeAccessToken = refreshed.data.session.access_token;
      activeRefreshToken = refreshed.data.session.refresh_token || activeRefreshToken;
      userResult = await client.auth.getUser(activeAccessToken);
    }
  }

  if (userResult.error || !userResult.data?.user) {
    clearAuthCookies(res);
    return null;
  }

  const profileClient = supabaseConnection?.client;
  if (!profileClient) {
    throw new ApiError(503, "Nie udało się teraz zweryfikować konta. Spróbuj ponownie.");
  }
  let profileResult;
  try {
    profileResult = await profileClient
      .from("profiles")
      .select("id,login,email,avatar_url,status,role,created_at,updated_at,last_login_at")
      .eq("id", userResult.data.user.id)
      .maybeSingle();
  } catch {
    throw new ApiError(503, "Nie udało się teraz zweryfikować konta. Spróbuj ponownie.");
  }

  if (profileResult.error) {
    throw new ApiError(503, "Nie udało się teraz zweryfikować konta. Spróbuj ponownie.");
  }

  if (!profileResult.data) {
    clearAuthCookies(res);
    return null;
  }

  if (profileResult.data.status !== "active") {
    clearAuthCookies(res);
    throw new ApiError(403, "Konto jest zawieszone lub zablokowane.");
  }

  let legal;
  try {
    legal = await legalAccessService.getAccountAccessState(userResult.data.user.id);
  } catch {
    throw new ApiError(503, "Stan dokumentów prawnych jest chwilowo niedostępny.");
  }

  setIdleActivityCookie(res);

  return {
    user: userResult.data.user,
    profile: profileResult.data,
    accessToken: activeAccessToken,
    refreshToken: activeRefreshToken,
    legal,
  };
}

async function requireAuthenticatedSession(req, res) {
  const session = await getAuthenticatedSession(req, res);
  if (!session) {
    throw new ApiError(401, "Zaloguj się, aby zarządzać swoim magazynem włóczek.");
  }
  return session;
}

async function requireCurrentTermsSession(req, res) {
  const session = await requireAuthenticatedSession(req, res);
  if (session.legal.acceptanceRequired) {
    throw new ApiError(403, "Zaakceptuj aktualną wersję dokumentów, aby korzystać z tej funkcji.");
  }
  return session;
}

function normalizeSupabaseYarn(yarn) {
  return {
    id: Number(yarn.id),
    name: yarn.name,
    color: yarn.color,
    materials: Array.isArray(yarn.materials) ? yarn.materials : [],
    weightClass: yarn.weight_class,
    length: Number(yarn.length_meters),
    weight: Number(yarn.weight_grams),
    updatedAt: yarn.updated_at || null,
  };
}

function getYarnCollectionVersion(version) {
  return `"yarn-v${version}"`;
}

function parseYarnVersion(value) {
  const match = /^"yarn-v(\d+)"$/.exec(value || "");
  if (!match) return null;
  return Number(match[1]);
}

async function requireCurrentYarnVersion(req) {
  const expectedVersion = req.headers["if-match"];
  const parsedVersion = parseYarnVersion(expectedVersion);
  if (parsedVersion === null) {
    throw new ApiError(428, "Odśwież magazyn przed zapisaniem zmian.");
  }
  return parsedVersion;
}

function toSupabaseYarn(yarn, userId) {
  return {
    user_id: userId,
    ...toSupabaseYarnFields(yarn),
  };
}

function toSupabaseYarnFields(yarn) {
  return {
    name: yarn.name,
    color: yarn.color,
    materials: yarn.materials,
    weight_class: yarn.weightClass,
    length_meters: yarn.length,
    weight_grams: yarn.weight,
  };
}

async function getSupabaseYarns(session) {
  const { data, error } = await supabaseAuthClientFactory(
    supabaseAuthConfig,
    session.accessToken
  )
    .from("yarns")
    .select("id,name,color,materials,weight_class,length_meters,weight_grams,updated_at")
    .eq("user_id", session.user.id)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Nie udało się pobrać włóczek z Supabase: ${error.message}`);
  }

  return data.map(normalizeSupabaseYarn);
}

async function getSupabaseYarnVersion(session) {
  const { data, error } = await supabaseAuthClientFactory(
    supabaseAuthConfig,
    session.accessToken
  ).rpc("get_yarn_store_version");
  if (error) {
    throw new Error(`Nie udało się pobrać wersji magazynu z Supabase: ${error.message}`);
  }
  return Number(data);
}

function handleYarnRpcError(error, action) {
  if (error.code === "P0003" || error.code === "40001") {
    throw new ApiError(409, "Magazyn został zmieniony w innej karcie. Odśwież dane i spróbuj ponownie.");
  }
  if (error.code === "P0002") {
    throw new ApiError(404, "Nie znaleziono włóczki o podanym identyfikatorze.");
  }
  if (error.code === "P0001") {
    throw new ApiError(409, "Magazyn osiągnął limit 500 włóczek na użytkownika.");
  }
  if (error.code === "PGRST202" || error.code === "42883") {
    throw new ApiError(503, "Backend Supabase nie ma wymaganej migracji magazynu. Skontaktuj się z administratorem.");
  }
  throw new Error(`${action}: ${error.message}`);
}

async function insertSupabaseYarn(session, yarn) {
  const { data, error } = await supabaseAuthClientFactory(
    supabaseAuthConfig,
    session.accessToken
  )
    .rpc("insert_yarn_versioned", {
      p_expected_version: yarn.expectedVersion,
      p_name: yarn.name,
      p_color: yarn.color,
      p_materials: yarn.materials,
      p_weight_class: yarn.weightClass,
      p_length_meters: yarn.length,
      p_weight_grams: yarn.weight,
    });

  if (error) {
    handleYarnRpcError(error, "Nie udało się zapisać włóczki w Supabase");
  }
  if (!data?.yarn) {
    throw new Error("Supabase nie zwróciło zapisanej włóczki.");
  }
  return { yarn: normalizeSupabaseYarn(data.yarn), version: Number(data.version) };
}

async function updateSupabaseYarn(session, id, yarn) {
  const { data, error } = await supabaseAuthClientFactory(
    supabaseAuthConfig,
    session.accessToken
  )
    .rpc("update_yarn_versioned", {
      p_expected_version: yarn.expectedVersion,
      p_id: id,
      p_name: yarn.name,
      p_color: yarn.color,
      p_materials: yarn.materials,
      p_weight_class: yarn.weightClass,
      p_length_meters: yarn.length,
      p_weight_grams: yarn.weight,
    });

  if (error) {
    handleYarnRpcError(error, "Nie udało się zaktualizować włóczki w Supabase");
  }
  if (!data?.yarn) throw new Error("Supabase nie zwróciło zaktualizowanej włóczki.");
  return { yarn: normalizeSupabaseYarn(data.yarn), version: Number(data.version) };
}

async function deleteSupabaseYarn(session, id, expectedVersion) {
  const { data, error } = await supabaseAuthClientFactory(
    supabaseAuthConfig,
    session.accessToken
  )
    .rpc("delete_yarn_versioned", {
      p_expected_version: expectedVersion,
      p_id: id,
    });

  if (error) {
    handleYarnRpcError(error, "Nie udało się usunąć włóczki z Supabase");
  }
  return { version: Number(data?.version) };
}

async function sendYarnMutationResponse(res, status, mutation) {
  const version = getYarnCollectionVersion(mutation.version);
  res.setHeader("ETag", version);
  res.setHeader("X-Motek-Yarn-Version", version);
  return sendJson(res, status, status === 204 ? null : mutation.yarn);
}

async function getSupabaseMatches(session, { diagnostics: includeDiagnostics = false } = {}) {
  const [yarns, patterns] = await Promise.all([
    getSupabaseYarns(session),
    getCatalogPatterns(),
  ]);

  validateMatchLimits(patterns);
  let limited = false;
  const diagnostics = [];
  const matches = patterns
    .filter((pattern) => !pattern.needsReview)
    .flatMap((pattern) => {
      const result = includeDiagnostics
        ? evaluateMatchingVariantsWithDiagnostics(pattern.matchingRequirements, yarns)
        : evaluateMatchingVariants(pattern.matchingRequirements, yarns);
      limited ||= result.limited;
      if (includeDiagnostics && result.matches.length === 0) {
        if (result.diagnostic) {
          const { variant, outcome } = result.diagnostic;
          diagnostics.push({
            pattern: {
              id: `${pattern.id}:${variant.id}`,
              patternId: pattern.id,
              baseName: pattern.name,
              name: `${pattern.name} — ${variant.label}`,
              description: pattern.description,
              variantLabel: variant.label,
              label: variant.label,
              size: variant.size,
              yarnOption: variant.yarnOption,
              requirements: variant.requirements,
            },
            status: outcome.status,
            reasons: outcome.reasons,
          });
        }
      }
      return result.matches.map(({ variant, outcome }) => {
        const allocatedYarns = outcome.allocation.flat();
        const allocation = variant.requirements.map((requirement, index) => ({
          role: requirement.role,
          yarns: outcome.allocation[index].map((yarn) => ({
            id: yarn.id,
            name: yarn.name,
            color: yarn.color,
            materials: yarn.materials,
            weightClass: yarn.weightClass,
            length: yarn.length,
            weight: yarn.weight,
          })),
        }));
        return {
          pattern: {
            ...pattern,
            ...variant,
            id: `${pattern.id}:${variant.id}`,
            patternId: pattern.id,
            baseName: pattern.name,
            variantLabel: variant.label,
            name: `${pattern.name} — ${variant.label}`,
          },
          total: outcome.coverage,
          doable: true,
          totalLength: allocatedYarns.reduce(
            (sum, yarn) => sum + yarn.length,
            0,
          ),
          totalWeight: allocatedYarns.reduce(
            (sum, yarn) => sum + yarn.weight,
            0,
          ),
          matchedYarns: allocatedYarns.length,
          allocation,
        };
      });
    })
    .filter((item) => item.doable)
    .sort((a, b) => b.total - a.total);

  return { matches, diagnostics, limited };
}

function validateMatchLimits(patterns) {
  const variantCount = patterns.reduce(
    (total, pattern) => total + pattern.matchingRequirements.length,
    0
  );
  if (variantCount > MAX_MATCH_VARIANTS) {
    throw new ApiError(
      503,
      "Katalog zawiera zbyt wiele wariantów do jednego dopasowania. Spróbuj później lub zawęź katalog."
    );
  }
}

async function readBodyContent(req) {
  const chunks = [];
  let receivedBytes = 0;

  for await (const chunk of req) {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_JSON_BODY_BYTES) {
      throw new ApiError(413, "Przesłane dane są zbyt duże.");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    throw new ApiError(400, "Treść żądania nie może być pusta.");
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "Przesłano nieprawidłowy JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Treść żądania musi być obiektem JSON.");
  }

  return body;
}

async function readBody(req) {
  const contentType = String(req.headers["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    throw new ApiError(415, "Oczekiwano danych w formacie application/json.");
  }

  const declaredLength = Number(req.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, "Przesłane dane są zbyt duże.");
  }

  let timeout;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => {
      req.destroy();
      reject(new ApiError(408, "Przekroczono czas przesyłania danych."));
    }, HTTP_BODY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([readBodyContent(req), timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeCatalogPattern(pattern) {
  const ratio =
    pattern.meters_per_100g === null || pattern.meters_per_100g === undefined
      ? null
      : Number(pattern.meters_per_100g);

  return {
    id: Number(pattern.id),
    name: pattern.name,
    description: typeof pattern.description === "string" && pattern.description.trim()
      ? pattern.description.trim()
      : null,
    officialSourceUrl: (() => {
      try {
        const url = new URL(pattern.official_source_url);
        return url.protocol === "https:" ? url.href : null;
      } catch {
        return null;
      }
    })(),
    projectType: pattern.project_type || "other",
    materials: Array.isArray(pattern.materials) ? pattern.materials : [],
    metersPer100g: Number.isFinite(ratio) ? ratio : null,
    yarnRequirements: Array.isArray(pattern.yarn_requirements)
      ? pattern.yarn_requirements
      : [],
    matchingRequirements: normalizeMatchingRequirements(pattern.matching_requirements),
    sourceLanguage: pattern.source_language || "unknown",
    needsReview: Boolean(pattern.needs_review),
  };
}

function normalizeMatchingRequirements(value) {
  try {
    return normalizeMatchingDocument(value);
  } catch {
    return [];
  }
}

async function getCatalogPatterns({ limit = null, offset = 0 } = {}, connection = supabaseConnection) {
  const patternClient = connection.client.from("patterns");
  const countQuery = patternClient.select("id", { count: "exact", head: true });
  const { count, error: countError } = await (typeof countQuery.eq === "function"
    ? countQuery.eq("publication_status", "published")
    : countQuery);

  if (countError) {
    throw new Error(`Nie udało się sprawdzić liczby wzorów w Supabase: ${countError.message}`);
  }

  validatePatternCatalogSize(count ?? 0);

  const effectiveLimit = limit ?? count ?? 0;
  const dataQuery = connection.client
    .from("patterns")
    .select(
      "id,name,description,project_type,materials,meters_per_100g,yarn_requirements,matching_requirements,source_language,needs_review,official_source_url"
    );
  const publishedQuery = typeof dataQuery.eq === "function"
    ? dataQuery.eq("publication_status", "published")
    : dataQuery;
  const { data, error } = await publishedQuery
    .range(offset, Math.max(offset, offset + effectiveLimit - 1))
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Nie udało się pobrać wzorów z Supabase: ${error.message}`);
  }

  const patterns = data.map(normalizeCatalogPattern);
  if (limit === null) return patterns;

  return {
    items: patterns,
    total: count ?? 0,
    limit: effectiveLimit,
    offset,
    hasMore: offset + patterns.length < (count ?? 0),
  };
}

function parsePatternPage(url) {
  const rawLimit = url.searchParams.get("limit");
  const rawOffset = url.searchParams.get("offset");
  const limit = rawLimit === null ? MAX_PATTERN_PAGE_SIZE : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PATTERN_PAGE_SIZE) {
    throw new ApiError(400, `Parametr limit musi być liczbą całkowitą od 1 do ${MAX_PATTERN_PAGE_SIZE}.`);
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ApiError(400, "Parametr offset musi być nieujemną liczbą całkowitą.");
  }

  return { limit, offset };
}

function validateYarnStorageCapacity(count) {
  if (count >= MAX_YARNS_PER_USER) {
    throw new ApiError(
      409,
      `Magazyn osiągnął limit ${MAX_YARNS_PER_USER} włóczek na użytkownika.`
    );
  }
}

function validatePatternCatalogSize(count) {
  if (count > MAX_PATTERN_CATALOG_RECORDS) {
    throw new ApiError(
      503,
      `Katalog wzorów przekracza limit aplikacji: maksymalnie ${MAX_PATTERN_CATALOG_RECORDS} rekordów.`
    );
  }
}

function normalizeText(value, field, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value !== "string") {
    throw new ApiError(400, `Pole ${field} musi być tekstem.`);
  }

  const normalized = value.trim();
  if (!normalized) return fallback;
  if (normalized.length > MAX_TEXT_LENGTH[field]) {
    throw new ApiError(400, `Pole ${field} jest zbyt długie.`);
  }
  return normalized;
}

function normalizeEnum(value, field, fallback, allowedValues) {
  const normalized = value === undefined || value === null || value === "" ? fallback : value;
  if (typeof normalized !== "string" || !allowedValues.has(normalized)) {
    throw new ApiError(400, `Pole ${field} ma niedozwoloną wartość.`);
  }
  return normalized;
}

function normalizeMeasurement(value, field) {
  const normalized = value === undefined || value === null || value === "" ? 0 : value;
  if (
    typeof normalized !== "number" ||
    !Number.isInteger(normalized) ||
    normalized < 1 ||
    normalized > MAX_MEASUREMENT
  ) {
    throw new ApiError(400, `Pole ${field} musi być liczbą całkowitą od 1 do ${MAX_MEASUREMENT}.`);
  }
  return normalized;
}

function normalizeMaterials(value) {
  try {
    return normalizeYarnMaterials(value);
  } catch (error) {
    throw new ApiError(400, error.message);
  }
}

function validateYarn(body) {
  return {
    name: normalizeText(body.name, "name", "Bez nazwy"),
    color: normalizeText(body.color, "color", "nieokreślony"),
    materials: normalizeMaterials(body.materials),
    weightClass: normalizeEnum(body.weightClass, "weightClass", "dk", ALLOWED_WEIGHT_CLASSES),
    length: normalizeMeasurement(body.length, "length"),
    weight: normalizeMeasurement(body.weight, "weight"),
  };
}

async function handleAuthApi(req, res, url) {
  if (req.method === "POST") {
    requireTrustedOrigin(req);
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(req);
    const email = normalizeAuthLogin(body.login);
    const password = validateAuthPassword(body.password);
    try {
      validateRegistrationLegalInput(body, CURRENT_LEGAL_DOCUMENT);
    } catch (error) {
      throw new ApiError(400, error.message);
    }
    let captchaToken;
    try {
      captchaToken = normalizeCaptchaToken(body.captchaToken, captchaConfig.enabled);
    } catch (error) {
      throw new ApiError(400, error.message);
    }
    const rateLimitKeys = getAuthRateLimitKeys(req, email);
    enforceRequestRateLimit(rateLimitKeys, authRequestRateLimiter, res);
    enforceAuthRateLimit(rateLimitKeys, res);

    let registration;
    try {
      const { data, error } = await authClient().auth.signUp({
        email,
        password,
        options: {
          data: { login: email },
          emailRedirectTo: new URL("/?confirmed=1", getExpectedOrigin(req)).toString(),
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (error || !data?.user) throw error || new Error("Brak użytkownika po rejestracji");
      const { error: finalizationError } = await supabaseConnection.client.rpc(
        "finalize_automatic_registration",
        {
          p_user_id: data.user.id,
          p_terms_version: CURRENT_LEGAL_DOCUMENT.termsVersion,
          p_privacy_version: CURRENT_LEGAL_DOCUMENT.privacyVersion,
        },
      );
      if (finalizationError) throw finalizationError;
      registration = data;
    } catch {
      recordAuthFailure(rateLimitKeys);
      throw genericAuthError("register");
    }

    clearAuthFailures(rateLimitKeys);

    if (registration.session) {
      setAuthCookies(res, registration.session);
      await updateLastLogin(registration.user.id);
    }

    return sendJson(res, 201, {
      user: sanitizeAuthUser(registration.user),
      requiresEmailConfirmation: !registration.session,
      idleTimeoutMs: getIdleTimeoutMs(),
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/confirmation") {
    const body = await readBody(req);
    const rateLimitKeys = [`ip:${getClientAddress(req)}`];
    enforceRequestRateLimit(rateLimitKeys, authRequestRateLimiter, res);
    enforceAuthRateLimit(rateLimitKeys, res);

    let accessToken;
    let refreshToken;
    try {
      accessToken = normalizeRecoveryToken(body.access_token, "potwierdzający");
      refreshToken = normalizeRecoveryToken(body.refresh_token, "odświeżający");
    } catch {
      recordAuthFailure(rateLimitKeys);
      throw genericAuthError("confirmation");
    }

    const client = authClient();
    let session;
    let user;
    try {
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      session = data?.session;
      if (error || !session?.access_token || !session?.refresh_token) {
        throw new Error("Nieprawidłowa sesja potwierdzenia.");
      }

      const userResult = await client.auth.getUser(session.access_token);
      user = userResult.data?.user;
      if (userResult.error || !user) {
        throw new Error("Nieprawidłowy użytkownik potwierdzenia.");
      }
    } catch {
      recordAuthFailure(rateLimitKeys);
      throw genericAuthError("confirmation");
    }

    clearAuthFailures(rateLimitKeys);
    setAuthCookies(res, session);
    return sendJson(res, 200, {
      user: sanitizeAuthUser(user),
      idleTimeoutMs: getIdleTimeoutMs(),
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const email = normalizeAuthEmail(body.email);
    const password = validateAuthPassword(body.password);
    let captchaToken;
    try {
      captchaToken = normalizeCaptchaToken(body.captchaToken, captchaConfig.enabled);
    } catch (error) {
      throw new ApiError(400, error.message);
    }
    const rateLimitKeys = getAuthRateLimitKeys(req, email);
    enforceRequestRateLimit(rateLimitKeys, authRequestRateLimiter, res);
    enforceAuthRateLimit(rateLimitKeys, res);
    const { data, error } = await authClient().auth.signInWithPassword({
      email,
      password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });

    if (error || !data?.user || !data.session) {
      recordAuthFailure(rateLimitKeys);
      throw genericAuthError("login");
    }

    clearAuthFailures(rateLimitKeys);

    setAuthCookies(res, data.session);
    await updateLastLogin(data.user.id);
    return sendJson(res, 200, {
      user: sanitizeAuthUser(data.user),
      idleTimeoutMs: getIdleTimeoutMs(),
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/password-reset-request") {
    const body = await readBody(req);
    const email = normalizeAuthEmail(body.email);
    let captchaToken;
    try {
      captchaToken = normalizeCaptchaToken(body.captchaToken, captchaConfig.enabled);
    } catch (error) {
      throw new ApiError(400, error.message);
    }
    const rateLimitKeys = getAuthRateLimitKeys(req, email);
    enforceRequestRateLimit(
      rateLimitKeys,
      authRequestRateLimiters["password-reset-request"],
      res,
    );

    const redirectTo = new URL("/?recovery=1", getExpectedOrigin(req)).toString();
    const { error } = await authClient().auth.resetPasswordForEmail(email, {
      redirectTo,
      ...(captchaToken ? { captchaToken } : {}),
    });
    if (error) {
      console.warn("Nie udało się wysłać wiadomości odzyskiwania hasła.");
      throw new ApiError(503, "Odzyskiwanie hasła jest chwilowo niedostępne. Spróbuj ponownie później.");
    }

    return sendJson(res, 202, {
      message: "Jeśli konto z tym adresem istnieje, wyślemy na nie instrukcję zmiany hasła.",
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/recovery") {
    enforceRequestRateLimit(
      [`ip:${getClientAddress(req)}`],
      authRequestRateLimiters.recovery,
      res,
    );
    const body = await readBody(req);
    const code = normalizeRecoveryToken(body.code, "jednorazowy");
    const client = authClient();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data?.user || !data?.session) {
      throw new ApiError(400, "Link odzyskiwania hasła jest nieprawidłowy lub wygasł.");
    }
    const authenticatedClient = supabaseAuthClientFactory(supabaseAuthConfig, data.session.access_token);
    const { data: grantJti, error: grantError } = await authenticatedClient.rpc("create_auth_recovery_grant", {});
    if (grantError || typeof grantJti !== "string" || !grantJti) {
      throw new ApiError(503, "Odzyskiwanie hasła jest chwilowo niedostępne. Spróbuj ponownie później.");
    }
    setAuthCookies(res, data.session);
    appendSetCookie(res, buildRecoveryGrantCookie(data.user.id, { jti: grantJti }));
    return sendJson(res, 200, {
      user: sanitizeAuthUser(data.user),
      idleTimeoutMs: getIdleTimeoutMs(),
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/password") {
    const session = await requireAuthenticatedSession(req, res);
    const body = await readBody(req);
    const password = validateAuthPassword(body.password);
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken = cookies[AUTH_REFRESH_COOKIE];
    const grantJti = getRecoveryGrantJti(cookies[AUTH_RECOVERY_GRANT_COOKIE], session.user.id);
    if (!refreshToken || !grantJti) {
      throw new ApiError(400, "Link odzyskiwania hasła jest nieprawidłowy lub wygasł.");
    }

    const client = supabaseAuthClientFactory(supabaseAuthConfig, session.accessToken);
    const { error: sessionError } = await client.auth.setSession({
      access_token: session.accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) {
      throw new ApiError(400, "Link odzyskiwania hasła jest nieprawidłowy lub wygasł.");
    }

    const { data: grantClaimed, error: grantClaimError } = await client.rpc("claim_auth_recovery_grant", {
      grant_jti: grantJti,
    });
    if (grantClaimError) {
      throw new ApiError(503, "Odzyskiwanie hasła jest chwilowo niedostępne. Spróbuj ponownie później.");
    }
    if (grantClaimed !== true) {
      throw new ApiError(400, "Ten link został już wykorzystany albo wygasł. Rozpocznij odzyskiwanie hasła ponownie.");
    }

    const { error } = await client.auth.updateUser({ password });
    if (error) {
      try {
        await client.rpc("release_auth_recovery_grant", { grant_jti: grantJti });
      } catch {
        // Błąd zwalniania nie może przesłonić bezpiecznej odpowiedzi o zmianie hasła.
      }
      throw new ApiError(400, "Nie udało się zmienić hasła. Sprawdź hasło i spróbuj ponownie.");
    }

    const { data: grantConsumed, error: grantError } = await client.rpc("consume_auth_recovery_grant", {
      grant_jti: grantJti,
    });
    if (grantError || grantConsumed !== true) {
      console.error("Nie udało się skonsumować grantu odzyskiwania hasła.");
      throw new ApiError(503, "Hasło zostało zmienione. Nie udało się bezpiecznie zakończyć procesu. Zaloguj się nowym hasłem. Jeśli logowanie nie zadziała, rozpocznij odzyskiwanie ponownie.");
    }

    let globalSignOutFailed = false;
    try {
      const signOutResult = await client.auth.signOut({ scope: "global" });
      globalSignOutFailed = Boolean(signOutResult?.error);
    } catch {
      globalSignOutFailed = true;
    } finally {
      clearAuthCookies(res);
    }
    if (globalSignOutFailed) {
      throw new ApiError(503, "Hasło zostało zmienione, ale nie udało się unieważnić pozostałych sesji.");
    }
    return sendJson(res, 200, { passwordUpdated: true, authenticated: false });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/password/change") {
    const session = await requireAuthenticatedSession(req, res);
    const body = await readBody(req);
    const currentPassword = body.currentPassword;
    if (typeof currentPassword !== "string" || !currentPassword.trim()) {
      throw new ApiError(400, "Podaj bieżące hasło.");
    }
    const password = validateAuthPassword(body.password);

    let captchaToken;
    try {
      captchaToken = normalizeCaptchaToken(body.captchaToken, captchaConfig.enabled);
    } catch (error) {
      throw new ApiError(400, error.message);
    }

    const rateLimitKeys = getAuthRateLimitKeys(req, session.user.email);
    enforceRequestRateLimit([`ip:${getClientAddress(req)}`], authRequestRateLimiters["password-change"], res);
    enforceAuthRateLimit(rateLimitKeys, res);

    const verifier = supabaseAuthClientFactory(supabaseAuthConfig);
    const { data: verificationData, error: verificationError } = await verifier.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });
    if (verificationError || verificationData?.user?.id !== session.user.id) {
      if (verificationError && isTransientAuthError(verificationError)) {
        throw new ApiError(503, "Weryfikacja bieżącego hasła jest chwilowo niedostępna. Spróbuj ponownie później.");
      }
      recordAuthFailure(rateLimitKeys);
      throw new ApiError(403, "Nie udało się zmienić hasła. Spróbuj ponownie.");
    }
    clearAuthFailures(rateLimitKeys);

    if (!session.refreshToken) {
      clearAuthCookies(res);
      throw new ApiError(503, "Sesja logowania jest niepełna. Zaloguj się ponownie i spróbuj jeszcze raz.");
    }

    const client = supabaseAuthClientFactory(supabaseAuthConfig, session.accessToken);
    const { error: sessionError } = await client.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });
    if (sessionError) {
      try {
        await client.auth.signOut({ scope: "global" });
      } catch {
        // Nie przesłaniaj niepewnego stanu sesji dodatkowym błędem.
      } finally {
        clearAuthCookies(res);
      }
      throw new ApiError(503, "Sesja logowania jest chwilowo niedostępna. Zaloguj się ponownie.");
    }

    let updateResult;
    try {
      updateResult = await client.auth.updateUser({ current_password: currentPassword, password });
    } catch {
      try {
        await client.auth.signOut({ scope: "global" });
      } catch {
        // Nie przesłaniaj niepewnego stanu aktualizacji dodatkowym błędem.
      } finally {
        clearAuthCookies(res);
      }
      throw new ApiError(503, "Wynik zmiany hasła jest niepewny. Zaloguj się ponownie.");
    }

    const { error: updateError } = updateResult;
    if (updateError) {
      if (isUncertainPasswordChangeError(updateError)) {
        try {
          await client.auth.signOut({ scope: "global" });
        } catch {
          // Nie przesłaniaj niepewnego stanu aktualizacji dodatkowym błędem.
        } finally {
          clearAuthCookies(res);
        }
        throw new ApiError(503, "Wynik zmiany hasła jest niepewny. Zaloguj się ponownie.");
      }
      throw new ApiError(400, "Nie udało się zmienić hasła. Sprawdź hasło i spróbuj ponownie.");
    }

    try {
      const signOutResult = await client.auth.signOut({ scope: "global" });
      if (signOutResult?.error) {
        throw new ApiError(503, "Hasło zostało zmienione. Nie udało się wylogować wszystkich sesji.");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "Hasło zostało zmienione. Nie udało się wylogować wszystkich sesji.");
    } finally {
      clearAuthCookies(res);
    }

    return sendJson(res, 200, { passwordUpdated: true, authenticated: false });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const cookies = parseCookies(req.headers.cookie);
    try {
      if (supabaseAuthConfig && cookies[AUTH_ACCESS_COOKIE]) {
        const client = supabaseAuthClientFactory(
          supabaseAuthConfig,
          cookies[AUTH_ACCESS_COOKIE]
        );
        await client.auth.signOut({ scope: "local" });
      }
    } catch {
      console.warn("Nie udało się wylogować sesji po stronie Supabase.");
    } finally {
      clearAuthCookies(res);
    }
    return sendJson(res, 200, { authenticated: false });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/activity") {
    await requireAuthenticatedSession(req, res);
    return sendJson(res, 200, { authenticated: true });
  }

  if (req.method === "GET" && url.pathname === "/api/auth/session") {
    const session = await getAuthenticatedSession(req, res);
    return sendJson(res, 200, {
      authenticated: Boolean(session),
      user: session ? sanitizeAuthUser(session.user) : null,
      profile: session?.profile || null,
      idleTimeoutMs: getIdleTimeoutMs(),
      legal: session?.legal || null,
    });
  }

  return false;
}

async function handleApi(req, res, url) {
  if (url.pathname.startsWith("/api/auth/")) {
    return handleAuthApi(req, res, url);
  }

  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    requireTrustedOrigin(req);
  }

  const isYarnWrite =
    (req.method === "POST" && url.pathname === "/api/yarns") ||
    ((req.method === "PATCH" || req.method === "DELETE") && url.pathname.startsWith("/api/yarns/"));
  if (isYarnWrite) {
    enforceRequestRateLimit([`ip:${getClientAddress(req)}`], yarnWriteRateLimiter, res);
  }

  if (req.method === "DELETE" && url.pathname === "/api/account") {
    const session = await requireAuthenticatedSession(req, res);
    const rateLimitKeys = [`ip:${getClientAddress(req)}`, `user:${session.user.id}`];

    const body = await readBody(req);
    let deletionInput;
    try {
      deletionInput = validateAccountDeletionInput(body);
    } catch (error) {
      throw new ApiError(400, error.message || `Wpisz dokładnie: ${ACCOUNT_DELETION_PHRASE}.`);
    }
    let captchaToken;
    try {
      captchaToken = normalizeCaptchaToken(body.captchaToken, captchaConfig.enabled);
    } catch (error) {
      throw new ApiError(400, error.message);
    }

    const retryAfterMs = Math.max(
      ...rateLimitKeys.map((key) => accountDeletionRateLimiter.getRetryAfterMs(key)),
    );
    if (retryAfterMs > 0) {
      res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      throw new ApiError(429, "Zbyt wiele nieudanych prób. Spróbuj ponownie później.");
    }

    try {
      await deleteSupabaseAccount({
        session,
        password: deletionInput.password,
        captchaToken,
        authClient: authClient(),
        adminClient: supabaseConnection.client,
      });
    } catch (error) {
      if (error.message === "Nie udało się potwierdzić hasła.") {
        rateLimitKeys.forEach((key) => accountDeletionRateLimiter.recordFailure(key));
        throw new ApiError(400, error.message);
      }
      throw error;
    }

    accountDeletionRateLimiter.clear(`user:${session.user.id}`);
    clearAuthCookies(res);
    res.writeHead(204, {
      ...SECURITY_HEADERS,
      "Cache-Control": "no-store",
    });
    return res.end();
  }

  if (req.method === "POST" && url.pathname === "/api/legal/acceptance") {
    const session = await requireAuthenticatedSession(req, res);
    const body = await readBody(req);
    let acceptance;
    try {
      acceptance = await legalAccessService.recordTermsAcceptance(
        session.user.id,
        body.version,
        CURRENT_LEGAL_DOCUMENT.privacyVersion,
      );
    } catch (error) {
      if (/aktualną wersję/i.test(error.message)) {
        throw new ApiError(409, error.message);
      }
      throw new ApiError(503, "Nie udało się zapisać akceptacji dokumentów. Spróbuj ponownie później.");
    }
    return sendJson(res, 200, acceptance);
  }

  if (await yarnRouter.handle(req, res, url)) return;

  if (
    req.method === "GET"
    && url.pathname === "/api/matches"
    && url.searchParams.get("diagnostics") === "1"
  ) {
    const session = await requireCurrentTermsSession(req, res);
    enforceRequestRateLimit(
      getMatchRateLimitKeys(req, session),
      matchRateLimiter,
      res,
    );
    const result = await getSupabaseMatches(session, { diagnostics: true });
    res.setHeader("X-Motek-Match-Scope", result.limited ? "subset" : "full");
    return sendJson(res, 200, {
      matches: result.matches,
      diagnostics: result.diagnostics,
    });
  }

  if (await patternRouter.handle(req, res, url)) return;

  sendJson(res, 404, { error: "Nieznany endpoint" });
}

function listen(httpServer, port, host) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      httpServer.removeListener("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      httpServer.removeListener("error", onError);
      const address = httpServer.address();
      const boundPort = typeof address === "object" && address ? address.port : port;
      console.log(`Motek backend działa na http://${host}:${boundPort}`);
      resolve(boundPort);
    };

    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen(port, host);
  });
}

function getRuntimeConfig(env = process.env) {
  const host = env.HOST?.trim() || "127.0.0.1";
  const rawPort = env.PORT?.trim() || "3001";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Nieprawidłowa wartość PORT: ${rawPort}`);
  }

  return { host, port };
}

async function main(options = {}) {
  shuttingDown = false;
  validateDeploymentConfig();
  if (String(process.env.DEPLOYMENT_ENV || "local").trim().toLowerCase() === "production") {
    const providers = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "legal-data-providers.json"), "utf8"));
    const patternAudit = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "pattern-content-audit.json"), "utf8"));
    const records = Array.isArray(patternAudit.records) ? patternAudit.records : [];
    const publication = validateLegalPublication({
      legalDocument: CURRENT_LEGAL_DOCUMENT,
      providers: providers.providers,
      patternAudit: {
        complete: records.length > 0 && records.every((record) => record.status !== "pending_review"),
        pending_review: records.filter((record) => record.status === "pending_review").length,
      },
      deploymentEnvironment: "production",
    });
    if (!publication.ready) {
      if (readLegalPublicationEnforcement()) throw new Error("Publikacja prawna nie jest gotowa.");
      console.log(
        `[LEGAL_PUBLICATION_WARNING] Start produkcji kontynuowany przy wyłączonej blokadzie: ${publication.errors.join(" ")}`
      );
    }
  }
  validateCookieSecurityConfig();
  validateOriginConfig();
  const releaseInfo = readReleaseInfo(
    process.env,
    fs.readFileSync(path.join(rootDir, "VERSION"), "utf8").trim()
  );
  supabaseConnection = Object.prototype.hasOwnProperty.call(
    options,
    "supabaseConnection"
  )
    ? options.supabaseConnection
    : createSupabaseConnection();
  supabaseAuthConfig = Object.prototype.hasOwnProperty.call(options, "supabaseAuthConfig")
    ? options.supabaseAuthConfig
    : readSupabaseAuthConfig();
  supabaseAuthClientFactory = options.supabaseAuthClientFactory || createSupabaseAuthClient;
  legalAccessService = createLegalAccessService({
    legalDocument: CURRENT_LEGAL_DOCUMENT,
    serviceClient: supabaseConnection?.client,
  });
  captchaConfig = Object.prototype.hasOwnProperty.call(options, "captchaConfig")
    ? options.captchaConfig
    : readCaptchaConfig();
  metricsEnabled = Object.prototype.hasOwnProperty.call(options, "metricsEnabled")
    ? Boolean(options.metricsEnabled)
    : String(process.env.METRICS_ENABLED || "").toLowerCase() === "true";
  metricsRegistry = options.metricsRegistry || createMetricsRegistry();
  if (!supabaseConnection || !supabaseAuthConfig) {
    throw new Error(
      "Motek wymaga konfiguracji Supabase. Ustaw SUPABASE_URL, SUPABASE_SECRET_KEY i SUPABASE_PUBLISHABLE_KEY."
    );
  }
  let dependenciesReady = false;
  let readinessCheck = null;
  async function updateReadiness({ logFailure = false } = {}) {
    if (!readinessCheck) {
      readinessCheck = (async () => {
        try {
          await supabaseConnection.verify();
          dependenciesReady = true;
          metricsRegistry.setReadiness(true);
          return true;
        } catch (error) {
          dependenciesReady = false;
          metricsRegistry.setReadiness(false);
          if (logFailure) console.error(`Readiness nieudany: ${error.message}`);
          return false;
        }
      })();
    }
    try {
      return await readinessCheck;
    } finally {
      readinessCheck = null;
    }
  }

  server = http.createServer(async (req, res) => {
    let url;
    const requestStartedAt = process.hrtime.bigint();
    res.once("finish", () => {
      const pathname = url?.pathname || "/other";
      if (pathname === "/internal/metrics") return;
      metricsRegistry.observe({
        method: req.method,
        pathname,
        statusCode: res.statusCode,
        durationSeconds: Number(process.hrtime.bigint() - requestStartedAt) / 1e9,
      });
    });

    try {
      url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && ["/health", "/health/live"].includes(url.pathname)) {
        return sendJson(res, 200, { status: "ok" });
      }

      if (req.method === "GET" && url.pathname === "/health/ready") {
        if (await updateReadiness({ logFailure: true })) {
          return sendJson(res, 200, { status: "ready" });
        }
        return sendJson(res, 503, { status: "not_ready" });
      }

      if (req.method === "GET" && url.pathname === "/health/release") {
        if (await updateReadiness({ logFailure: true })) {
          return sendJson(res, 200, { status: "ready", ...releaseInfo });
        }
        return sendJson(res, 503, { status: "not_ready" });
      }

      if (req.method === "GET" && url.pathname === "/internal/metrics" && metricsEnabled) {
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
          "Cache-Control": "no-store",
        });
        return res.end(metricsRegistry.renderPrometheus());
      }

      if (!dependenciesReady) {
        res.setHeader("Retry-After", "15");
        if (url.pathname.startsWith("/api/")) {
          return sendJson(res, 503, { error: "Usługa jest chwilowo niedostępna." });
        }
        return sendText(res, 503, "Usługa jest chwilowo niedostępna.");
      }

      if (req.method === "GET" && url.pathname === "/api/config") {
        return sendJson(res, 200, { captcha: captchaConfig });
      }

      if (url.pathname.startsWith("/api/")) {
        return await handleApi(req, res, url);
      }

      if (await staticFileHandler.handle(req, res, url)) return;

      return sendText(res, 404, "Nie znaleziono zasobu");
    } catch (error) {
      if (error instanceof ApiError) {
        return sendJson(res, error.status, { error: error.message });
      }

      console.error(`Błąd obsługi ${req.method} ${req.url}:`, error);

      if (res.headersSent) {
        return res.end();
      }

      if (url?.pathname.startsWith("/api/") || String(req.url).startsWith("/api/")) {
        return sendJson(res, 500, { error: "Wewnętrzny błąd serwera." });
      }

      return sendText(res, 500, "Wewnętrzny błąd serwera.");
    }
  });
  server.requestTimeout = HTTP_REQUEST_TIMEOUT_MS;
  server.headersTimeout = HTTP_HEADERS_TIMEOUT_MS;
  server.keepAliveTimeout = HTTP_KEEP_ALIVE_TIMEOUT_MS;

  const { host, port } = getRuntimeConfig();
  const boundPort = await listen(server, port, host);
  if (await updateReadiness({ logFailure: true })) {
    console.log("Połączenie Motka z Supabase działa.");
  }
  const readinessIntervalMs = Object.prototype.hasOwnProperty.call(
    options,
    "readinessIntervalMs"
  )
    ? Number(options.readinessIntervalMs)
    : 15_000;
  if (Number.isFinite(readinessIntervalMs) && readinessIntervalMs > 0) {
    readinessTimer = setInterval(
      () => void updateReadiness({ logFailure: true }),
      readinessIntervalMs
    );
    readinessTimer.unref?.();
  }
  return { host, port: boundPort };
}

async function shutdown(signal = "shutdown") {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Zatrzymywanie Motka (${signal})...`);

  if (readinessTimer) {
    clearInterval(readinessTimer);
    readinessTimer = null;
  }

  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  server = null;
  supabaseConnection = null;
  supabaseAuthConfig = null;
  supabaseAuthClientFactory = createSupabaseAuthClient;
  legalAccessService = null;

  console.log("Motek został bezpiecznie zatrzymany.");
}

function registerShutdownHandlers() {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      shutdown(signal).then(
        () => process.exit(0),
        (error) => {
          console.error("Nie udało się bezpiecznie zatrzymać Motka:", error);
          process.exit(1);
        }
      );
    });
  }
}

if (require.main === module) {
  registerShutdownHandlers();
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  getClientAddress,
  getMatchRateLimitKeys,
  getRuntimeConfig,
  main,
  normalizeAuthEmail,
  normalizeAuthLogin,
  normalizeCatalogPattern,
  getCatalogPatterns,
  normalizeSupabaseYarn,
  scorePattern,
  selectMatchingYarns,
  validatePatternCatalogSize,
  validateYarn,
  validateYarnStorageCapacity,
  toSupabaseYarn,
  buildAuthCookie,
  createAccountDeletionRateLimiter,
  createAuthRateLimiter,
  createRequestRateLimiter,
  createAuthRequestRateLimiters,
  AUTH_REQUEST_LIMITS,
  enforceRequestRateLimit,
  validateMatchLimits,
  shouldUseSecureCookies,
  shutdown,
  validateCookieSecurityConfig,
  getIdleTimeoutSeconds,
  buildIdleActivityCookie,
  parseIdleActivityCookie,
  buildRecoveryGrantCookie,
  parseRecoveryGrantCookie,
  validateAuthPassword,
  normalizeRecoveryToken,
};
