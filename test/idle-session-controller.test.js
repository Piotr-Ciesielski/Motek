const test = require("node:test");
const assert = require("node:assert/strict");

const { createIdleSessionController } = require("../client/idle-session-controller.js");

function createClock() {
  let current = 0;
  const timers = [];
  return {
    now: () => current,
    advance(ms) {
      current += ms;
      for (const timer of timers.splice(0)) {
        if (timer.at <= current) timer.callback();
        else timers.push(timer);
      }
    },
    setTimeout(callback, delay) {
      const timer = { at: current + delay, callback };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      const index = timers.indexOf(timer);
      if (index >= 0) timers.splice(index, 1);
    },
  };
}

function createTarget() {
  const listeners = new Map();
  return {
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    emit(name) { listeners.get(name)?.(); },
  };
}

test("kontroler ostrzega po 1h55 i wygasza sesję po 2h", () => {
  const clock = createClock();
  const target = createTarget();
  let warnings = 0;
  let expired = 0;
  const controller = createIdleSessionController({
    api: async () => {},
    now: clock.now,
    setTimeoutImpl: clock.setTimeout,
    clearTimeoutImpl: clock.clearTimeout,
    eventTarget: target,
    onWarning: () => { warnings += 1; },
    onExpired: () => { expired += 1; },
  });

  controller.start();
  clock.advance(2 * 60 * 60 * 1000 - 5 * 60 * 1000);
  assert.equal(warnings, 1);
  assert.equal(expired, 0);
  clock.advance(5 * 60 * 1000);
  assert.equal(expired, 1);
});

test("aktywność użytkownika przesuwa oba terminy i odświeża serwer", async () => {
  const clock = createClock();
  const target = createTarget();
  let activityCalls = 0;
  let expired = 0;
  const controller = createIdleSessionController({
    api: async () => { activityCalls += 1; },
    now: clock.now,
    setTimeoutImpl: clock.setTimeout,
    clearTimeoutImpl: clock.clearTimeout,
    eventTarget: target,
    onExpired: () => { expired += 1; },
  });

  controller.start();
  target.emit("pointerdown");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(activityCalls, 1);
  clock.advance(2 * 60 * 60 * 1000 - 1);
  assert.equal(expired, 0);
  clock.advance(1);
  assert.equal(expired, 1);
});

test("ustawia lokalny termin wygasania z wartości przekazanej przez serwer", () => {
  const clock = createClock();
  const target = createTarget();
  let expired = 0;
  const controller = createIdleSessionController({
    api: async () => {},
    now: clock.now,
    setTimeoutImpl: clock.setTimeout,
    clearTimeoutImpl: clock.clearTimeout,
    eventTarget: target,
    timeoutMs: 2 * 60 * 60 * 1000,
    onExpired: () => { expired += 1; },
  });

  controller.start();
  controller.setTimeoutMs(100);
  clock.advance(99);
  assert.equal(expired, 0);
  clock.advance(1);
  assert.equal(expired, 1);
});

test("ostrzeżenie respektuje krótszy limit bezczynności z serwera", () => {
  const clock = createClock();
  const target = createTarget();
  const warnings = [];
  const controller = createIdleSessionController({
    api: async () => {},
    now: clock.now,
    setTimeoutImpl: clock.setTimeout,
    clearTimeoutImpl: clock.clearTimeout,
    eventTarget: target,
    timeoutMs: 60_000,
    onWarning: (payload) => warnings.push(payload),
  });

  controller.start();
  clock.advance(0);

  assert.deepEqual(warnings, [{ remainingMs: 60_000 }]);
});

for (const [label, error] of [
  ["timeout", Object.assign(new Error("timeout"), { kind: "timeout" })],
  ["503", Object.assign(new Error("niedostępne"), { status: 503 })],
  ["429", Object.assign(new Error("za dużo żądań"), { status: 429 })],
  ["offline", Object.assign(new Error("offline"), { kind: "network" })],
]) {
  test(`zachowuje sesję po przejściowym błędzie heartbeat: ${label}`, async () => {
    const clock = createClock();
    const target = createTarget();
    let calls = 0;
    let expired = 0;
    const controller = createIdleSessionController({
      api: async () => {
        calls += 1;
        throw error;
      },
      now: clock.now,
      setTimeoutImpl: clock.setTimeout,
      clearTimeoutImpl: clock.clearTimeout,
      eventTarget: target,
      wait: async () => {},
      onExpired: () => { expired += 1; },
    });

    controller.start();
    const refreshed = await controller.markActivity({ force: true });

    assert.equal(refreshed, false);
    assert.equal(calls, 3);
    assert.equal(expired, 0);
    clock.advance(2 * 60 * 60 * 1000);
    assert.equal(expired, 1);
  });
}

test("wygasza sesję natychmiast po odpowiedzi 401 lub 403 heartbeat", async () => {
  for (const status of [401, 403]) {
    const clock = createClock();
    const target = createTarget();
    let expired = 0;
    const controller = createIdleSessionController({
      api: async () => { throw Object.assign(new Error("brak sesji"), { status }); },
      now: clock.now,
      setTimeoutImpl: clock.setTimeout,
      clearTimeoutImpl: clock.clearTimeout,
      eventTarget: target,
      wait: async () => {},
      onExpired: () => { expired += 1; },
    });

    controller.start();
    const refreshed = await controller.markActivity({ force: true });

    assert.equal(refreshed, false);
    assert.equal(expired, 1);
  }
});
