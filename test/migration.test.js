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
const avatarMigrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260807093000_harden_profile_avatar_url.sql"
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

test("migracja ogranicza avatar_url do 2048 znaków", () => {
  const sql = fs.readFileSync(avatarMigrationPath, "utf8");

  assert.match(
    sql,
    /check \(avatar_url is null or char_length\(avatar_url\) <= 2048\)/i
  );
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

test("migracja katalogu dodaje fail-closed publikację wzorów", () => {
  const migrationFiles = fs
    .readdirSync(path.join(__dirname, "..", "supabase", "migrations"))
    .filter((file) => file.endsWith("_add_pattern_publication_audit.sql"));

  assert.equal(migrationFiles.length, 1);
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", migrationFiles[0]),
    "utf8"
  );

  assert.match(sql, /alter column description drop not null/i);
  assert.match(sql, /publication_status\s+text\s+not null\s+default\s+'pending_review'/i);
  assert.match(sql, /content_audit_version\s+text/i);
  assert.match(sql, /content_audited_at\s+timestamptz/i);
  assert.match(sql, /official_source_url\s+text/i);
  assert.match(sql, /publication_status in \('pending_review', 'published', 'hidden'\)/i);
  assert.match(sql, /patterns_published_audit_check/i);
  assert.match(sql, /publication_status <> 'published'/i);
  assert.match(sql, /content_audit_version is not null/i);
  assert.match(sql, /content_audited_at is not null/i);
});

test("migracja rejestracji zaproszonej chroni prywatne dane i stan profilu", () => {
  const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith("_add_invited_registration_and_legal_acceptance.sql"));

  assert.equal(migrationFiles.length, 1);
  const sql = fs.readFileSync(path.join(migrationsDirectory, migrationFiles[0]), "utf8");

  assert.match(sql, /create table private\.legal_document_versions/i);
  assert.match(sql, /create table private\.registration_invitations/i);
  assert.match(sql, /create table private\.registration_attempts/i);
  assert.match(sql, /create table private\.terms_acceptances/i);
  assert.match(sql, /create table private\.privacy_notice_deliveries/i);
  assert.match(sql, /on delete cascade/i);
  assert.match(sql, /primary key \(user_id, terms_version\)/i);
  assert.match(sql, /accepted_at timestamptz not null default now\(\)/i);
  assert.match(sql, /legal_document_one_current_per_kind/i);
  assert.match(sql, /registration_invitations.*\(email\)/is);
  assert.match(sql, /registration_invitations.*\(expires_at\)/is);
  assert.match(sql, /registration_attempts.*\(auth_user_id\)/is);
  assert.match(sql, /pending_registration/i);
  assert.match(sql, /revoke all on all tables in schema private from public, anon, authenticated/i);
});

test("migracja automatycznej rejestracji aktywuje profil i zapisuje zgody", () => {
  const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");
  const sql = fs.readFileSync(
    path.join(migrationsDirectory, "20260822170000_finalize_automatic_registration.sql"),
    "utf8",
  );

  assert.match(sql, /create or replace function public\.finalize_automatic_registration/i);
  assert.match(sql, /status not in \('pending_registration', 'active'\)/i);
  assert.match(sql, /insert into private\.terms_acceptances/i);
  assert.match(sql, /insert into private\.privacy_notice_deliveries/i);
  assert.match(sql, /set status = 'active'/i);
  assert.match(sql, /revoke execute on function public\.finalize_automatic_registration/i);
  assert.match(sql, /grant execute on function public\.finalize_automatic_registration.*service_role/i);
});

test("migracja bramki regulaminu chroni prywatne dane i RPC magazynu", () => {
  const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith("_enforce_current_terms_for_private_data.sql"));

  assert.equal(migrationFiles.length, 1);
  const sql = fs.readFileSync(path.join(migrationsDirectory, migrationFiles[0]), "utf8");

  assert.match(sql, /create or replace function public\.has_current_terms_acceptance\(\)/i);
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.has_current_terms_acceptance\(\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.has_current_terms_acceptance\(\) to authenticated/i);
  assert.match(sql, /profiles_select_own[\s\S]*has_current_terms_acceptance\(\)/i);
  assert.match(sql, /yarns_delete_own[\s\S]*has_current_terms_acceptance\(\)/i);
  assert.match(sql, /drop function if exists public\.insert_yarn_with_limit/i);

  for (const rpcName of [
    "get_yarn_store_version",
    "insert_yarn_versioned",
    "update_yarn_versioned",
    "delete_yarn_versioned",
  ]) {
    const definition = sql.match(
      new RegExp(`create or replace function public\\.${rpcName}[\\s\\S]*?\\n\\$\\$;`, "i")
    )?.[0];

    assert.ok(definition, `${rpcName} jest zdefiniowana w migracji`);
    assert.match(definition, /private\.yarn_store_versions/i);
    assert.match(definition, /has_current_terms_acceptance\(\)/i);
    assert.match(definition, /42501/i);
  }

  assert.doesNotMatch(sql, /create or replace function public\.insert_yarn_with_limit/i);
});

test("migracja zaproszeń udostępnia revoke wyłącznie service_role", () => {
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260810123000_revoke_registration_invitation.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(sql, /create or replace function public\.revoke_registration_invitation\(\s*p_invitation_id uuid\s*\)/i);
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /used_at is null[\s\S]*revoked_at is null[\s\S]*reservation_id is null/i);
  assert.match(sql, /revoke all on function public\.revoke_registration_invitation\(uuid\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.revoke_registration_invitation\(uuid\) to service_role/i);
  assert.match(sql, /create or replace function public\.create_registration_invitation\(\s*p_email text,\s*p_token_hash text,\s*p_expires_at timestamptz\s*\)/i);
  assert.match(sql, /revoke all on function public\.create_registration_invitation\(text, text, timestamptz\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.create_registration_invitation\(text, text, timestamptz\) to service_role/i);
});

test("produkcyjny pakiet katalogu zachowuje description NOT NULL i zatrzymuje się na stagingowych NULL-ach", () => {
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "production-deltas",
    "20260816_add_pattern_publication_audit_compatible.sql",
  );
  assert.ok(fs.existsSync(migrationPath), "produkcyjny pakiet migracyjny istnieje");

  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(sql, /PRODUCTION-ONLY/i);
  assert.match(sql, /add column if not exists publication_status text/i);
  assert.match(sql, /default 'pending_review'/i);
  assert.match(sql, /content_audit_version text/i);
  assert.match(sql, /content_audited_at timestamptz/i);
  assert.match(sql, /official_source_url text/i);
  assert.match(sql, /description is null[\s\S]*raise exception/i);
  assert.match(sql, /alter column description set not null/i);
  assert.match(sql, /patterns_publication_status_check/i);
  assert.match(sql, /patterns_published_audit_check/i);
  assert.doesNotMatch(sql, /description\s+drop\s+not\s+null/i);
});
