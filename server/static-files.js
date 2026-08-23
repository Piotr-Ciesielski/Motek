const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const SECURITY_HEADERS = Object.freeze({
  "Cache-Control": "no-cache",
  "X-Content-Type-Options": "nosniff",
});

const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
});

function resolveAllowlistedFile(rootDir, relativePath) {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) {
    return null;
  }
  const root = path.resolve(rootDir);
  const candidate = path.resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return candidate;
}

function createStaticFileHandler({ rootDir, files, securityHeaders = {} } = {}) {
  const fileMap = new Map(Object.entries(files || {}));
  // ponytail: cache in-memory nie unieważnia się do końca procesu — pliki są częścią obrazu deploymentu; dodaj check mtime, gdy pojawi się hot-reload.
  const cache = new Map();

  const resolveCacheControl = (ext, searchParams) => {
    if (ext === ".webp") return "public, max-age=31536000, immutable";
    if (ext === ".html") return "no-cache";
    const versioned =
      searchParams !== undefined && (searchParams.has("v") || searchParams.has("rev"));
    return versioned ? "public, max-age=31536000, immutable" : "no-cache";
  };

  return {
    async handle(req, res, url) {
      if (req?.method !== "GET") return false;
      const parsedUrl = typeof url === "string" ? new URL(url, "http://localhost") : url;
      const pathname = parsedUrl?.pathname;
      if (typeof pathname !== "string" || !fileMap.has(pathname)) return false;

      const filePath = resolveAllowlistedFile(rootDir, fileMap.get(pathname));
      if (!filePath) return false;

      const ext = path.extname(filePath).toLowerCase();
      const cacheHeaders = {
        ...securityHeaders,
        ...SECURITY_HEADERS,
        "Cache-Control": resolveCacheControl(ext, parsedUrl?.searchParams),
      };

      try {
        let entry = cache.get(filePath);
        if (!entry) {
          const body = await fs.readFile(filePath);
          entry = {
            body,
            etag: `"${crypto.createHash("sha256").update(body).digest("hex")}"`,
          };
          cache.set(filePath, entry);
        }
        if ((req.headers?.["if-none-match"] || "").includes(entry.etag)) {
          res.writeHead(304, { ...cacheHeaders, ETag: entry.etag });
          res.end();
          return true;
        }
        res.writeHead(200, {
          ...cacheHeaders,
          ETag: entry.etag,
          "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
        });
        res.end(entry.body);
      } catch (error) {
        if (error?.code !== "ENOENT" && error?.code !== "EISDIR") throw error;
        res.writeHead(404, {
          ...securityHeaders,
          ...SECURITY_HEADERS,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end("Nie znaleziono zasobu");
      }
      return true;
    },
  };
}

module.exports = { createStaticFileHandler };
