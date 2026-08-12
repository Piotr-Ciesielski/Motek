const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { getClientAddress } = require("../server");

test("ufa pierwszemu X-Forwarded-For wyłącznie w trybie zaufanego proxy", () => {
  const req = {
    headers: { "x-forwarded-for": "203.0.113.8, 172.20.0.4" },
    socket: { remoteAddress: "172.20.0.4" },
  };
  assert.equal(getClientAddress(req, { TRUST_PROXY: "true" }), "203.0.113.8");
  assert.equal(getClientAddress(req, { TRUST_PROXY: "false" }), "172.20.0.4");
});

test("odrzuca sfałszowany lub niepoprawny nagłówek adresu", () => {
  const req = {
    headers: { "x-forwarded-for": "not-an-ip" },
    socket: { remoteAddress: "::ffff:127.0.0.1" },
  };
  assert.equal(getClientAddress(req, { TRUST_PROXY: "true" }), "127.0.0.1");
});

test("zaufany WAF nadpisuje X-Forwarded-For zamiast dopisywać nagłówek klienta", () => {
  const nginx = fs.readFileSync(
    path.join(__dirname, "..", "deploy", "staging", "nginx", "templates", "default.conf.template"),
    "utf8",
  );
  const forwardedFor = nginx.match(/proxy_set_header X-Forwarded-For \$remote_addr;/g) || [];

  assert.equal(forwardedFor.length, 5);
  assert.doesNotMatch(nginx, /\$proxy_add_x_forwarded_for/);
});
