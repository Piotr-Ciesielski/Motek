const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "deploy", "staging");

test("staging publikuje wyłącznie WAF i używa nieruchomych obrazów", () => {
  const compose = fs.readFileSync(path.join(root, "compose.yaml"), "utf8");
  const dashboard = fs.readFileSync(path.join(root, "compose.dashboard.yaml"), "utf8");
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  assert.match(dockerfile, /node:24\.18\.0-alpine/);
  assert.match(compose, /owasp\/modsecurity-crs@sha256:2051ff18b836c1d9bbc5c7754451c1687ea27352e497b89d0c9fc7e657861e07/);
  assert.match(compose, /prom\/prometheus@sha256:69f5241418838263316593f7274a304b095c40bcf22e57272865da91bd60a8ac/);
  const dashboardCompose = fs.readFileSync(path.join(root, "compose.dashboard.yaml"), "utf8");
  assert.match(dashboardCompose, /grafana\/grafana@sha256:121a7a9ece6dc10b969f1f96eed64b4f07dfac0d0b8abc070f7cb83bbde86f63/);
  assert.doesNotMatch(compose, /:latest|:rolling/);
  assert.match(compose, /waf:[\s\S]*ports:[\s\S]*"443:8443"/);
  assert.doesNotMatch(compose, /3000:3000|9090:9090/);
  assert.match(compose, /CAPTCHA_ENABLED: "true"/);
  assert.match(compose, /METRICS_ENABLED: "true"/);
  assert.match(compose, /TRUST_PROXY: "true"/);
  assert.match(compose, /ALLOWED_METHODS: "GET HEAD POST OPTIONS PATCH DELETE"/);
  assert.match(compose, /\/etc\/modsecurity\.d\/owasp-crs\/rules\/REQUEST-900/);
  assert.match(compose, /app:[\s\S]*networks:[\s\S]*- private[\s\S]*- egress/);
  assert.match(compose, /cpus: "[0-9.]+"/);
  assert.match(compose, /memory: [0-9]+M/);
  assert.doesNotMatch(
    `${compose}\n${dashboard}`,
    /^\s*image:\s+\S*:(?:latest|rolling|edge|canary|stable|main|master)\s*$/im,
  );
  const serviceBlock = (name) => {
    const match = compose.match(new RegExp(`\\n  ${name}:[\\s\\S]*?(?=\\n  \\w+:|\\nnetworks:|\\nvolumes:)`));
    return match ? match[0] : "";
  };
  assert.doesNotMatch(serviceBlock("app"), /\n\s+ports:/);
  assert.doesNotMatch(serviceBlock("prometheus"), /\n\s+ports:/);
  assert.match(compose, /private:\s*\n\s+internal: true/);
});

test("CI przypina Supabase CLI do pełnego SHA", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "ci.yml"), "utf8");
  assert.match(workflow, /uses:\s*supabase\/setup-cli@ab058987d8d6c725971f6cf9d0b5c98467e30bd1\b/);
  assert.doesNotMatch(workflow, /uses:\s*supabase\/setup-cli@v\d+/);
});

test("proxy blokuje publiczne metryki i Prometheus używa sieci wewnętrznej", () => {
  const nginx = fs.readFileSync(path.join(root, "nginx", "templates", "default.conf.template"), "utf8");
  const prometheus = fs.readFileSync(path.join(root, "prometheus", "prometheus.yml"), "utf8");
  assert.match(nginx, /location = \/internal\/metrics[\s\S]*deny all/);
  assert.match(nginx, /client_max_body_size 16k/);
  assert.match(nginx, /limit_req_zone/);
  assert.match(nginx, /limit_conn_zone/);
  assert.match(nginx, /login\|register\|password-reset-request/);
  assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr/);
  assert.doesNotMatch(nginx, /\$proxy_add_x_forwarded_for/);
  assert.match(prometheus, /app:3000/);
  assert.match(prometheus, /\/internal\/metrics/);
});

test("CI przypina Supabase CLI do zweryfikowanego pełnego SHA", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "ci.yml"), "utf8");
  assert.match(
    workflow,
    /uses:\s+supabase\/setup-cli@46f7f98c7f948ad727d22c1e67fab04c223a0520\s+#\s*v3/,
  );
});
