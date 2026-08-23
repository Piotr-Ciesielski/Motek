const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const { initializePasswordRevealControls } = require("../client-policy");
const { createAuthController } = require("../client/auth-controller");

test("inicjalizacja kontrolek pokazuje hasło tylko podczas przytrzymania", () => {
  const dom = new JSDOM(`
    <input id="account-delete-password" type="password">
    <button data-password-reveal="account-delete-password" aria-pressed="false"></button>
  `);
  const { document, window } = dom.window;
  const input = document.getElementById("account-delete-password");
  const button = document.querySelector("[data-password-reveal]");

  initializePasswordRevealControls(document);

  button.dispatchEvent(new window.Event("pointerdown"));
  assert.equal(input.type, "text");
  button.dispatchEvent(new window.Event("pointerup"));
  assert.equal(input.type, "password");
  assert.equal(button.getAttribute("aria-pressed"), "false");

  button.dispatchEvent(new window.Event("pointerdown"));
  button.dispatchEvent(new window.Event("pointerleave"));
  assert.equal(input.type, "password");

  button.dispatchEvent(new window.Event("pointerdown"));
  button.dispatchEvent(new window.Event("blur"));
  assert.equal(input.type, "password");
});

test("formularz odzyskiwania resetuje CAPTCHA po udanej próbie", async () => {
  const dom = new JSDOM(`
    <form><input name="email" value="jan@example.test"><button type="submit">Wyślij</button></form>
  `);
  const form = dom.window.document.querySelector("form");
  let captchaToken = "token-przed-wysłaniem";
  const resetCalls = [];
  const controller = createAuthController({ passwordResetForm: form }, {
    request: async (path, options) => {
      assert.equal(path, "/api/auth/password-reset-request");
      assert.deepEqual(JSON.parse(options.body), { email: "jan@example.test", captchaToken });
      return { message: "Instrukcja wysłana." };
    },
  }, () => {}, {
    getPayload: () => ({ email: "jan@example.test", captchaToken }),
    onPasswordResetFinally: () => {
      captchaToken = null;
      resetCalls.push("widget");
    },
  });

  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(captchaToken, null);
  assert.deepEqual(resetCalls, ["widget"]);
  assert.equal(controller.getState().loading, false);
});
