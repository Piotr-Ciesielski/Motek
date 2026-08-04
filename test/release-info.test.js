const test = require("node:test");
const assert = require("node:assert/strict");
const { readReleaseInfo } = require("../release-info");

test("release używa SHA Railway i nie ujawnia innych zmiennych", () => {
  assert.deepEqual(readReleaseInfo({
    RAILWAY_GIT_COMMIT_SHA: "a".repeat(40),
    DEPLOYMENT_ENV: "staging",
    SUPABASE_SECRET_KEY: "nie-wolno-zwrócić",
  }, "2.0.0-alpha.39"), {
    version: "2.0.0-alpha.39",
    commit: "a".repeat(40),
    environment: "staging",
  });
});

test("release używa lokalnych wartości dla braku lub nieprawidłowego SHA", () => {
  assert.deepEqual(readReleaseInfo({
    RAILWAY_GIT_COMMIT_SHA: "A".repeat(40),
  }, "2.0.0-alpha.39"), {
    version: "2.0.0-alpha.39",
    commit: "local",
    environment: "local",
  });
});
