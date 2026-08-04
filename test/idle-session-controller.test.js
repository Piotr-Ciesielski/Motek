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
