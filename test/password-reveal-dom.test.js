const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const { initializePasswordRevealControls } = require("../client-policy");

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
