const { createClient } = require("@supabase/supabase-js");

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

async function verifySupabaseDataApi(config, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Ta wersja Node.js nie udostępnia funkcji fetch wymaganej przez Supabase.");
  }

  let response;
  try {
    response = await fetchImpl(`${config.url}/rest/v1/`, {
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
    verify: () => verifySupabaseDataApi(config, options.fetchImpl),
  };
}

module.exports = {
  createSupabaseConnection,
  readSupabaseConfig,
  verifySupabaseDataApi,
};
