const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
);

test('test:db uses the local Supabase CLI in the required order', () => {
  assert.equal(
    packageJson.scripts['test:db'],
    [
      'node node_modules/supabase/dist/supabase.js start',
      'node node_modules/supabase/dist/supabase.js db reset --local',
      'node node_modules/supabase/dist/supabase.js test db --local',
    ].join(' && '),
  );
});

test('database test suite contains the required replay and recovery tests', () => {
  const databaseTestsDirectory = path.join(projectRoot, 'supabase', 'tests', 'database');

  assert.ok(fs.statSync(databaseTestsDirectory).isDirectory());
  assert.ok(fs.existsSync(path.join(databaseTestsDirectory, 'migration_replay.test.sql')));
  assert.ok(fs.existsSync(path.join(databaseTestsDirectory, 'auth_recovery_grants.test.sql')));
});
