const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('Railway uses the Dockerfile deployment contract', async () => {
  const railway = JSON.parse(await readFile(path.join(root, 'railway.json'), 'utf8'));

  assert.equal(railway.$schema, 'https://railway.com/railway.schema.json');
  assert.deepEqual(railway.build, {
    builder: 'DOCKERFILE',
    dockerfilePath: 'deploy/railway/Dockerfile',
  });
  assert.deepEqual(railway.deploy, {
    startCommand: 'node server.js',
    healthcheckPath: '/health/ready',
    healthcheckTimeout: 300,
    restartPolicyType: 'ON_FAILURE',
    restartPolicyMaxRetries: 10,
    drainingSeconds: 10,
  });
});

test('Railway image is pinned and runs the minimal application as non-root', async () => {
  const dockerfile = await readFile(path.join(root, 'deploy/railway/Dockerfile'), 'utf8');
  const lines = dockerfile.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  assert.equal(
    lines[0],
    'FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd',
  );
  assert.ok(lines.includes('RUN npm ci --omit=dev'));
  assert.ok(lines.includes('ENV NODE_ENV=production HOST=0.0.0.0'));
  assert.ok(lines.includes('USER node'));
  assert.ok(lines.includes('CMD ["node", "server.js"]'));
  assert.ok(lines.includes('COPY data ./data'));
  assert.ok(lines.includes('COPY assets ./assets'));
  assert.doesNotMatch(dockerfile, /^\s*EXPOSE\b/m);
  assert.doesNotMatch(dockerfile, /\bPORT\s*=/);
  assert.doesNotMatch(dockerfile, /COPY[^\n]*\.env/);
  assert.equal(lines.at(-2), 'USER node');
});

test('package metadata pins Node 24 and exposes the Railway check', async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));

  assert.equal(packageJson.engines.node, '24.x');
  assert.equal(packageJson.scripts['railway:check'], 'node --test test/railway-config.test.js');
  assert.equal(packageLock.packages[''].engines.node, '24.x');
});
