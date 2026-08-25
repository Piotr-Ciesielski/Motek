/**
 * HTTP routes for the public pattern catalog and authenticated matches.
 * All application-specific behavior is supplied through dependencies so
 * this router can be tested without loading the server singleton.
 */
function createPatternRouter(dependencies) {
  const {
    sendJson,
    requireAuthenticatedSession,
    requireCurrentTermsSession = requireAuthenticatedSession,
    getCatalogPatterns,
    getSupabaseMatches,
    parsePatternPage,
    parseTechniqueParam,
    enforceRequestRateLimit,
    getMatchRateLimitKeys,
    matchRateLimiter,
    readBody,
    validateManualPatternPayload,
    insertSupabasePattern,
    patternWriteRateLimiter,
  } = dependencies;

  return {
    async handle(req, res, url) {
      if (req.method === "POST" && url.pathname === "/api/patterns") {
        const draft = validateManualPatternPayload(await readBody(req));
        const session = await requireCurrentTermsSession(req, res);
        enforceRequestRateLimit([`user:${session.user.id}`], patternWriteRateLimiter, res);
        const pattern = await insertSupabasePattern(draft);
        sendJson(res, 201, {
          id: pattern.id,
          name: pattern.name,
          publicationStatus: pattern.publication_status,
        });
        return true;
      }

      if (req.method === "GET" && url.pathname === "/api/patterns") {
        await requireCurrentTermsSession(req, res);
        const technique = typeof parseTechniqueParam === "function"
          ? parseTechniqueParam(url)
          : undefined;
        const page = typeof parsePatternPage === "function"
          ? parsePatternPage(url)
          : undefined;
        const patterns = page === undefined && technique === undefined
          ? await getCatalogPatterns()
          : await getCatalogPatterns({
            ...page,
            ...(technique === undefined ? {} : { technique }),
          });
        sendJson(res, 200, patterns);
        return true;
      }

      if (req.method === "GET" && url.pathname === "/api/matches") {
        const session = await requireCurrentTermsSession(req, res);
        enforceRequestRateLimit(
          getMatchRateLimitKeys(req, session),
          matchRateLimiter,
          res,
        );
        const technique = typeof parseTechniqueParam === "function"
          ? parseTechniqueParam(url)
          : undefined;
        const result = await getSupabaseMatches(session, { technique });
        res.setHeader("X-Motek-Match-Scope", result.limited ? "subset" : "full");
        sendJson(res, 200, result.matches);
        return true;
      }

      return false;
    },
  };
}

module.exports = { createPatternRouter };
