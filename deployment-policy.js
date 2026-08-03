function isTrue(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function readCaptchaConfig(env = process.env) {
  const enabled = isTrue(env.CAPTCHA_ENABLED);
  return {
    enabled,
    provider: enabled ? String(env.CAPTCHA_PROVIDER || "").trim() || null : null,
    siteKey: enabled ? String(env.CAPTCHA_SITE_KEY || "").trim() || null : null,
  };
}

function normalizeCaptchaToken(value, required = false) {
  const token = typeof value === "string" ? value.trim() : "";
  if (required && !token) throw new Error("Potwierdź zabezpieczenie CAPTCHA.");
  if (token.length > 2048) throw new Error("Nieprawidłowy token CAPTCHA.");
  return token || null;
}

function validateDeploymentConfig(env = process.env) {
  const deploymentEnv = String(env.DEPLOYMENT_ENV || "local").trim();
  if (deploymentEnv !== "staging" && deploymentEnv !== "production") return;
  const missing = [];
  if (env.NODE_ENV !== "production") missing.push("NODE_ENV");
  try {
    const origin = new URL(String(env.APP_ORIGIN || ""));
    if (origin.protocol !== "https:" || origin.origin !== String(env.APP_ORIGIN)) throw new Error();
  } catch {
    missing.push("APP_ORIGIN");
  }
  if (!isTrue(env.COOKIE_SECURE)) missing.push("COOKIE_SECURE");
  if (env.HOST !== "0.0.0.0") missing.push("HOST");
  if (!isTrue(env.TRUST_PROXY)) missing.push("TRUST_PROXY");
  if (!isTrue(env.CAPTCHA_ENABLED)) missing.push("CAPTCHA_ENABLED");
  if (env.CAPTCHA_PROVIDER !== "turnstile") missing.push("CAPTCHA_PROVIDER");
  if (!String(env.CAPTCHA_SITE_KEY || "").trim()) missing.push("CAPTCHA_SITE_KEY");
  if (!String(env.SUPABASE_URL || "").trim()) missing.push("SUPABASE_URL");
  if (!String(env.SUPABASE_SECRET_KEY || "").trim()) missing.push("SUPABASE_SECRET_KEY");
  if (!String(env.SUPABASE_PUBLISHABLE_KEY || "").trim()) missing.push("SUPABASE_PUBLISHABLE_KEY");
  if (missing.length) throw new Error(`Nieprawidłowa konfiguracja publicznego wdrożenia: ${missing.join(", ")}`);
}

module.exports = { normalizeCaptchaToken, readCaptchaConfig, validateDeploymentConfig };
