const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(__dirname, "..", "server.js");
const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260731104741_email_login_and_remove_full_name.sql"
);

test("migracja usuwa stary constraint loginu przed przepisaniem loginów", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  const dropConstraintPosition = sql.indexOf(
    "drop constraint if exists profiles_login_check"
  );
  const updateProfilesPosition = sql.indexOf("update public.profiles as p");

  assert.notEqual(dropConstraintPosition, -1);
  assert.notEqual(updateProfilesPosition, -1);
  assert.ok(dropConstraintPosition < updateProfilesPosition);
});

test("migracja usuwa full_name z profilu i metadanych Auth", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(sql, /raw_user_meta_data = raw_user_meta_data - 'full_name'/);
  assert.match(sql, /alter table public\.profiles\s+drop column if exists full_name/s);
});

test("backend nie odczytuje usuniętej kolumny full_name", () => {
  const server = fs.readFileSync(serverPath, "utf8");

  assert.doesNotMatch(server, /\bfull_name\b/);
});
