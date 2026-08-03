function readReleaseInfo(env = process.env, version) {
  const commit = /^[0-9a-f]{40}$/.test(String(env.RAILWAY_GIT_COMMIT_SHA || ""))
    ? env.RAILWAY_GIT_COMMIT_SHA
    : "local";

  return {
    version,
    commit,
    environment: String(env.DEPLOYMENT_ENV || "local").trim() || "local",
  };
}

module.exports = { readReleaseInfo };
