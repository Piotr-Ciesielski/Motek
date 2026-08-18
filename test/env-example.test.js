const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const expectedLocalKeys = [
  "PORT",
  "HOST",
  "NODE_ENV",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "COOKIE_SECURE",
  "APP_ORIGIN",
  "AUTH_IDLE_TIMEOUT_SECONDS",
  "IDLE_SESSION_SECRET",
  "DEPLOYMENT_ENV",
  "CAPTCHA_ENABLED",
  "CAPTCHA_PROVIDER",
  "CAPTCHA_SITE_KEY",
  "METRICS_ENABLED",
  "TRUST_PROXY",
];

function readAssignmentNames(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
    .filter(Boolean);
}

function readAssignmentValues(filePath) {
  return new Map(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

test("przykład lokalnego środowiska dokumentuje dokładnie wymagane klucze", () => {
  const examplePath = path.join(__dirname, "..", ".env.example");

  assert.deepEqual(readAssignmentNames(examplePath), expectedLocalKeys);
});

test("przykład stagingu ustawia kanoniczny APP_ORIGIN z www", () => {
  const examplePath = path.join(__dirname, "..", "deploy", "staging", ".env.staging.example");
  const assignments = readAssignmentValues(examplePath);

  assert.equal(assignments.get("APP_ORIGIN"), "https://www.staging.rysia.org");
});

test("przykład stagingu ustawia kanoniczny SERVER_NAME z www", () => {
  const examplePath = path.join(__dirname, "..", "deploy", "staging", ".env.staging.example");
  const assignments = readAssignmentValues(examplePath);

  assert.equal(assignments.get("SERVER_NAME"), "www.staging.rysia.org");
});
