/**
 * Routes for starting and reading the single active project.
 * Database access, validation and HTTP helpers are injected so the route
 * contract can be tested independently from the server singleton.
 */
function createProjectRouter(dependencies) {
  const {
    sendJson,
    requireAuthenticatedSession,
    requireCurrentYarnVersion,
    requireCurrentProjectVersion,
    validateProjectStartPayload,
    validateProjectProgressPayload,
    getProjectCollectionVersion,
    getSupabaseActiveProject,
    createSupabaseActiveProject,
    updateSupabaseActiveProject,
    readBody,
    enforceRequestRateLimit,
    yarnWriteRateLimiter,
  } = dependencies;

  function setActiveVersionHeaders(res, version) {
    res.setHeader("ETag", version);
    res.setHeader("X-Motek-Project-Version", version);
  }

  return {
    async handle(req, res, url) {
      if (req.method === "GET" && url.pathname === "/api/projects/active") {
        const session = await requireAuthenticatedSession(req, res);
        const project = await getSupabaseActiveProject(session);
        if (!project) {
          sendJson(res, 204, null);
          return true;
        }
        setActiveVersionHeaders(res, getProjectCollectionVersion(project.version));
        sendJson(res, 200, project);
        return true;
      }

      if (req.method === "POST" && url.pathname === "/api/projects") {
        const input = validateProjectStartPayload(await readBody(req));
        const session = await requireAuthenticatedSession(req, res);
        enforceRequestRateLimit([`user:${session.user.id}`], yarnWriteRateLimiter, res);
        const expectedYarnVersion = await requireCurrentYarnVersion(req);
        const project = await createSupabaseActiveProject(
          session,
          input.patternId,
          input.variantId,
          expectedYarnVersion,
        );
        setActiveVersionHeaders(res, getProjectCollectionVersion(project.version));
        sendJson(res, 201, project);
        return true;
      }

      if (req.method === "PATCH" && url.pathname === "/api/projects/active") {
        const patch = validateProjectProgressPayload(await readBody(req));
        const session = await requireAuthenticatedSession(req, res);
        enforceRequestRateLimit([`user:${session.user.id}`], yarnWriteRateLimiter, res);
        const expectedProjectVersion = requireCurrentProjectVersion(req);
        const project = await updateSupabaseActiveProject(session, patch, expectedProjectVersion);
        setActiveVersionHeaders(res, getProjectCollectionVersion(project.version));
        sendJson(res, 200, project);
        return true;
      }

      return false;
    },
  };
}

module.exports = { createProjectRouter };
