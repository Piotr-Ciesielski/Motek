const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");
const legacyMigrationPath = path.join(
  migrationsDirectory,
  "20260807150000_reconcile_yarn_acl_and_recovery.sql"
);
const schemaAlignmentPgTapPath = path.join(
  __dirname,
  "..",
  "supabase",
  "tests",
  "database",
  "auth_recovery_schema_alignment.test.sql"
);
const migrationFiles = fs
  .readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith("_align_recovery_grant_primary_key.sql"));

test("nowa migracja recovery zachowuje niezmienioną migrację historyczną", () => {
  const legacySql = fs.readFileSync(legacyMigrationPath, "utf8");
  const legacyHash = crypto.createHash("sha256").update(legacySql).digest("hex");

  assert.equal(
    legacyHash,
    "90d57d6c2ffdd091f4f46be5e20d4628643399eac6f6c719832c7156a19e677e"
  );
  assert.match(legacySql, /grant_id bigint generated always as identity primary key/i);
  assert.match(legacySql, /jti_hash text not null unique/i);
});

test("nowa migracja recovery ustanawia jti_hash jedynym kluczem głównym", () => {
  assert.equal(migrationFiles.length, 1);
  const sql = fs.readFileSync(path.join(migrationsDirectory, migrationFiles[0]), "utf8");

  assert.match(sql, /drop constraint[^;]*primary key|drop constraint[^;]*%i/i);
  assert.match(sql, /primary key \(jti_hash\)/i);
  assert.match(sql, /drop column(?: if exists)? grant_id/i);
  assert.match(sql, /grant_id/i);
});

test("nowa migracja recovery zachowuje kontrakt kolumn używanych przez RPC", () => {
  assert.equal(migrationFiles.length, 1);
  const sql = fs.readFileSync(path.join(migrationsDirectory, migrationFiles[0]), "utf8");

  for (const column of ["user_id", "jti_hash", "expires_at", "used_at", "created_at", "claimed_at"]) {
    assert.match(sql, new RegExp(`'${column}'`, "i"));
  }
  assert.doesNotMatch(sql, /drop column(?: if exists)? (?:user_id|jti_hash|expires_at|used_at|created_at|claimed_at)\b/i);
});

test("nowa migracja recovery waliduje ograniczenia danych przed zakończeniem", () => {
  assert.equal(migrationFiles.length, 1);
  const sql = fs.readFileSync(path.join(migrationsDirectory, migrationFiles[0]), "utf8");

  assert.match(sql, /char_length\(jti_hash\)\s*=\s*64/i);
  assert.match(sql, /expires_at\s*>\s*created_at/i);
  assert.match(sql, /add constraint[\s\S]*?not valid/i);
  assert.match(sql, /validate constraint/i);
});

test("nowa migracja recovery odrzuca constrainty o docelowych nazwach, lecz błędnej definicji", () => {
  assert.equal(migrationFiles.length, 1);
  const sql = fs.readFileSync(path.join(migrationsDirectory, migrationFiles[0]), "utf8");

  assert.match(sql, /pg_get_constraintdef/i);
  assert.match(sql, /auth_recovery_grants_jti_hash_length_check/i);
  assert.match(sql, /auth_recovery_grants_expires_after_created_check/i);
  assert.match(sql, /raise exception[^;]*(?:constraint|ograniczenie)[^;]*(?:definition|definicj)/i);
});

test("pgTAP po replayu sprawdza wykonany kontrakt schematu recovery", () => {
  const pgTapSql = fs.readFileSync(schemaAlignmentPgTapPath, "utf8");

  assert.match(pgTapSql, /select plan\(30\)/i);
  assert.match(pgTapSql, /has_table\s*\(/i);
  assert.match(pgTapSql, /grant_id/i);
  assert.match(pgTapSql, /constraint_row\.contype\s*=\s*'p'/i);
  assert.match(pgTapSql, /auth_recovery_grants_jti_hash_length_check/i);
  assert.match(pgTapSql, /auth_recovery_grants_expires_after_created_check/i);
  assert.match(pgTapSql, /has_table_privilege\s*\(/i);
  assert.match(pgTapSql, /has_function_privilege\s*\(/i);
});

test("nowa migracja recovery jest warunkowa i nie wykonuje operacji zdalnych", () => {
  assert.equal(migrationFiles.length, 1);
  const sql = fs.readFileSync(path.join(migrationsDirectory, migrationFiles[0]), "utf8");

  assert.match(sql, /do \$\$/i);
  assert.match(sql, /information_schema\.columns|pg_catalog\.pg_attribute/i);
  assert.doesNotMatch(sql, /\b(?:curl|psql|https?:\/\/|supabase\s+(?:db|migration|link)|staging|production)\b/i);
});
