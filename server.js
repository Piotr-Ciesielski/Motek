const http = require("http");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const {
  createSupabaseAuthClient,
  createSupabaseConnection,
  readSupabaseAuthConfig,
} = require("./supabase");
const {
  maxYarnsPerUser: MAX_YARNS_PER_USER,
  maxPatternCatalogRecords: MAX_PATTERN_CATALOG_RECORDS,
  maxMatchingVariantsPerPattern: MAX_MATCH_VARIANTS,
  maxMatchingRoleRequirements: MAX_MATCH_ROLE_REQUIREMENTS,
  maxMatchingTextLength: MAX_MATCHING_TEXT_LENGTH,
} = require("./limits");
const {
  ANY_MATERIAL,
  matchesMaterialRule,
  normalizeYarnMaterials,
} = require("./material-policy");
const {
  matchVariant,
  normalizeMatchingDocument,
} = require("./matching-policy");
const { ACCOUNT_DELETION_PHRASE, validateAccountDeletionInput } = require("./account-deletion-policy");
const { deleteSupabaseAccount } = require("./account-deletion-service");

const rootDir = __dirname;
let server;
let supabaseConnection;
let supabaseAuthConfig;
let supabaseAuthClientFactory = createSupabaseAuthClient;
let shuttingDown = false;

const MAX_JSON_BODY_BYTES = 16 * 1024;
const AUTH_ACCESS_COOKIE = "motek_access_token";
const AUTH_REFRESH_COOKIE = "motek_refresh_token";
const AUTH_ACCESS_MAX_AGE = 60 * 60;
const AUTH_REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_FAILURES = 5;
const AUTH_RATE_LIMIT_BLOCK_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ENTRIES = 10_000;
const AUTH_REQUEST_WINDOW_MS = 60 * 1000;
const AUTH_REQUEST_MAX = 30;
const AUTH_REQUEST_BLOCK_MS = 60 * 1000;
const YARN_WRITE_WINDOW_MS = 60 * 1000;
const YARN_WRITE_MAX = 600;
const YARN_WRITE_BLOCK_MS = 60 * 1000;
const HTTP_REQUEST_TIMEOUT_MS = 30 * 1000;
const HTTP_HEADERS_TIMEOUT_MS = 10 * 1000;
const HTTP_KEEP_ALIVE_TIMEOUT_MS = 5 * 1000;
const HTTP_BODY_TIMEOUT_MS = 10 * 1000;
const MAX_MATCH_SEARCH_NODES = 25_000;
const MAX_PATTERN_PAGE_SIZE = 50;
const authRateLimiter = createAuthRateLimiter();
const authRequestRateLimiter = createRequestRateLimiter({
  windowMs: AUTH_REQUEST_WINDOW_MS,
  maxRequests: AUTH_REQUEST_MAX,
  blockMs: AUTH_REQUEST_BLOCK_MS,
});
const yarnWriteRateLimiter = createRequestRateLimiter({
  windowMs: YARN_WRITE_WINDOW_MS,
  maxRequests: YARN_WRITE_MAX,
  blockMs: YARN_WRITE_BLOCK_MS,
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
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
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

function getClientAddress(req) {
  const address = req.socket?.remoteAddress || "unknown";
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

function getAuthRateLimitKeys(req, email) {
  return [`ip:${getClientAddress(req)}`, `email:${email}`];
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
}

function clearAuthCookies(res) {
  appendSetCookie(res, buildAuthCookie(AUTH_ACCESS_COOKIE, "", 0));
  appendSetCookie(res, buildAuthCookie(AUTH_REFRESH_COOKIE, "", 0));
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
  if (typeof value !== "string") {
    throw new ApiError(400, "Login musi mieć 3-30 znaków: litery, cyfry lub podkreślenie.");
  }

  const login = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/u.test(login)) {
    throw new ApiError(400, "Login musi mieć 3-30 znaków: litery, cyfry lub podkreślenie.");
  }
  return login;
}

function validateAuthPassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 256) {
    throw new ApiError(400, "Hasło musi mieć od 8 do 256 znaków.");
  }
  if (/^\s+$/u.test(value)) {
    throw new ApiError(400, "Hasło nie może składać się wyłącznie ze spacji.");
  }
  if (!/[a-z]/u.test(value) || !/[A-Z]/u.test(value) || !/\d/u.test(value) || !/[^\p{L}\p{N}\s]/u.test(value)) {
    throw new ApiError(400, "Hasło musi zawierać małą i wielką literę, cyfrę oraz znak specjalny.");
  }
  return value;
}

function normalizeFullName(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > 200) {
    throw new ApiError(400, "Imię i nazwisko może mieć maksymalnie 200 znaków.");
  }
  return value.trim() || null;
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
      fullName: user.user_metadata?.full_name || null,
    },
  };
}

function genericAuthError(operation) {
  if (operation === "login") {
    return new ApiError(401, "Nieprawidłowy e-mail lub hasło.");
  }
  return new ApiError(400, "Nie udało się utworzyć konta. Sprawdź dane i spróbuj ponownie.");
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

  const client = supabaseAuthClientFactory(supabaseAuthConfig);
  let activeAccessToken = accessToken;
  let userResult = accessToken
    ? await client.auth.getUser(accessToken)
    : { data: null, error: new Error("Brak tokenu dostępu") };

  if (userResult.error && refreshToken) {
    const refreshed = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.data?.session) {
      setAuthCookies(res, refreshed.data.session);
      activeAccessToken = refreshed.data.session.access_token;
      userResult = await client.auth.getUser(activeAccessToken);
    }
  }

  if (userResult.error || !userResult.data?.user) {
    clearAuthCookies(res);
    return null;
  }

  const authenticatedClient = supabaseAuthClientFactory(
    supabaseAuthConfig,
    activeAccessToken || undefined
  );
  const profileResult = await authenticatedClient
    .from("profiles")
    .select("id,login,email,full_name,avatar_url,status,role,created_at,updated_at,last_login_at")
    .eq("id", userResult.data.user.id)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) {
    clearAuthCookies(res);
    return null;
  }

  if (profileResult.data.status !== "active") {
    clearAuthCookies(res);
    throw new ApiError(403, "Konto jest zawieszone lub zablokowane.");
  }

  return {
    user: userResult.data.user,
    profile: profileResult.data,
    accessToken: activeAccessToken,
  };
}

async function requireAuthenticatedSession(req, res) {
  const session = await getAuthenticatedSession(req, res);
  if (!session) {
    throw new ApiError(401, "Zaloguj się, aby zarządzać swoim magazynem włóczek.");
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

function getYarnCollectionVersion(yarns) {
  return `"${crypto
    .createHash("sha256")
    .update(JSON.stringify(yarns.map((yarn) => [
      yarn.id,
      yarn.updatedAt,
      yarn.name,
      yarn.color,
      yarn.materials,
      yarn.weightClass,
      yarn.length,
      yarn.weight,
    ])))
    .digest("hex")}"`;
}

async function requireCurrentYarnVersion(req, session) {
  const expectedVersion = req.headers["if-match"];
  if (typeof expectedVersion !== "string" || !expectedVersion) {
    throw new ApiError(428, "Odśwież magazyn przed zapisaniem zmian.");
  }

  const currentYarns = await getSupabaseYarns(session);
  const currentVersion = getYarnCollectionVersion(currentYarns);
  if (expectedVersion !== currentVersion) {
    throw new ApiError(409, "Magazyn został zmieniony w innej karcie. Odśwież dane i spróbuj ponownie.");
  }
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

async function insertSupabaseYarn(session, yarn) {
  const { data, error } = await supabaseAuthClientFactory(
    supabaseAuthConfig,
    session.accessToken
  )
    .rpc("insert_yarn_with_limit", {
      p_name: yarn.name,
      p_color: yarn.color,
      p_materials: yarn.materials,
      p_weight_class: yarn.weightClass,
      p_length_meters: yarn.length,
      p_weight_grams: yarn.weight,
    });

  if (error) {
    if (error.code === "P0001") {
      throw new ApiError(409, "Magazyn osiągnął limit 500 włóczek na użytkownika.");
    }
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new ApiError(
        503,
        "Backend Supabase nie ma wymaganej migracji magazynu. Skontaktuj się z administratorem."
      );
    }
    throw new Error(`Nie udało się zapisać włóczki w Supabase: ${error.message}`);
  }

  const insertedYarn = Array.isArray(data) ? data[0] : data;
  if (!insertedYarn) {
    throw new Error("Supabase nie zwróciło zapisanej włóczki.");
  }

  return normalizeSupabaseYarn(insertedYarn);
}

async function updateSupabaseYarn(session, id, yarn) {
  const { data, error } = await supabaseAuthClientFactory(
    supabaseAuthConfig,
    session.accessToken
  )
    .from("yarns")
    .update(toSupabaseYarnFields(yarn))
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select("id,name,color,materials,weight_class,length_meters,weight_grams")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ApiError(404, "Nie znaleziono włóczki o podanym identyfikatorze.");
    }
    throw new Error(`Nie udało się zaktualizować włóczki w Supabase: ${error.message}`);
  }

  return normalizeSupabaseYarn(data);
}

async function deleteSupabaseYarn(session, id) {
  const { data, error } = await supabaseAuthClientFactory(
    supabaseAuthConfig,
    session.accessToken
  )
    .from("yarns")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select("id");

  if (error) {
    throw new Error(`Nie udało się usunąć włóczki z Supabase: ${error.message}`);
  }

  if (!data.length) {
    throw new ApiError(404, "Nie znaleziono włóczki o podanym identyfikatorze.");
  }
}

async function sendYarnMutationResponse(res, status, payload, session) {
  const currentYarns = await getSupabaseYarns(session);
  res.setHeader("ETag", getYarnCollectionVersion(currentYarns));
  return sendJson(res, status, payload);
}

function yarnMatchesLegacyMaterials(yarn, materials) {
  if (materials.includes(ANY_MATERIAL)) {
    return Array.isArray(yarn.materials) && yarn.materials.length > 0;
  }
  return matchesMaterialRule(yarn.materials, {
    material_match: "any",
    materials,
  });
}

function scorePattern(pattern, yarns) {
  if (Array.isArray(pattern.requirements) && pattern.requirements.length > 0) {
    const allocation = allocateRequirementYarns(pattern.requirements, yarns);
    if (!allocation) {
      return {
        total: 0,
        doable: false,
        totalLength: 0,
        totalWeight: 0,
        matchedYarns: 0,
      };
    }

    const requiredLength = pattern.requirements.reduce(
      (sum, requirement) => sum + requirement.metersNeeded,
      0
    );
    const requiredWeight = pattern.requirements.reduce(
      (sum, requirement) => sum + requirement.gramsNeeded,
      0
    );
    const totalLength = allocation.flat().reduce((sum, yarn) => sum + yarn.length, 0);
    const totalWeight = allocation.flat().reduce((sum, yarn) => sum + yarn.weight, 0);
    const lengthScore = Math.min(totalLength / requiredLength, 1);
    const weightScore = Math.min(totalWeight / requiredWeight, 1);
    const total = Math.round(lengthScore * 40 + weightScore * 25 + 25 + 10);

    return {
      total,
      doable: true,
      totalLength,
      totalWeight,
      matchedYarns: allocation.flat().length,
    };
  }

  const materials = Array.isArray(pattern.materials) ? pattern.materials : [];
  const weightClasses = Array.isArray(pattern.weightClasses) ? pattern.weightClasses : [];
  const totalLength = yarns.reduce((sum, yarn) => sum + yarn.length, 0);
  const totalWeight = yarns.reduce((sum, yarn) => sum + yarn.weight, 0);
  const matchedYarns = yarns.filter(
    (yarn) =>
      yarnMatchesLegacyMaterials(yarn, materials)
      && weightClasses.includes(yarn.weightClass),
  ).length;
  const lengthScore = Math.min(totalLength / pattern.metersNeeded, 1);
  const weightScore = Math.min(totalWeight / pattern.gramsNeeded, 1);
  const materialScore = Math.min(matchedYarns / pattern.yarnsNeeded, 1);
  const colorScore = pattern.colors === "dowolny" ? 1 : 0.8;
  const total = Math.round(lengthScore * 40 + weightScore * 25 + materialScore * 25 + colorScore * 10);
  const doable = totalLength >= pattern.metersNeeded && totalWeight >= pattern.gramsNeeded && matchedYarns >= pattern.yarnsNeeded;
  return { total, doable, totalLength, totalWeight, matchedYarns };
}

function allocateRequirementYarns(requirements, yarns) {
  for (const requirement of requirements) {
    const eligible = yarns.filter(
      (yarn) =>
        yarnMatchesLegacyMaterials(yarn, requirement.materials) &&
        requirement.weightClasses.includes(yarn.weightClass)
    );
    const availableLength = eligible.reduce((sum, yarn) => sum + yarn.length, 0);
    const availableWeight = eligible.reduce((sum, yarn) => sum + yarn.weight, 0);

    if (
      eligible.length < requirement.yarnsNeeded ||
      availableLength < requirement.metersNeeded ||
      availableWeight < requirement.gramsNeeded
    ) {
      return null;
    }
  }

  let searchNodes = 0;

  function choose(index, used, allocation) {
    searchNodes += 1;
    if (searchNodes > MAX_MATCH_SEARCH_NODES) {
      throw new ApiError(503, "Dopasowanie jest zbyt złożone. Zmniejsz magazyn lub wybierz prostszy wzór.");
    }
    if (index === requirements.length) return allocation;

    const requirement = requirements[index];
    const eligible = yarns.filter(
      (yarn, yarnIndex) =>
        !used.has(yarnIndex) &&
        yarnMatchesLegacyMaterials(yarn, requirement.materials) &&
        requirement.weightClasses.includes(yarn.weightClass)
    );

    const remainingLength = new Array(eligible.length + 1).fill(0);
    const remainingWeight = new Array(eligible.length + 1).fill(0);
    for (let candidate = eligible.length - 1; candidate >= 0; candidate -= 1) {
      remainingLength[candidate] = remainingLength[candidate + 1] + eligible[candidate].length;
      remainingWeight[candidate] = remainingWeight[candidate + 1] + eligible[candidate].weight;
    }

    function chooseGroup(start, group, length, weight) {
      searchNodes += 1;
      if (searchNodes > MAX_MATCH_SEARCH_NODES) {
        throw new ApiError(503, "Dopasowanie jest zbyt złożone. Zmniejsz magazyn lub wybierz prostszy wzór.");
      }
      if (
        group.length + eligible.length - start < requirement.yarnsNeeded ||
        length + remainingLength[start] < requirement.metersNeeded ||
        weight + remainingWeight[start] < requirement.gramsNeeded
      ) {
        return null;
      }
      if (
        group.length >= requirement.yarnsNeeded &&
        length >= requirement.metersNeeded &&
        weight >= requirement.gramsNeeded
      ) {
        const nextUsed = new Set(used);
        group.forEach((yarn) => nextUsed.add(yarns.indexOf(yarn)));
        const result = choose(index + 1, nextUsed, [...allocation, group]);
        if (result) return result;
      }

      for (let candidate = start; candidate < eligible.length; candidate += 1) {
        const result = chooseGroup(
          candidate + 1,
          [...group, eligible[candidate]],
          length + eligible[candidate].length,
          weight + eligible[candidate].weight
        );
        if (result) return result;
      }
      return null;
    }

    return chooseGroup(0, [], 0, 0);
  }

  return choose(0, new Set(), []);
}

async function getSupabaseMatches(session) {
  const [yarns, patterns] = await Promise.all([
    getSupabaseYarns(session),
    getCatalogPatterns(),
  ]);

  validateMatchLimits(patterns);
  let limited = false;
  const matches = patterns
    .filter((pattern) => !pattern.needsReview)
    .flatMap((pattern) =>
      pattern.matchingRequirements.flatMap((variant) => {
        let outcome;
        try {
          outcome = matchVariant(variant, yarns);
        } catch (error) {
          if (error instanceof RangeError) {
            throw new ApiError(
              503,
              "Dopasowanie jest zbyt złożone. Zmniejsz magazyn lub wybierz prostszy wzór.",
            );
          }
          throw error;
        }
        if (!outcome.doable) return [];
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
        return [{
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
        }];
      })
    )
    .filter((item) => item.doable)
    .sort((a, b) => b.total - a.total);

  return { matches, limited };
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

function selectMatchingYarns(pattern, yarns) {
  const requirements = Array.isArray(pattern.requirements) && pattern.requirements.length > 0
    ? pattern.requirements
    : [{
        yarnsNeeded: pattern.yarnsNeeded,
        metersNeeded: pattern.metersNeeded,
        gramsNeeded: pattern.gramsNeeded,
        materials: pattern.materials,
        weightClasses: pattern.weightClasses,
      }];
  const eligible = yarns.filter((yarn) =>
    requirements.some(
      (requirement) =>
        yarnMatchesLegacyMaterials(yarn, requirement.materials) &&
        requirement.weightClasses.includes(yarn.weightClass)
    )
  );

  return { yarns: eligible, limited: false };
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

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
  };
  return fsPromises.readFile(filePath).then((buf) => {
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(buf);
  });
}

function normalizeCatalogPattern(pattern) {
  const ratio =
    pattern.meters_per_100g === null || pattern.meters_per_100g === undefined
      ? null
      : Number(pattern.meters_per_100g);

  return {
    id: Number(pattern.id),
    name: pattern.name,
    description: pattern.description,
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

async function getCatalogPatterns({ limit = null, offset = 0 } = {}) {
  const patternClient = supabaseConnection.client.from("patterns");
  const { count, error: countError } = await patternClient
    .select("id", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Nie udało się sprawdzić liczby wzorów w Supabase: ${countError.message}`);
  }

  validatePatternCatalogSize(count ?? 0);

  const effectiveLimit = limit ?? count ?? 0;
  const { data, error } = await supabaseConnection.client
    .from("patterns")
    .select(
      "id,name,description,project_type,materials,meters_per_100g,yarn_requirements,matching_requirements,source_language,needs_review"
    )
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
    normalized < 0 ||
    normalized > MAX_MEASUREMENT
  ) {
    throw new ApiError(400, `Pole ${field} musi być liczbą całkowitą od 0 do ${MAX_MEASUREMENT}.`);
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
    const email = normalizeAuthEmail(body.email);
    const password = validateAuthPassword(body.password);
    const login = normalizeAuthLogin(body.login);
    const fullName = normalizeFullName(body.full_name);
    const rateLimitKeys = getAuthRateLimitKeys(req, email);
    enforceRequestRateLimit(rateLimitKeys, authRequestRateLimiter, res);
    enforceAuthRateLimit(rateLimitKeys, res);

    const { data, error } = await authClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          login,
          full_name: fullName,
        },
      },
    });

    if (error || !data?.user) {
      recordAuthFailure(rateLimitKeys);
      throw genericAuthError("register");
    }

    clearAuthFailures(rateLimitKeys);

    if (data.session) {
      setAuthCookies(res, data.session);
      await updateLastLogin(data.user.id);
    }

    return sendJson(res, 201, {
      user: sanitizeAuthUser(data.user),
      requiresEmailConfirmation: !data.session,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const email = normalizeAuthEmail(body.email);
    const password = validateAuthPassword(body.password);
    const rateLimitKeys = getAuthRateLimitKeys(req, email);
    enforceRequestRateLimit(rateLimitKeys, authRequestRateLimiter, res);
    enforceAuthRateLimit(rateLimitKeys, res);
    const { data, error } = await authClient().auth.signInWithPassword({ email, password });

    if (error || !data?.user || !data.session) {
      recordAuthFailure(rateLimitKeys);
      throw genericAuthError("login");
    }

    clearAuthFailures(rateLimitKeys);

    setAuthCookies(res, data.session);
    await updateLastLogin(data.user.id);
    return sendJson(res, 200, { user: sanitizeAuthUser(data.user) });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/password-reset-request") {
    const body = await readBody(req);
    const email = normalizeAuthEmail(body.email);
    const rateLimitKeys = getAuthRateLimitKeys(req, email);
    enforceRequestRateLimit(rateLimitKeys, authRequestRateLimiter, res);

    const redirectTo = new URL("/?recovery=1", getExpectedOrigin(req)).toString();
    const { error } = await authClient().auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      console.warn("Nie udało się wysłać wiadomości odzyskiwania hasła.");
      throw new ApiError(503, "Odzyskiwanie hasła jest chwilowo niedostępne. Spróbuj ponownie później.");
    }

    return sendJson(res, 202, {
      message: "Jeśli konto z tym adresem istnieje, wyślemy na nie instrukcję zmiany hasła.",
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/recovery") {
    const body = await readBody(req);
    const accessToken = normalizeRecoveryToken(body.access_token, "dostępu");
    const refreshToken = normalizeRecoveryToken(body.refresh_token, "odświeżania");
    const client = authClient();
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data?.user) {
      throw new ApiError(400, "Link odzyskiwania hasła jest nieprawidłowy lub wygasł.");
    }

    setAuthCookies(res, {
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return sendJson(res, 200, { user: sanitizeAuthUser(data.user) });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/password") {
    const session = await requireAuthenticatedSession(req, res);
    const body = await readBody(req);
    const password = validateAuthPassword(body.password);
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken = cookies[AUTH_REFRESH_COOKIE];
    if (!refreshToken) {
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

    const { error } = await client.auth.updateUser({ password });
    if (error) {
      throw new ApiError(400, "Nie udało się zmienić hasła. Sprawdź hasło i spróbuj ponownie.");
    }

    clearAuthCookies(res);
    return sendJson(res, 200, { passwordUpdated: true, authenticated: false });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const cookies = parseCookies(req.headers.cookie);
    if (supabaseAuthConfig && cookies[AUTH_ACCESS_COOKIE]) {
      const client = supabaseAuthClientFactory(
        supabaseAuthConfig,
        cookies[AUTH_ACCESS_COOKIE]
      );
      await client.auth.signOut({ scope: "local" });
    }
    clearAuthCookies(res);
    return sendJson(res, 200, { authenticated: false });
  }

  if (req.method === "GET" && url.pathname === "/api/auth/session") {
    const session = await getAuthenticatedSession(req, res);
    return sendJson(res, 200, {
      authenticated: Boolean(session),
      user: session ? sanitizeAuthUser(session.user) : null,
      profile: session?.profile || null,
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
    enforceRequestRateLimit(
      [`ip:${getClientAddress(req)}`, `user:${session.user.id}`],
      yarnWriteRateLimiter,
      res,
    );

    const body = await readBody(req);
    let deletionInput;
    try {
      deletionInput = validateAccountDeletionInput(body);
    } catch (error) {
      throw new ApiError(400, error.message || `Wpisz dokładnie: ${ACCOUNT_DELETION_PHRASE}.`);
    }

    try {
      await deleteSupabaseAccount({
        session,
        password: deletionInput.password,
        authClient: authClient(),
        adminClient: supabaseConnection.client,
      });
    } catch (error) {
      if (error.message === "Nie udało się potwierdzić hasła.") {
        throw new ApiError(400, error.message);
      }
      throw error;
    }

    clearAuthCookies(res);
    res.writeHead(204, {
      ...SECURITY_HEADERS,
      "Cache-Control": "no-store",
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/api/yarns") {
    const session = await requireAuthenticatedSession(req, res);
    const yarns = await getSupabaseYarns(session);
    res.setHeader("ETag", getYarnCollectionVersion(yarns));
    return sendJson(res, 200, yarns);
  }

  if (req.method === "POST" && url.pathname === "/api/yarns") {
    const body = await readBody(req);
    const yarn = validateYarn(body);
    const session = await requireAuthenticatedSession(req, res);
    enforceRequestRateLimit([`user:${session.user.id}`], yarnWriteRateLimiter, res);
    await requireCurrentYarnVersion(req, session);
    return sendYarnMutationResponse(res, 201, await insertSupabaseYarn(session, yarn), session);
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/yarns/")) {
    const id = Number(url.pathname.split("/").pop());
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, "Identyfikator włóczki musi być dodatnią liczbą całkowitą.");
    }
    const body = await readBody(req);
    const yarn = validateYarn(body);
    const session = await requireAuthenticatedSession(req, res);
    enforceRequestRateLimit([`user:${session.user.id}`], yarnWriteRateLimiter, res);
    await requireCurrentYarnVersion(req, session);
    return sendYarnMutationResponse(res, 200, await updateSupabaseYarn(session, id, yarn), session);
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/yarns/")) {
    const id = Number(url.pathname.split("/").pop());
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, "Identyfikator włóczki musi być dodatnią liczbą całkowitą.");
    }
    const session = await requireAuthenticatedSession(req, res);
    enforceRequestRateLimit([`user:${session.user.id}`], yarnWriteRateLimiter, res);
    await requireCurrentYarnVersion(req, session);
    await deleteSupabaseYarn(session, id);
    return sendYarnMutationResponse(res, 204, null, session);
  }

  if (req.method === "GET" && url.pathname === "/api/patterns") {
    return sendJson(res, 200, await getCatalogPatterns(parsePatternPage(url)));
  }

  if (req.method === "GET" && url.pathname === "/api/matches") {
    const session = await requireAuthenticatedSession(req, res);
    const result = await getSupabaseMatches(session);
    res.setHeader("X-Motek-Match-Scope", result.limited ? "subset" : "full");
    return sendJson(res, 200, result.matches);
  }

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

function getRuntimeConfig() {
  const host = process.env.HOST?.trim() || "127.0.0.1";
  const rawPort = process.env.PORT?.trim() || "3000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Nieprawidłowa wartość PORT: ${rawPort}`);
  }

  return { host, port };
}

async function main(options = {}) {
  validateCookieSecurityConfig();
  validateOriginConfig();
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
  if (!supabaseConnection || !supabaseAuthConfig) {
    throw new Error(
      "Motek wymaga konfiguracji Supabase. Ustaw SUPABASE_URL, SUPABASE_SECRET_KEY i SUPABASE_PUBLISHABLE_KEY."
    );
  }
  await supabaseConnection.verify();
  console.log("Połączenie Motka z Supabase działa.");

  server = http.createServer(async (req, res) => {
    let url;

    try {
      url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && url.pathname === "/health") {
        return sendJson(res, 200, { status: "ok" });
      }

      if (url.pathname.startsWith("/api/")) {
        return await handleApi(req, res, url);
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        return await sendFile(res, path.join(rootDir, "index.html"));
      }
      if (url.pathname === "/styles.css") {
        return await sendFile(res, path.join(rootDir, "styles.css"));
      }
      if (url.pathname === "/app.js") {
        return await sendFile(res, path.join(rootDir, "app.js"));
      }
      if (url.pathname === "/client-policy.js") {
        return await sendFile(res, path.join(rootDir, "client-policy.js"));
      }
      if (url.pathname === "/material-policy.js") {
        return await sendFile(res, path.join(rootDir, "material-policy.js"));
      }
      if (url.pathname === "/favicon.svg") {
        return await sendFile(res, path.join(rootDir, "favicon.svg"));
      }

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
  return { host, port: boundPort };
}

async function shutdown(signal = "shutdown") {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Zatrzymywanie Motka (${signal})...`);

  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  server = null;
  supabaseConnection = null;
  supabaseAuthConfig = null;
  supabaseAuthClientFactory = createSupabaseAuthClient;

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
  main,
  normalizeAuthEmail,
  normalizeAuthLogin,
  normalizeCatalogPattern,
  normalizeSupabaseYarn,
  scorePattern,
  selectMatchingYarns,
  validatePatternCatalogSize,
  validateYarn,
  validateYarnStorageCapacity,
  toSupabaseYarn,
  buildAuthCookie,
  createAuthRateLimiter,
  createRequestRateLimiter,
  validateMatchLimits,
  shouldUseSecureCookies,
  shutdown,
  validateCookieSecurityConfig,
  validateAuthPassword,
  normalizeRecoveryToken,
};
