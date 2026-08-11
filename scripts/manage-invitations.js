const crypto = require("node:crypto");

const { createSupabaseConnection } = require("../supabase");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_EXPIRY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

function normalizeEmail(value) {
  if (typeof value !== "string") throw new TypeError("E-mail musi być tekstem.");
  const email = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error("E-mail ma nieprawidłowy format.");
  return email;
}

function normalizeExpiry(value, now = new Date()) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("expires-at musi być datą ISO.");
  }
  const match = ISO_EXPIRY_PATTERN.exec(value);
  if (!match) throw new Error("expires-at musi być ścisłą datą ISO z timezone.");

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, timezone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (timezone !== "Z" && (Number(timezone.slice(1, 3)) > 23 || Number(timezone.slice(4, 6)) > 59))
  ) {
    throw new Error("expires-at musi być poprawną datą ISO.");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error("expires-at musi być poprawną datą ISO.");
  if (parsed <= now) throw new Error("expires-at musi być w przyszłości.");
  return parsed.toISOString();
}

function validateAppOrigin(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("APP_ORIGIN musi być adresem URL.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("APP_ORIGIN musi być prawidłowym adresem URL.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("APP_ORIGIN nie może zawierać danych logowania.");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalhost)) {
    throw new Error("APP_ORIGIN musi używać HTTPS; HTTP jest dozwolone tylko lokalnie.");
  }

  return parsed;
}

function parseArgs(argv = []) {
  const [command, ...rest] = argv;
  if (!["create", "revoke", "purge"].includes(command)) {
    throw new Error("Nieznana komenda. Użyj create, revoke albo purge.");
  }

  const values = {};
  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    if (!["--email", "--expires-at", "--id"].includes(option)) {
      throw new Error(`Nieznany argument: ${option}`);
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${option} wymaga wartości.`);
    values[option.slice(2).replaceAll("-", "")] = value;
    index += 1;
  }

  if (command === "create") {
    if (!values.email) throw new Error("create wymaga --email.");
    if (!values.expiresat) throw new Error("create wymaga --expires-at.");
    return { command, email: values.email, expiresAt: values.expiresat };
  }
  if (command === "revoke") {
    if (!values.id) throw new Error("revoke wymaga --id.");
    return { command, id: values.id };
  }
  if (rest.length) throw new Error("purge nie przyjmuje argumentów.");
  return { command };
}

function getRpcError(result) {
  return result?.error || null;
}

async function createInvitation({
  client,
  email,
  expiresAt,
  appOrigin,
  now = () => new Date(),
  randomBytesImpl = crypto.randomBytes,
}) {
  if (!client?.rpc) throw new TypeError("Brak klienta service Supabase.");
  const normalizedEmail = normalizeEmail(email);
  const normalizedExpiry = normalizeExpiry(expiresAt, now());
  const random = randomBytesImpl(32);
  if (!Buffer.isBuffer(random) || random.length !== 32) {
    throw new Error("Token musi powstać z dokładnie 32 losowych bajtów.");
  }
  const token = random.toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
  const origin = validateAppOrigin(appOrigin);
  origin.search = "";
  origin.hash = "";
  origin.searchParams.set("invitation", token);

  const result = await client.rpc("create_registration_invitation", {
    p_email: normalizedEmail,
    p_token_hash: tokenHash,
    p_expires_at: normalizedExpiry,
  });
  if (getRpcError(result)) throw result.error;
  if (!result?.data) throw new Error("Baza nie zwróciła identyfikatora zaproszenia.");

  return Object.freeze({
    id: result.data,
    token,
    invitationUrl: origin.toString(),
  });
}

async function revokeInvitation(client, id) {
  if (!UUID_PATTERN.test(String(id || ""))) throw new Error("Id zaproszenia ma nieprawidłowy format.");
  const result = await client.rpc("revoke_registration_invitation", { p_invitation_id: id });
  if (getRpcError(result)) throw result.error;
  if (result?.data !== true) {
    throw new Error("Zaproszenie nie istnieje, jest już użyte/odwołane albo ma aktywną rezerwację.");
  }
  return true;
}

async function purgeRegistrationLogs(client) {
  const result = await client.rpc("purge_registration_security_logs");
  if (getRpcError(result)) throw result.error;
  return result?.data;
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const connection = createSupabaseConnection({ env });
  if (!connection) throw new Error("Brak konfiguracji Supabase service.");

  if (args.command === "create") {
    if (!env.APP_ORIGIN) throw new Error("Brak APP_ORIGIN w konfiguracji.");
    const invitation = await createInvitation({
      client: connection.client,
      email: args.email,
      expiresAt: args.expiresAt,
      appOrigin: env.APP_ORIGIN,
    });
    console.log(`Link zaproszenia (pokaż go tylko teraz): ${invitation.invitationUrl}`);
    console.log("Nie zapisuj surowego tokenu w logach — po zamknięciu tego komunikatu nie da się go odzyskać.");
    return;
  }

  if (args.command === "revoke") {
    await revokeInvitation(connection.client, args.id);
    console.log("Zaproszenie zostało odwołane.");
    return;
  }

  const result = await purgeRegistrationLogs(connection.client);
  console.log(`Usunięto logów: ${JSON.stringify(result)}`);
}

if (require.main === module) {
  main().catch(() => {
    console.error("Operacja zaproszenia nie powiodła się.");
    process.exitCode = 1;
  });
}

module.exports = {
  createInvitation,
  normalizeExpiry,
  parseArgs,
  purgeRegistrationLogs,
  revokeInvitation,
  validateAppOrigin,
};
