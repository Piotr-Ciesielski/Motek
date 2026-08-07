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
    getMatchRateLimitKeys,
    matchRateLimiter,
  } = dependencies;

  return {
    async handle(req, res, url) {
      if (req.method === "GET" && url.pathname === "/api/patterns") {
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
        const session = await requireAuthenticatedSession(req, res);
        enforceRequestRateLimit(
          getMatchRateLimitKeys(req, session),
          matchRateLimiter,
          res,
        );
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
