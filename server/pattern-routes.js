/**
 * HTTP routes for the public pattern catalog and authenticated matches.
 * All application-specific behavior is supplied through dependencies so
 * this router can be tested without loading the server singleton.
 */
function createPatternRouter(dependencies) {
  const {
    sendJson,
    requireAuthenticatedSession,
    getCatalogPatterns,
    getSupabaseMatches,
    parsePatternPage,
    enforceRequestRateLimit,
    patternReadRateLimiter,
    matchingRateLimiter,
    getRequestRateLimitKeys,
  } = dependencies;

  return {
    async handle(req, res, url) {
      if (req.method === "GET" && url.pathname === "/api/patterns") {
        if (enforceRequestRateLimit && patternReadRateLimiter && getRequestRateLimitKeys) {
          enforceRequestRateLimit(getRequestRateLimitKeys(req), patternReadRateLimiter, res);
        }
        const page = typeof parsePatternPage === "function"
          ? parsePatternPage(url)
          : undefined;
        const patterns = page === undefined
          ? await getCatalogPatterns()
          : await getCatalogPatterns(page);
        sendJson(res, 200, patterns);
        return true;
      }

      if (req.method === "GET" && url.pathname === "/api/matches") {
        if (enforceRequestRateLimit && matchingRateLimiter && getRequestRateLimitKeys) {
          enforceRequestRateLimit(getRequestRateLimitKeys(req), matchingRateLimiter, res);
        }
        const session = await requireAuthenticatedSession(req, res);
        const result = await getSupabaseMatches(session);
        res.setHeader("X-Motek-Match-Scope", result.limited ? "subset" : "full");
        sendJson(res, 200, result.matches);
        return true;
      }

      return false;
    },
  };
}

module.exports = { createPatternRouter };
