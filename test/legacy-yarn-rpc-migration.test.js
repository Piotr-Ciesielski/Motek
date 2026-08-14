import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationName = "20260814173829_remove_legacy_yarn_rpc.sql";
const migrationPath = path.join(
  import.meta.dirname,
  "..",
  "supabase",
  "migrations",
  migrationName,
);

test("legacy yarn RPC cleanup is a narrow forward-only migration", () => {
  assert.equal(fs.existsSync(migrationPath), true);

  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    sql,
    /drop function if exists public\.insert_yarn_with_limit\(\s*text,\s*text,\s*text,\s*text,\s*integer,\s*integer\s*\);/i,
  );
  assert.match(
    sql,
    /drop function if exists public\.insert_yarn_with_limit\(\s*text,\s*text,\s*text\[\],\s*text,\s*integer,\s*integer\s*\);/i,
  );
  assert.doesNotMatch(sql, /drop table|drop column|cascade/i);
  assert.equal((sql.match(/drop function/gi) ?? []).length, 2);
  assert.doesNotMatch(sql, /\b(grant|revoke)\b/i);
  assert.doesNotMatch(
    sql,
    /create(?: or replace)? function public\.insert_yarn_with_limit/i,
  );
});
