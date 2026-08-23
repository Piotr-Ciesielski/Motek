const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = process.env.CODEX_AGENT_CONFIG_ROOT || path.resolve(__dirname, '..');

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

test('Codex enables exactly three concurrent Motek subagents and context limits', () => {
  const config = readProjectFile('.codex/config.toml');

  assert.match(config, /^\[agents\]$/m);
  assert.match(config, /^enabled = true$/m);
  assert.match(config, /^max_concurrent_threads_per_session = 3$/m);
  assert.match(config, /^project_doc_max_bytes = 12000$/m);
  assert.match(config, /^tool_output_token_limit = 6000$/m);
  assert.equal((config.match(/^\[\[skills\.config\]\]$/gm) || []).length, 36);
  assert.match(config, /superpowers\/6\.3\.0\/skills\/test-driven-development\/SKILL\.md/);
  assert.match(config, /product-design\/0\.1\.52\/skills\/audit\/SKILL\.md/);
  assert.match(config, /skills\/\.system\/imagegen\/SKILL\.md/);
  assert.equal((config.match(/^enabled = false$/gm) || []).length, 36);
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

test('AGENTS.md documents the canonical Motek workflow and safeguards', () => {
  const instructions = readProjectFile('AGENTS.md');

  assert.equal(fs.existsSync(path.join(root, 'AGENTS.override.md')), false);
  assert.match(instructions, /^## Zespół subagentów Motka$/m);
  assert.match(instructions, /`motek_explorer`/);
  assert.match(instructions, /`motek_worker`/);
  assert.match(instructions, /`motek_reviewer`/);
  assert.match(instructions, /analityk.*wykonawca.*recenzent/is);
  assert.match(instructions, /operacje zewnętrzne.*zgod/is);
  assert.match(instructions, /`motek_explorer`[^\n]*tylko do odczytu/i);
  assert.match(instructions, /`motek_reviewer`[^\n]*tylko do odczytu/i);
  assert.match(instructions, /niezależne prace tylko do odczytu mogą działać równolegle/i);
  assert.match(instructions, /zapisy mogą być równoległe wyłącznie gdy zakresy plików są jawnie rozłączne/i);
  assert.match(instructions, /nigdy nie zlecaj równoległych zapisów do tych samych plików/i);
  assert.match(instructions, /uwagi recenzenta.*tego samego wykonawcy.*ponownej recenzji/is);
  assert.match(instructions, /wcześniejszej zgody użytkownika/i);
  assert.match(instructions, /^## Bezpieczny commit i GitHub$/m);
  assert.match(instructions, /Zapisać commit i wysłać go do GitHub\?/);
  assert.match(instructions, /zatwierdzi wyłącznie commit.*bez pushu/i);
  assert.match(instructions, /zachować zmiany lokalnie.*nie publikuj/i);
  assert.match(instructions, /bez.*force/i);
  assert.match(
    instructions,
    /przed delegowaniem.*najbezpieczniejszy.*tryb uprawnień sesji nadrzędnej/is,
  );
  assert.match(
    instructions,
    /nigdy nie deleguj.*Full Access.*Yolo.*równoważn.*nieograniczon/is,
  );
  assert.match(
    instructions,
    /nie włączaj.*sieci.*aplikacji.*connectorów.*integracji zewnętrznych.*konkretnej wcześniejszej zgody użytkownika/is,
  );
  assert.match(
    instructions,
    /nadrzędne ustawienia runtime.*sandbox_mode.*workspace-write.*instrukcją behawioralną.*twardą granicą techniczną/is,
  );
  assert.match(
    instructions,
    /preferuj.*tylko do odczytu.*workspace-write.*etapu implementacji.*motek_worker/is,
  );
  assert.match(
    instructions,
    /co najmniej dwie niezależne części.*niezależna recenzja istotnie zmniejsza ryzyko/is,
  );
  assert.match(
    instructions,
    /proste, jednoplikowe zadania o niskim ryzyku.*bez uruchamiania pełnego zespołu/is,
  );
  assert.match(instructions, /reprodukcj[ęa].*test.*przed zmianą zachowania/is);
  assert.match(instructions, /Dla SQL, Auth lub RLS wymagaj testów bazy danych/i);
  assert.match(instructions, /git diff --check/i);
  assert.match(instructions, /nie mieszaj cudzych zmian/i);
});
