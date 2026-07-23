const http = require("http");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const initSqlJs = require("sql.js");
const { createSupabaseConnection } = require("./supabase");

const rootDir = __dirname;
const configuredDbFile = process.env.DATABASE_FILE?.trim();
const dbFile = configuredDbFile
  ? path.resolve(rootDir, configuredDbFile)
  : path.join(rootDir, "data", "motek.sqlite");
const dbDir = path.dirname(dbFile);

let SQL;
let db;
let server;
let supabaseConnection;
let shuttingDown = false;

const MAX_JSON_BODY_BYTES = 16 * 1024;
const MAX_TEXT_LENGTH = {
  name: 100,
  color: 50,
};
const MAX_MEASUREMENT = 1_000_000;
const ALLOWED_MATERIALS = new Set(["wełna", "bawełna", "akryl", "alpaka", "mieszanka"]);
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

function toJson(value) {
  return JSON.stringify(value);
}

function fromJson(value) {
  if (Array.isArray(value)) return value;
  return value ? JSON.parse(value) : [];
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS yarns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      material TEXT NOT NULL,
      weightClass TEXT NOT NULL,
      length INTEGER NOT NULL,
      weight INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      yarnsNeeded INTEGER NOT NULL,
      metersNeeded INTEGER NOT NULL,
      gramsNeeded INTEGER NOT NULL,
      materials TEXT NOT NULL,
      weightClasses TEXT NOT NULL,
      colors TEXT NOT NULL
    );
  `);
}

function seedData() {
  const yarnCount = db.exec("SELECT COUNT(*) AS count FROM yarns");
  const patternCount = db.exec("SELECT COUNT(*) AS count FROM patterns");
  const yarnTotal = yarnCount.length ? yarnCount[0].values[0][0] : 0;
  const patternTotal = patternCount.length ? patternCount[0].values[0][0] : 0;

  if (yarnTotal === 0) {
    const stmt = db.prepare(
      "INSERT INTO yarns (name, color, material, weightClass, length, weight) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const seedYarns = [
      ["Merino Soft", "beż", "wełna", "dk", 220, 80],
      ["Cotton Air", "krem", "bawełna", "sport", 180, 60],
      ["Acrylic Mix", "szary", "mieszanka", "dk", 240, 100],
    ];
    db.run("BEGIN TRANSACTION");
    seedYarns.forEach((row) => stmt.run(row));
    db.run("COMMIT");
    stmt.free();
  }

  if (patternTotal === 0) {
    const stmt = db.prepare(
      "INSERT INTO patterns (name, description, yarnsNeeded, metersNeeded, gramsNeeded, materials, weightClasses, colors) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const seedPatterns = [
      [
        "Prosty szal",
        "Lekki projekt dla mieszanych zapasów. Wystarczy jedna dobra włóczka lub kilka podobnych motków.",
        1,
        300,
        100,
        toJson(["wełna", "alpaka", "akryl", "mieszanka"]),
        toJson(["lace", "fingering", "sport", "dk"]),
        "dowolny",
      ],
      [
        "Ciepła czapka",
        "Dobry wybór na pojedyncze motki średniej grubości.",
        1,
        180,
        60,
        toJson(["wełna", "alpaka", "akryl", "mieszanka"]),
        toJson(["sport", "dk", "worsted"]),
        "dowolny",
      ],
      [
        "Sweter dziecięcy",
        "Projekt wymaga kilku motków, ale nadal jest realny dla większości domowych zapasów.",
        3,
        750,
        250,
        toJson(["wełna", "alpaka", "bawełna", "mieszanka"]),
        toJson(["sport", "dk", "worsted"]),
        "spójne",
      ],
    ];
    db.run("BEGIN TRANSACTION");
    seedPatterns.forEach((row) => stmt.run(row));
    db.run("COMMIT");
    stmt.free();
  }
}

function persist() {
  const data = db.export();
  fs.mkdirSync(dbDir, { recursive: true });
  fs.writeFileSync(dbFile, Buffer.from(data));
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

function scorePattern(pattern, yarns) {
  const materials = fromJson(pattern.materials);
  const weightClasses = fromJson(pattern.weightClasses);
  const totalLength = yarns.reduce((sum, yarn) => sum + yarn.length, 0);
  const totalWeight = yarns.reduce((sum, yarn) => sum + yarn.weight, 0);
  const matchedYarns = yarns.filter((yarn) => materials.includes(yarn.material) && weightClasses.includes(yarn.weightClass)).length;
  const lengthScore = Math.min(totalLength / pattern.metersNeeded, 1);
  const weightScore = Math.min(totalWeight / pattern.gramsNeeded, 1);
  const materialScore = Math.min(matchedYarns / pattern.yarnsNeeded, 1);
  const colorScore = pattern.colors === "dowolny" ? 1 : 0.8;
  const total = Math.round(lengthScore * 40 + weightScore * 25 + materialScore * 25 + colorScore * 10);
  const doable = totalLength >= pattern.metersNeeded && totalWeight >= pattern.gramsNeeded && matchedYarns >= pattern.yarnsNeeded;
  return { total, doable, totalLength, totalWeight, matchedYarns };
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

function getYarns() {
  const stmt = db.prepare("SELECT * FROM yarns ORDER BY id ASC");
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getLocalPatterns() {
  const stmt = db.prepare("SELECT * FROM patterns ORDER BY id ASC");
  const rows = [];
  while (stmt.step()) {
    const pattern = stmt.getAsObject();
    rows.push({
      ...pattern,
      materials: fromJson(pattern.materials),
      weightClasses: fromJson(pattern.weightClasses),
    });
  }
  stmt.free();
  return rows;
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
    materials: Array.isArray(pattern.materials) ? pattern.materials : [],
    metersPer100g: Number.isFinite(ratio) ? ratio : null,
    yarnRequirements: Array.isArray(pattern.yarn_requirements)
      ? pattern.yarn_requirements
      : [],
    sourceLanguage: pattern.source_language || "unknown",
    needsReview: Boolean(pattern.needs_review),
  };
}

async function getCatalogPatterns() {
  if (!supabaseConnection) {
    return getLocalPatterns().map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      description: pattern.description,
      materials: pattern.materials,
      metersPer100g: null,
      yarnRequirements: [],
      sourceLanguage: "pl",
      needsReview: true,
    }));
  }

  const { data, error } = await supabaseConnection.client
    .from("patterns")
    .select(
      "id,name,description,materials,meters_per_100g,yarn_requirements,source_language,needs_review"
    )
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Nie udało się pobrać wzorów z Supabase: ${error.message}`);
  }

  return data.map(normalizeCatalogPattern);
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

function validateYarn(body) {
  return {
    name: normalizeText(body.name, "name", "Bez nazwy"),
    color: normalizeText(body.color, "color", "nieokreślony"),
    material: normalizeEnum(body.material, "material", "mieszanka", ALLOWED_MATERIALS),
    weightClass: normalizeEnum(body.weightClass, "weightClass", "dk", ALLOWED_WEIGHT_CLASSES),
    length: normalizeMeasurement(body.length, "length"),
    weight: normalizeMeasurement(body.weight, "weight"),
  };
}

function insertYarn(yarn) {
  const stmt = db.prepare(
    "INSERT INTO yarns (name, color, material, weightClass, length, weight) VALUES (?, ?, ?, ?, ?, ?)"
  );
  stmt.run([
    yarn.name,
    yarn.color,
    yarn.material,
    yarn.weightClass,
    yarn.length,
    yarn.weight,
  ]);
  stmt.free();
  persist();
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/yarns") {
    return sendJson(res, 200, getYarns());
  }

  if (req.method === "POST" && url.pathname === "/api/yarns") {
    const body = await readBody(req);
    insertYarn(validateYarn(body));
    const inserted = getYarns().at(-1);
    return sendJson(res, 201, inserted);
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/yarns/")) {
    const id = Number(url.pathname.split("/").pop());
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, "Identyfikator włóczki musi być dodatnią liczbą całkowitą.");
    }
    const stmt = db.prepare("DELETE FROM yarns WHERE id = ?");
    stmt.run([id]);
    stmt.free();
    if (db.getRowsModified() === 0) {
      throw new ApiError(404, "Nie znaleziono włóczki o podanym identyfikatorze.");
    }
    persist();
    return sendJson(res, 204, {});
  }

  if (req.method === "GET" && url.pathname === "/api/patterns") {
    return sendJson(res, 200, await getCatalogPatterns());
  }

  if (req.method === "GET" && url.pathname === "/api/matches") {
    const yarns = getYarns();
    const scored = getLocalPatterns()
      .map((pattern) => ({ pattern, ...scorePattern(pattern, yarns) }))
      .filter((item) => item.doable)
      .sort((a, b) => b.total - a.total);
    return sendJson(res, 200, scored);
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
  supabaseConnection = Object.prototype.hasOwnProperty.call(
    options,
    "supabaseConnection"
  )
    ? options.supabaseConnection
    : createSupabaseConnection();
  if (supabaseConnection) {
    await supabaseConnection.verify();
    console.log("Połączenie Motka z Supabase działa.");
  } else {
    console.log("Supabase nie jest jeszcze skonfigurowany. Motek używa lokalnej bazy SQLite.");
  }

  SQL = await initSqlJs({
    locateFile: (file) => path.join(rootDir, "node_modules", "sql.js", "dist", file),
  });

  if (fs.existsSync(dbFile)) {
    db = new SQL.Database(fs.readFileSync(dbFile));
  } else {
    db = new SQL.Database();
  }

  initSchema();
  seedData();
  persist();

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

  if (db) {
    persist();
    db.close();
    db = null;
  }

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

module.exports = { main, normalizeCatalogPattern, shutdown };
