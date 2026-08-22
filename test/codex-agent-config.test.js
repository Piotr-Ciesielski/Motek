const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readDeveloperInstructions(config) {
  const match = config.match(/^developer_instructions = """([\s\S]+?)"""$/m);

  assert.ok(match, 'developer_instructions must be a non-empty multiline string');
  return match[1];
}

const agents = [
  {
    file: '.codex/agents/motek-explorer.toml',
    name: 'motek_explorer',
    sandboxMode: 'read-only',
  },
  {
    file: '.codex/agents/motek-worker.toml',
    name: 'motek_worker',
    sandboxMode: 'workspace-write',
  },
  {
    file: '.codex/agents/motek-reviewer.toml',
    name: 'motek_reviewer',
    sandboxMode: 'read-only',
  },
];

test('Codex enables exactly three concurrent Motek subagents', () => {
  const config = readProjectFile('.codex/config.toml');

  assert.match(config, /^\[agents\]$/m);
  assert.match(config, /^enabled = true$/m);
  assert.match(config, /^max_concurrent_threads_per_session = 3$/m);
});

for (const agent of agents) {
  test(`${agent.name} declares the required identity and intended access mode`, () => {
    const config = readProjectFile(agent.file);
    const instructions = readDeveloperInstructions(config);

    assert.match(config, new RegExp(`^name = "${agent.name}"$`, 'm'));
    assert.match(config, /^description = ".+"$/m);
    assert.match(config, new RegExp(`^sandbox_mode = "${agent.sandboxMode}"$`, 'm'));
    assert.match(instructions, /nie odczytuj \.env, tokenów, kluczy ani ciasteczek\./i);
    assert.match(instructions, /nie wykonuj operacji zewnętrznych\./i);
    assert.match(instructions, /nie twórz commitów\./i);
    assert.doesNotMatch(config, /^\s*model\s*=/m);
    assert.doesNotMatch(config, /^\s*model_reasoning_effort\s*=/m);

    if (agent.name === 'motek_explorer') {
      assert.match(
        instructions,
        /prześledź tylko warstwy rzeczywiście związane z przekazanym przepływem/i,
      );
      assert.match(
        instructions,
        /frontend.*server\.js.*\*-policy\.js.*Supabase.*migracje.*testy.*tylko wtedy, gdy istnieje rzeczywista zależność/is,
      );
    }
  });
}
