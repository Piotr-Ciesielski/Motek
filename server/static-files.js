const path = require("node:path");
const fs = require("node:fs/promises");

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

  return {
    async handle(req, res, url) {
      if (req?.method !== "GET") return false;
      const pathname = typeof url === "string" ? new URL(url, "http://localhost").pathname : url?.pathname;
      if (typeof pathname !== "string" || !fileMap.has(pathname)) return false;

      const filePath = resolveAllowlistedFile(rootDir, fileMap.get(pathname));
      if (!filePath) return false;

      const ext = path.extname(filePath).toLowerCase();
      try {
        const body = await fs.readFile(filePath);
        res.writeHead(200, {
          ...securityHeaders,
          ...SECURITY_HEADERS,
          "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
          "Cache-Control": ext === ".webp" ? "public, max-age=31536000, immutable" : "no-cache",
        });
        res.end(body);
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
