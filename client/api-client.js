(function exposeApiClient(root, factory) {
  const apiClient = factory(root);
  if (typeof module === "object" && module.exports) module.exports = apiClient;
  if (root) root.MotekApiClient = apiClient;
})(typeof window !== "undefined" ? window : globalThis, (root) => {
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  class RequestError extends Error {
    constructor(message, kind) {
      super(message);
      this.name = "RequestError";
      this.kind = kind;
    }
  }

  function createApiClient({
    fetchImpl = root.fetch?.bind(root),
    timeoutMs = 12_000,
    onUnauthorized = () => {},
  } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("Brak funkcji fetch.");
    const retryDelayMs = 700;

    const client = {
      async request(path, options = {}) {
        const {
          headers: optionHeaders = {},
          signal: requestSignal,
          ...requestOptions
        } = options;
        const method = String(requestOptions.method || "GET").toUpperCase();
        const isWriteRequest = !["GET", "HEAD"].includes(method);
        const maxAttempts = isWriteRequest ? 1 : 2;
        let response;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const controller = new AbortController();
          const abortRequest = () => controller.abort();
          const timeout = setTimeout(abortRequest, timeoutMs);
          if (requestSignal) {
            if (requestSignal.aborted) abortRequest();
            else requestSignal.addEventListener("abort", abortRequest, { once: true });
          }

          try {
            response = await fetchImpl(path, {
              credentials: "same-origin",
              ...requestOptions,
              signal: controller.signal,
              headers: { "Content-Type": "application/json", ...optionHeaders },
            });
          } catch (error) {
            const externallyAborted = requestSignal?.aborted;
            const canRetry = ["GET", "HEAD"].includes(method)
              && !externallyAborted
              && attempt < maxAttempts
              && error.name === "TypeError";
            if (canRetry) {
              await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
              continue;
            }
            if (error.name === "AbortError") {
              throw new RequestError(
                externallyAborted
                  ? "Operacja została przerwana."
                  : "Motek nie odpowiedział na czas. Sprawdź połączenie i spróbuj ponownie.",
                externallyAborted ? "aborted" : "timeout",
              );
            }
            if (error instanceof TypeError) {
              throw new RequestError(
                root.navigator?.onLine === false
                  ? "Brak połączenia z internetem. Sprawdź sieć i spróbuj ponownie."
                  : "Nie udało się połączyć z Motkiem. Spróbuj ponownie.",
                "network",
              );
            }
            throw error;
          } finally {
            clearTimeout(timeout);
            requestSignal?.removeEventListener("abort", abortRequest);
          }

          const retryableStatus = [502, 503, 504].includes(response.status);
          if (["GET", "HEAD"].includes(method) && retryableStatus && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            continue;
          }
          break;
        }

        if (!response.ok && response.status !== 204) {
          let message = "";
          try {
            const payload = await response.clone().json();
            message = typeof payload?.error === "string" ? payload.error.trim() : "";
          } catch {
            // Ignore non-JSON error bodies.
          }
          if (response.status === 401) onUnauthorized(path);
          throw new ApiError(
            message || "Nie udało się połączyć z Motkiem. Spróbuj ponownie.",
            response.status,
          );
        }

        if (response.status === 204) return createResponseEnvelope(null, response);
        try {
          const payload = await response.json();
          if ((typeof payload === "object" && payload !== null) || typeof payload === "function") {
            Object.defineProperty(payload, "response", {
              configurable: true,
              enumerable: false,
              value: response,
            });
          }
          return payload;
        } catch {
          throw new RequestError(
            isWriteRequest
              ? "Połączenie przerwało się przed potwierdzeniem zapisu."
              : "Nie udało się odczytać odpowiedzi Motka. Spróbuj ponownie.",
            "response",
          );
        }
      },
    };
    return client;
  }

  function createResponseEnvelope(data, response) {
    return Object.defineProperties({}, {
      data: { configurable: true, enumerable: false, value: data },
      response: { configurable: true, enumerable: false, value: response },
    });
  }

  function isResponseEnvelope(value) {
    return Boolean(value && Object.prototype.hasOwnProperty.call(value, "data")
      && Object.prototype.hasOwnProperty.call(value, "response"));
  }

  return { createApiClient, ApiError, RequestError, isResponseEnvelope };
});
