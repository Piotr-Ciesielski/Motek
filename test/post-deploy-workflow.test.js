const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const workflowPath = path.join(root, '.github', 'workflows', 'post-deploy-regression.yml');
const ciPath = path.join(root, '.github', 'workflows', 'ci.yml');
const CHECKOUT_SHA = 'd23441a48e516b6c34aea4fa41551a30e30af803';
const SETUP_NODE_SHA = '48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('post-deploy workflow accepts only successful deployments from this repository for approved environment/ref pairs', () => {
  const workflow = read(workflowPath);

  assert.match(workflow, /^['"]on['"]:\s*\n\s+deployment_status:\s*$/m);
  assert.doesNotMatch(workflow, /\b(?:push|pull_request|pull_request_target|workflow_dispatch|schedule):/);
  assert.match(workflow, /github\.event\.deployment_status\.state == 'success'/);
  assert.match(workflow, /github\.event\.deployment\.repository_url == github\.event\.repository\.url/);
  assert.match(workflow, /contains\(github\.event\.deployment\.environment, ' \/ staging'\)\s*&&\s*github\.event\.deployment\.ref == github\.event\.deployment\.sha/);
  assert.match(workflow, /endsWith\(github\.event\.deployment\.environment, ' \/ production'\)\s*&&\s*github\.event\.deployment\.ref == github\.event\.deployment\.sha/);
});

test('post-deploy workflow uses least privilege, deployment SHA and environment-scoped inputs', () => {
  const workflow = read(workflowPath);

  assert.match(workflow, /^permissions:\s*\n\s+contents: read\s*$/m);
  assert.doesNotMatch(workflow, /^\s+[\w-]+: write\s*$/m);
  assert.match(workflow, /environment:\s*\$\{\{ contains\(github\.event\.deployment\.environment, ' \/ staging'\) && 'staging' \|\| 'production' \}\}/);
  assert.match(workflow, /concurrency:\s*\n\s+group: post-deploy-regression-\$\{\{ contains\(github\.event\.deployment\.environment, ' \/ staging'\) && 'staging' \|\| 'production' \}\}\s*\n\s+cancel-in-progress: true/);
  assert.match(workflow, new RegExp(`uses: actions/checkout@${CHECKOUT_SHA} # v6\\.1\\.0\\s*\\n\\s+with:\\s*\\n\\s+ref: \\$\\{\\{ github\\.event\\.deployment\\.sha \\}\\}`));
  assert.match(workflow, new RegExp(`uses: actions/setup-node@${SETUP_NODE_SHA} # v6\\.4\\.0\\s*\\n\\s+with:\\s*\\n\\s+node-version: 24`));
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /MOTEK_BASE_URL: \$\{\{ vars\.MOTEK_BASE_URL \}\}/);
  assert.match(workflow, /MOTEK_EXPECTED_SHA: \$\{\{ github\.event\.deployment\.sha \}\}/);
  assert.match(workflow, /MOTEK_ENVIRONMENT: \$\{\{ contains\(github\.event\.deployment\.environment, ' \/ staging'\) && 'staging' \|\| 'production' \}\}/);
});

test('post-deploy workflow runs full staging checks with QA secrets and smoke-only production checks', () => {
  const workflow = read(workflowPath);

  assert.match(workflow, /if: contains\(github\.event\.deployment\.environment, ' \/ staging'\)\s*\n\s+run: npm run regression:full\s*\n\s+env:\s*\n\s+MOTEK_QA_EMAIL: \$\{\{ secrets\.MOTEK_QA_EMAIL \}\}\s*\n\s+MOTEK_QA_PASSWORD: \$\{\{ secrets\.MOTEK_QA_PASSWORD \}\}/);
  assert.match(workflow, /if: endsWith\(github\.event\.deployment\.environment, ' \/ production'\)\s*\n\s+run: npm run regression:smoke/);
  assert.doesNotMatch(workflow, /(?:SUPABASE|RAILWAY|TURNSTILE)/i);
  assert.doesNotMatch(workflow, /run:[^\n]*\$\{\{/);
  assert.match(workflow, /timeout-minutes: 25\b/);
});

test('CI validates pushes to main and staging while pull requests remain limited to main', () => {
  const ci = read(ciPath);

  assert.match(ci, /push:\s*\n\s+branches: \[main, staging\]/);
  assert.match(ci, /pull_request:\s*\n\s+branches: \[main\]/);
  assert.match(ci, new RegExp(`uses: actions/checkout@${CHECKOUT_SHA} # v6\\.1\\.0`));
  assert.match(ci, new RegExp(`uses: actions/setup-node@${SETUP_NODE_SHA} # v6\\.4\\.0`));
  assert.doesNotMatch(`${ci}\n${read(workflowPath)}`, /uses: actions\/(?:checkout|setup-node)@v\d+/);
});
