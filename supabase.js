const { createClient } = require("@supabase/supabase-js");

const SUPABASE_AUTH_REQUEST_TIMEOUT_MS = 10 * 1000;

function createTimedFetch(fetchImpl = globalThis.fetch, timeoutMs = SUPABASE_AUTH_REQUEST_TIMEOUT_MS) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Ta wersja Node.js nie udostępnia funkcji fetch wymaganej przez Supabase Auth.");
  }

  return async (input, init = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const signal = init.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;

    try {
      return await fetchImpl(input, { ...init, signal });
    } finally {
      clearTimeout(timeout);
    }
  };
}

function readSupabaseConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();

  if (!url && !secretKey) {
    return null;
  }

  if (!url || !secretKey) {
    throw new Error(
      "Konfiguracja Supabase jest niepełna. Ustaw SUPABASE_URL i SUPABASE_SECRET_KEY."
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("SUPABASE_URL nie jest prawidłowym adresem URL.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("SUPABASE_URL musi używać bezpiecznego połączenia HTTPS.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("SUPABASE_URL nie może zawierać danych logowania.");
  }

  if (!secretKey.startsWith("sb_secret_")) {
    throw new Error(
      "SUPABASE_SECRET_KEY musi być nowym kluczem typu secret (sb_secret_...), a nie kluczem publicznym."
    );
  }

  return {
    url: parsedUrl.toString().replace(/\/$/, ""),
    secretKey,
  };
}

function validateSupabaseUrl(value) {
  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error("SUPABASE_URL nie jest prawidłowym adresem URL.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("SUPABASE_URL musi używać bezpiecznego połączenia HTTPS.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("SUPABASE_URL nie może zawierać danych logowania.");
  }

  return parsedUrl.toString().replace(/\/$/, "");
}

function readSupabaseAuthConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url && !publishableKey) {
    return null;
  }

  if (!url || !publishableKey) {
    throw new Error(
      "Konfiguracja Supabase Auth jest niepełna. Ustaw SUPABASE_URL i SUPABASE_PUBLISHABLE_KEY."
    );
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY musi być kluczem publicznym typu sb_publishable_."
    );
  }

  return {
    url: validateSupabaseUrl(url),
    publishableKey,
  };
}

function createSupabaseAuthClient(config, accessToken, clientOptions = {}) {
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: createTimedFetch(clientOptions.fetchImpl, clientOptions.timeoutMs),
    },
  };

  if (accessToken) {
    options.global.headers = {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  return createClient(config.url, config.publishableKey, options);
}

async function verifySupabaseDataApi(
  config,
  fetchImpl = globalThis.fetch,
  timeoutMs = SUPABASE_AUTH_REQUEST_TIMEOUT_MS,
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Ta wersja Node.js nie udostępnia funkcji fetch wymaganej przez Supabase.");
  }

  let response;
  try {
    const timedFetch = createTimedFetch(fetchImpl, timeoutMs);
    response = await timedFetch(`${config.url}/rest/v1/`, {
      method: "GET",
      headers: {
        Accept: "application/openapi+json",
        apikey: config.secretKey,
      },
    });
  } catch (error) {
    throw new Error(`Nie udało się połączyć z Supabase: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(
      `Supabase odrzucił połączenie (HTTP ${response.status}). Sprawdź adres projektu i klucz secret.`
    );
  }

  if (response.body && typeof response.body.cancel === "function") {
    await response.body.cancel();
  }
}

function createSupabaseConnection(options = {}) {
  const config = readSupabaseConfig(options.env);
  if (!config) {
    return null;
  }

  const client = createClient(config.url, config.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return {
    client,
    verify: () => verifySupabaseDataApi(config, options.fetchImpl, options.timeoutMs),
  };
}

module.exports = {
  createSupabaseConnection,
  createSupabaseAuthClient,
  createTimedFetch,
  readSupabaseConfig,
  readSupabaseAuthConfig,
  verifySupabaseDataApi,
};
