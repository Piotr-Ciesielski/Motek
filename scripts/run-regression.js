'use strict';

const { waitForRelease } = require('./regression/wait-for-release');
const { runPublicRegression } = require('./regression/public-suite');
const { runAuthenticatedRegression } = require('./regression/authenticated-suite');

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DUMMY_CAPTCHA_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function loadConfig(profile, env = process.env) {
  requireCondition(profile === 'smoke' || profile === 'full', 'Regression profile must be smoke or full');
  const baseUrl = env.MOTEK_BASE_URL;
  const expectedSha = env.MOTEK_EXPECTED_SHA;
  const environment = env.MOTEK_ENVIRONMENT;
  requireCondition(typeof baseUrl === 'string' && baseUrl.trim(), 'MOTEK_BASE_URL is required');
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error('MOTEK_BASE_URL must be a valid URL');
  }
  requireCondition(parsedUrl.protocol === 'https:' || (parsedUrl.protocol === 'http:' && parsedUrl.hostname === 'localhost'), 'MOTEK_BASE_URL must use HTTPS');
  requireCondition(!parsedUrl.username && !parsedUrl.password, 'MOTEK_BASE_URL must not contain credentials');
  requireCondition(SHA_PATTERN.test(String(expectedSha || '')), 'MOTEK_EXPECTED_SHA must contain 40 lowercase hexadecimal characters');
  requireCondition(environment === 'staging' || environment === 'production', 'MOTEK_ENVIRONMENT must be staging or production');

  const config = { profile, baseUrl: parsedUrl.origin, expectedSha, environment };
  if (profile === 'full') {
    requireCondition(environment === 'staging', 'Full regression is allowed only for staging');
    requireCondition(typeof env.MOTEK_QA_EMAIL === 'string' && env.MOTEK_QA_EMAIL.trim(), 'MOTEK_QA_EMAIL is required for full regression');
    requireCondition(typeof env.MOTEK_QA_PASSWORD === 'string' && env.MOTEK_QA_PASSWORD, 'MOTEK_QA_PASSWORD is required for full regression');
    config.email = env.MOTEK_QA_EMAIL;
    config.password = env.MOTEK_QA_PASSWORD;
    config.captchaToken = DUMMY_CAPTCHA_TOKEN;
  }
  return config;
}

function validateConfig(config) {
  const env = {
    MOTEK_BASE_URL: config?.baseUrl,
    MOTEK_EXPECTED_SHA: config?.expectedSha,
    MOTEK_ENVIRONMENT: config?.environment,
    MOTEK_QA_EMAIL: config?.email,
    MOTEK_QA_PASSWORD: config?.password,
  };
  return loadConfig(config?.profile, env);
}

async function runRegression(config, dependencies = {}) {
  const validated = validateConfig(config);
  const wait = dependencies.waitForRelease || waitForRelease;
  const runPublic = dependencies.runPublicRegression || runPublicRegression;
  const runAuthenticated = dependencies.runAuthenticatedRegression || runAuthenticatedRegression;
  const createRunId = dependencies.createRunId || (() => `release-${validated.expectedSha.slice(0, 12)}`);

  await wait({
    baseUrl: validated.baseUrl,
    expectedSha: validated.expectedSha,
    expectedEnvironment: validated.environment,
  });
  await runPublic({
    baseUrl: validated.baseUrl,
    expectedSha: validated.expectedSha,
    expectedEnvironment: validated.environment,
    apexUrl: validated.profile === 'smoke' && validated.environment === 'production' ? 'https://rysia.org' : undefined,
  });
  if (validated.profile === 'full') {
    await runAuthenticated({
      baseUrl: validated.baseUrl,
      email: validated.email,
      password: validated.password,
      captchaToken: validated.captchaToken,
      runId: createRunId(),
    });
  }
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const config = loadConfig(argv[0], env);
  await runRegression(config);
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write('Regression run failed. Check the sanitized test output and configuration.\n');
    process.exitCode = 1;
  });
}

module.exports = { DUMMY_CAPTCHA_TOKEN, loadConfig, runRegression, main };
