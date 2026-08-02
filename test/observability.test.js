const test = require("node:test");
const assert = require("node:assert/strict");
const { createMetricsRegistry, normalizeRouteLabel } = require("../observability");

test("normalizuje dynamiczne trasy bez danych użytkownika", () => {
  assert.equal(normalizeRouteLabel("PATCH", "/api/yarns/123"), "/api/yarns/:id");
  assert.equal(normalizeRouteLabel("GET", "/unknown/value"), "/other");
});

test("eksportuje liczbę i czas żądań w formacie Prometheus", () => {
  const metrics = createMetricsRegistry();
  metrics.setReadiness(false);
  metrics.observe({ method: "GET", pathname: "/health", statusCode: 200, durationSeconds: 0.01 });
  const output = metrics.renderPrometheus();
  assert.match(output, /motek_http_requests_total\{method="GET",route="\/health",status="200"\} 1/);
  assert.match(output, /motek_http_request_duration_seconds_sum/);
  assert.match(output, /motek_readiness 0/);
  assert.doesNotMatch(output, /email|token|supabase/i);
});

test("ogranicza etykiety metod i przechowuje tylko stałe liczniki histogramu", () => {
  const metrics = createMetricsRegistry();
  for (let index = 0; index < 10_000; index += 1) {
    metrics.observe({
      method: "CUSTOM-METHOD",
      pathname: "/unknown/value",
      statusCode: 418,
      durationSeconds: 0.2,
    });
  }
  const output = metrics.renderPrometheus();
  assert.match(output, /method="OTHER",route="\/other",status="418"\} 10000/);
  assert.match(output, /le="0.25"\} 10000/);
  assert.doesNotMatch(output, /CUSTOM-METHOD/);
});
