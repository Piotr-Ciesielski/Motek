const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const serverJs = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

test("formularz zmiany hasła ma komplet pól i ochronę CAPTCHA", () => {
  assert.match(indexHtml, /id="changePasswordForm"/);
  assert.match(indexHtml, /name="currentPassword"/);
  assert.match(indexHtml, /name="password"/);
  assert.match(indexHtml, /name="passwordConfirmation"/);
  assert.match(indexHtml, /data-turnstile-for="passwordChange"/);
  assert.match(indexHtml, /data-password-reveal="change-current-password"/);
  assert.match(indexHtml, /data-password-reveal="change-password"/);
  assert.match(indexHtml, /data-password-reveal="change-password-confirmation"/);
});

test("klient wysyła zmianę hasła do dedykowanego endpointu i kończy sesję", () => {
  assert.match(appJs, /api\("\/api\/auth\/password\/change"/);
  assert.match(appJs, /currentPassword: body\.currentPassword/);
  assert.match(appJs, /password: body\.password/);
  assert.match(appJs, /renderAuthState\(\{ authenticated: false \}\)/);
});

test("backend weryfikuje bieżące hasło, używa sesji odświeżającej i wylogowuje globalnie", () => {
  assert.match(serverJs, /url\.pathname === "\/api\/auth\/password\/change"/);
  assert.match(serverJs, /authRequestRateLimiters\["password-change"\]/);
  assert.match(serverJs, /auth\.signInWithPassword\(\{[\s\S]*?password: currentPassword/);
  assert.match(serverJs, /refresh_token: session\.refreshToken/);
  assert.match(serverJs, /auth\.updateUser\(\{ current_password: currentPassword, password \}\)/);
  assert.match(serverJs, /auth\.signOut\(\{ scope: "global" \}\)/);
  assert.match(serverJs, /refreshToken: activeRefreshToken/);
  assert.match(serverJs, /"password-change": \{/);
});
