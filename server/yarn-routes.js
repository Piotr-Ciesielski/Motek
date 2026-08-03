/**
 * Routes for the authenticated yarn inventory.
 * Database access, validation and HTTP helpers are injected so the route
 * contract can be tested independently from the server singleton.
 */
function createYarnRouter(dependencies) {
  const {
    ApiError,
    sendJson,
    getYarnCollectionVersion,
    getSupabaseYarns,
    getSupabaseYarnVersion,
    insertSupabaseYarn,
    updateSupabaseYarn,
    deleteSupabaseYarn,
    sendYarnMutationResponse,
    requireAuthenticatedSession,
    requireCurrentYarnVersion,
    validateYarn,
    readBody,
    enforceRequestRateLimit,
    yarnWriteRateLimiter,
  } = dependencies;

  function parseId(url) {
    const id = Number(url.pathname.split("/").pop());
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, "Identyfikator włóczki musi być dodatnią liczbą całkowitą.");
    }
    return id;
  }

  return {
    async handle(req, res, url) {
      if (req.method === "GET" && url.pathname === "/api/yarns") {
        const session = await requireAuthenticatedSession(req, res);
        const yarns = await getSupabaseYarns(session);
        res.setHeader("ETag", getYarnCollectionVersion(await getSupabaseYarnVersion(session)));
        sendJson(res, 200, yarns);
        return true;
      }

      if (req.method === "POST" && url.pathname === "/api/yarns") {
        const yarn = validateYarn(await readBody(req));
        const session = await requireAuthenticatedSession(req, res);
        enforceRequestRateLimit([`user:${session.user.id}`], yarnWriteRateLimiter, res);
        yarn.expectedVersion = await requireCurrentYarnVersion(req);
        await sendYarnMutationResponse(res, 201, await insertSupabaseYarn(session, yarn));
        return true;
      }

      if (req.method === "PATCH" && url.pathname.startsWith("/api/yarns/")) {
        const id = parseId(url);
        const yarn = validateYarn(await readBody(req));
        const session = await requireAuthenticatedSession(req, res);
        enforceRequestRateLimit([`user:${session.user.id}`], yarnWriteRateLimiter, res);
        yarn.expectedVersion = await requireCurrentYarnVersion(req);
        await sendYarnMutationResponse(res, 200, await updateSupabaseYarn(session, id, yarn));
        return true;
      }

      if (req.method === "DELETE" && url.pathname.startsWith("/api/yarns/")) {
        const id = parseId(url);
        const session = await requireAuthenticatedSession(req, res);
        enforceRequestRateLimit([`user:${session.user.id}`], yarnWriteRateLimiter, res);
        const expectedVersion = await requireCurrentYarnVersion(req);
        const mutation = await deleteSupabaseYarn(session, id, expectedVersion);
        await sendYarnMutationResponse(res, 204, mutation);
        return true;
      }

      return false;
    },
  };
}

module.exports = { createYarnRouter };
