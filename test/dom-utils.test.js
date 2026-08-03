const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const { setMessage, clearMessage } = require("../client/dom-utils");

test("eksportuje narzędzia jako MotekDomUtils w przeglądarce", () => {
  const source = fs.readFileSync(require.resolve("../client/dom-utils"), "utf8");
  const window = {};
  vm.runInNewContext(source, { window });
  assert.equal(typeof window.MotekDomUtils.setMessage, "function");
  assert.equal(typeof window.MotekDomUtils.clearMessage, "function");
});

function createElement() {
  const dom = new JSDOM('<div id="message"><span>stare</span></div>');
  return dom.window.document.getElementById("message");
}

test("setMessage renderuje tekst, status i akcje z zachowaniem dostępności", () => {
  const element = createElement();
  let clicked = false;

  setMessage(element, {
    text: "Gotowe",
    kind: "error",
    actions: [{ label: "Spróbuj ponownie", primary: true, onClick: () => { clicked = true; } }],
  });

  assert.equal(element.dataset.kind, "error");
  assert.equal(element.getAttribute("role"), "alert");
  assert.equal(element.getAttribute("aria-live"), "assertive");
  assert.equal(element.querySelector("p").textContent, "Gotowe");
  const button = element.querySelector("button");
  assert.equal(button.textContent, "Spróbuj ponownie");
  assert.match(button.className, /button(?!.*ghost)/);
  button.click();
  assert.equal(clicked, true);
});

test("setMessage czyści poprzednią treść i bezpiecznie ustawia pusty status", () => {
  const element = createElement();
  setMessage(element, { text: "", kind: "status" });

  assert.equal(element.childElementCount, 0);
  assert.equal(element.dataset.kind, "status");
  assert.equal(element.getAttribute("role"), "status");
  assert.equal(element.getAttribute("aria-live"), "polite");
});

test("clearMessage usuwa treść i atrybut rodzaju komunikatu", () => {
  const element = createElement();
  setMessage(element, { text: "Błąd", kind: "error" });
  clearMessage(element);

  assert.equal(element.childElementCount, 0);
  assert.equal(element.dataset.kind, undefined);
  assert.equal(element.getAttribute("role"), null);
  assert.equal(element.getAttribute("aria-live"), null);
});
