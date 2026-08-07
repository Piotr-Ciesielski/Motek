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

test("końcowa migracja utrzymuje login równy emailowi i odbiera jego edycję", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(sql, /insert into public\.profiles \(id, login, email, avatar_url\)/);
  assert.match(sql, /set email = normalized_email,[\s\S]*login = normalized_email/);
  assert.match(sql, /revoke update \(login, full_name, avatar_url\)/);
  assert.match(sql, /grant update \(avatar_url\)/);
  assert.match(sql, /profiles_login_email_check/);
});

test("backend nie odczytuje usuniętej kolumny full_name", () => {
  const server = fs.readFileSync(serverPath, "utf8");

  assert.doesNotMatch(server, /\bfull_name\b/);
});

test("migracja ACL blokuje bezpośrednie mutacje i usuwa publiczny licznik wersji", () => {
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260807150000_reconcile_yarn_acl_and_recovery.sql"
  );
  const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, "utf8") : "";

  assert.match(sql, /revoke\s+insert,\s*update,\s*delete\s+on\s+table\s+public\.yarns\s+from\s+authenticated/i);
  assert.match(sql, /revoke\s+all\s+on\s+table\s+private\.yarn_store_versions\s+from\s+public,\s*anon,\s*authenticated/i);
  assert.match(sql, /drop\s+table\s+if\s+exists\s+public\.yarn_store_versions/i);
});

test("migracja recovery przechowuje grant i zużywa go atomowo", () => {
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260807150000_reconcile_yarn_acl_and_recovery.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(sql, /create table if not exists private\.auth_recovery_grants/i);
  assert.match(sql, /used_at\s+timestamptz/i);
  assert.match(sql, /create_auth_recovery_grant/i);
  assert.match(sql, /consume_auth_recovery_grant/i);
  assert.match(sql, /update private\.auth_recovery_grants/i);
  assert.match(sql, /revoke all on table private\.auth_recovery_grants from public, anon, authenticated/i);
});
