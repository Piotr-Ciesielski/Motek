(function attachIdleSessionController(globalScope) {
  function createIdleSessionController({
    api,
    onWarning = () => {},
    onExpired = () => {},
    now = () => Date.now(),
    setTimeoutImpl = globalScope.setTimeout.bind(globalScope),
    clearTimeoutImpl = globalScope.clearTimeout.bind(globalScope),
    timeoutMs = 2 * 60 * 60 * 1000,
    warningMs = 5 * 60 * 1000,
    activityThrottleMs = 60 * 1000,
    eventTarget = globalScope,
  }) {
    let lastActivityAt = 0;
    let lastServerTouchAt = Number.NEGATIVE_INFINITY;
    let warningTimer = null;
    let expiryTimer = null;
    let started = false;
    let warningVisible = false;

    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart"];

    function clearTimers() {
      if (warningTimer !== null) clearTimeoutImpl(warningTimer);
      if (expiryTimer !== null) clearTimeoutImpl(expiryTimer);
      warningTimer = null;
      expiryTimer = null;
    }

    function expire() {
      if (!started) return;
      started = false;
      clearTimers();
      onExpired();
    }

    function schedule() {
      clearTimers();
      const elapsed = Math.max(0, now() - lastActivityAt);
      const warningDelay = Math.max(0, timeoutMs - warningMs - elapsed);
      const expiryDelay = Math.max(0, timeoutMs - elapsed);
      warningTimer = setTimeoutImpl(() => {
        if (!started) return;
        warningVisible = true;
        onWarning({ remainingMs: warningMs });
      }, warningDelay);
      expiryTimer = setTimeoutImpl(expire, expiryDelay);
    }

    async function markActivity({ force = false } = {}) {
      if (!started) return false;
      const timestamp = now();
      lastActivityAt = timestamp;
      warningVisible = false;
      schedule();
      if (!force && timestamp - lastServerTouchAt < activityThrottleMs) return true;
      lastServerTouchAt = timestamp;
      try {
        await api("/api/auth/activity", { method: "POST", body: "{}" });
        return true;
      } catch {
        expire();
        return false;
      }
    }

    function handleActivity() {
      void markActivity();
    }

    function start() {
      if (started) return;
      started = true;
      lastActivityAt = now();
      lastServerTouchAt = Number.NEGATIVE_INFINITY;
      warningVisible = false;
      activityEvents.forEach((eventName) => eventTarget.addEventListener(eventName, handleActivity, { passive: true }));
      schedule();
    }

    function stop() {
      if (!started) return;
      started = false;
      clearTimers();
      activityEvents.forEach((eventName) => eventTarget.removeEventListener(eventName, handleActivity));
      warningVisible = false;
    }

    return {
      start,
      stop,
      markActivity,
      isWarningVisible: () => warningVisible,
      getLastActivityAt: () => lastActivityAt,
    };
  }

  const api = { createIdleSessionController };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.MotekIdleSession = api;
})(typeof window !== "undefined" ? window : globalThis);
