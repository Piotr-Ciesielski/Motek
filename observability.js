const KNOWN_ROUTES = new Set([
  "/health",
  "/health/live",
  "/health/ready",
  "/api/config",
  "/api/auth/login",
  "/api/auth/register",
  "/api/yarns",
  "/api/matches",
  "/api/patterns",
]);
const BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5];
const KNOWN_METHODS = new Set(["GET", "POST", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function normalizeRouteLabel(method, pathname) {
  if (/^\/api\/yarns\/[^/]+$/.test(pathname)) return "/api/yarns/:id";
  if (KNOWN_ROUTES.has(pathname)) return pathname;
  if (method === "GET" && ["/", "/index.html", "/styles.css", "/app.js"].includes(pathname)) {
    return "/static";
  }
  return "/other";
}

function createMetricsRegistry() {
  const values = new Map();
  let readiness = 0;
  function observe({ method, pathname, statusCode, durationSeconds }) {
    const normalizedMethod = String(method).toUpperCase();
    const methodLabel = KNOWN_METHODS.has(normalizedMethod) ? normalizedMethod : "OTHER";
    const route = normalizeRouteLabel(methodLabel, pathname);
    const key = JSON.stringify([methodLabel, route, String(statusCode)]);
    const metric = values.get(key) || {
      count: 0,
      sum: 0,
      buckets: Array(BUCKETS.length).fill(0),
    };
    const duration = Number(durationSeconds) || 0;
    metric.count += 1;
    metric.sum += duration;
    BUCKETS.forEach((bucket, index) => {
      if (duration <= bucket) metric.buckets[index] += 1;
    });
    values.set(key, metric);
  }
  function renderPrometheus() {
    const lines = [
      "# HELP motek_http_requests_total Liczba odpowiedzi HTTP.",
      "# TYPE motek_http_requests_total counter",
      "# HELP motek_http_request_duration_seconds Czas odpowiedzi HTTP.",
      "# TYPE motek_http_request_duration_seconds histogram",
      "# HELP motek_readiness Czy zależności aplikacji są gotowe.",
      "# TYPE motek_readiness gauge",
      `motek_readiness ${readiness}`,
    ];
    for (const [key, metric] of values) {
      const [method, route, status] = JSON.parse(key);
      const labels = `method="${method}",route="${route}",status="${status}"`;
      lines.push(`motek_http_requests_total{${labels}} ${metric.count}`);
      BUCKETS.forEach((bucket, index) => {
        lines.push(
          `motek_http_request_duration_seconds_bucket{${labels},le="${bucket}"} ${metric.buckets[index]}`
        );
      });
      lines.push(`motek_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${metric.count}`);
      lines.push(`motek_http_request_duration_seconds_sum{${labels}} ${metric.sum}`);
      lines.push(`motek_http_request_duration_seconds_count{${labels}} ${metric.count}`);
    }
    return `${lines.join("\n")}\n`;
  }
  return {
    observe,
    renderPrometheus,
    setReadiness(ready) { readiness = ready ? 1 : 0; },
  };
}

module.exports = { createMetricsRegistry, normalizeRouteLabel };
