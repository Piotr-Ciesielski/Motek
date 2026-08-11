const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const { createLegalAcceptanceController } = require("../client/legal-acceptance-controller");
const { CURRENT_LEGAL_DOCUMENT } = require("../legal-document");

function createFixture() {
  const dom = new JSDOM(`
    <section id="gate">
      <output id="version"></output>
      <form id="form">
        <input name="termsAccepted" type="checkbox" required>
        <button type="submit">Akceptuję</button>
      </form>
      <p id="message" role="status"></p>
    </section>
  `);
  const document = dom.window.document;
  return {
    dom,
    form: document.getElementById("form"),
    gate: document.getElementById("gate"),
    message: document.getElementById("message"),
    versionOutput: document.getElementById("version"),
  };
}

test("pokazuje gate tylko dla nieaktualnej akceptacji", () => {
  const fixture = createFixture();
  const controller = createLegalAcceptanceController({
    ...fixture,
    request: async () => ({}),
    legalDocument: CURRENT_LEGAL_DOCUMENT,
  });

  assert.equal(controller.setSessionLegalState({
    currentVersion: "1.0",
    acceptedVersion: "1.0",
    acceptanceRequired: false,
  }), false);
  assert.equal(fixture.gate.hidden, true);

  assert.equal(controller.setSessionLegalState({
    currentVersion: "1.0",
    acceptedVersion: "0.9",
    acceptanceRequired: true,
  }), true);
  assert.equal(fixture.gate.hidden, false);
  assert.equal(fixture.versionOutput.textContent, "1.0");
  fixture.dom.window.close();
});

test("wysyła wyłącznie bieżącą wersję dokumentu", async () => {
  const fixture = createFixture();
  const calls = [];
  const controller = createLegalAcceptanceController({
    ...fixture,
    request: async (path, options) => {
      calls.push({ path, options });
      return { acceptedVersion: "1.0" };
    },
    legalDocument: CURRENT_LEGAL_DOCUMENT,
  });
  controller.setSessionLegalState({ acceptanceRequired: true, acceptedVersion: null });
  fixture.form.elements.termsAccepted.checked = true;

  await controller.submit({ preventDefault() {} });

  assert.deepEqual(calls, [{
    path: "/api/legal/acceptance",
    options: {
      method: "POST",
      body: JSON.stringify({ version: "1.0" }),
    },
  }]);
  fixture.dom.window.close();
});

test("nie wywołuje onAccepted po odpowiedzi błędnej", async () => {
  const fixture = createFixture();
  let accepted = 0;
  const controller = createLegalAcceptanceController({
    ...fixture,
    request: async () => { throw new Error("Nie udało się zapisać akceptacji."); },
    legalDocument: CURRENT_LEGAL_DOCUMENT,
    onAccepted: () => { accepted += 1; },
  });
  controller.setSessionLegalState({ acceptanceRequired: true, acceptedVersion: null });
  fixture.form.elements.termsAccepted.checked = true;

  await controller.submit({ preventDefault() {} });

  assert.equal(accepted, 0);
  assert.equal(fixture.gate.hidden, false);
  assert.equal(fixture.message.textContent, "Nie udało się zapisać akceptacji.");
  fixture.dom.window.close();
});

test("po sukcesie ukrywa błąd i wywołuje onAccepted", async () => {
  const fixture = createFixture();
  let accepted = 0;
  const controller = createLegalAcceptanceController({
    ...fixture,
    request: async () => ({}),
    legalDocument: CURRENT_LEGAL_DOCUMENT,
    onAccepted: () => { accepted += 1; },
  });
  controller.setSessionLegalState({ acceptanceRequired: true, acceptedVersion: null });
  fixture.message.textContent = "Poprzedni błąd";
  fixture.form.elements.termsAccepted.checked = true;

  await controller.submit({ preventDefault() {} });

  assert.equal(accepted, 1);
  assert.equal(fixture.gate.hidden, true);
  assert.equal(fixture.message.textContent, "");
  fixture.dom.window.close();
});

test("nie ukrywa gate, gdy odświeżenie sesji po zapisie się nie uda", async () => {
  const fixture = createFixture();
  const controller = createLegalAcceptanceController({
    ...fixture,
    request: async () => ({}),
    legalDocument: CURRENT_LEGAL_DOCUMENT,
    onAccepted: async () => { throw new Error("Sesja jest chwilowo niedostępna."); },
  });
  controller.setSessionLegalState({ acceptanceRequired: true, acceptedVersion: null });
  fixture.form.elements.termsAccepted.checked = true;

  await controller.submit({ preventDefault() {} });

  assert.equal(fixture.gate.hidden, false);
  assert.equal(fixture.message.textContent, "Sesja jest chwilowo niedostępna.");
  fixture.dom.window.close();
});
