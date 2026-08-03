(function exposeAuthController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.createAuthController = api.createAuthController;
})(typeof window !== 'undefined' ? window : globalThis, () => {
'use strict';

/**
 * Minimalny kontroler przepływu Auth. Nie zna szczegółów widoku — dostaje
 * elementy formularzy oraz klienta API i publikuje aktualny stan sesji.
 */
function createAuthController(elements = {}, apiClient = {}, onSessionChanged = () => {}) {
  const state = { authenticated: false, user: null, error: null, loading: false };
  const getState = () => Object.assign({}, state);
  const notify = () => {
    const snapshot = getState();
    onSessionChanged(snapshot);
    return snapshot;
  };

  const applySession = (payload = {}) => {
    state.authenticated = Boolean(payload.authenticated ?? payload.user);
    state.user = payload.user || null;
    state.error = null;
    return notify();
  };

  const request = (path, options) => {
    if (typeof apiClient.request !== 'function') throw new Error('Brak klienta API.');
    return apiClient.request(path, options);
  };

  const readPayload = (form, event) => {
    if (event?.detail && typeof event.detail === 'object') return event.detail;
    if (form?.payload && typeof form.payload === 'object') return form.payload;
    if (typeof FormData === 'function' && form) return Object.fromEntries(new FormData(form).entries());
    return {};
  };

  const submit = async (kind, payload) => {
    const path = kind === 'register' ? '/api/auth/register' : '/api/auth/login';
    state.loading = true;
    state.error = null;
    try {
      const result = await request(path, { method: 'POST', body: JSON.stringify(payload || {}) });
      state.loading = false;
      return applySession(result || {});
    } catch (error) {
      state.loading = false;
      state.error = error;
      notify();
      throw error;
    }
  };

  const controller = {
    initialize: async () => {
      state.loading = true;
      try {
        const payload = await request('/api/auth/session');
        state.loading = false;
        return applySession(payload);
      } catch (error) {
        state.loading = false;
        state.authenticated = false;
        state.user = null;
        state.error = error;
        notify();
        throw error;
      }
    },
    login: (payload) => submit('login', payload),
    register: (payload) => submit('register', payload),
    logout: async () => {
      state.loading = true;
      try {
        await request('/api/auth/logout', { method: 'POST', body: '{}' });
        state.loading = false;
        state.authenticated = false;
        state.user = null;
        state.error = null;
        return notify();
      } catch (error) {
        state.loading = false;
        state.error = error;
        notify();
        throw error;
      }
    },
    getState,
  };

  const loginForm = elements.loginForm;
  const registerForm = elements.registerForm;
  const logoutButton = elements.logoutButton || elements.logoutBtn;
  if (loginForm?.addEventListener) loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    return controller.login(readPayload(loginForm, event)).catch(() => undefined);
  });
  if (registerForm?.addEventListener) registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    return controller.register(readPayload(registerForm, event)).catch(() => undefined);
  });
  if (logoutButton?.addEventListener) logoutButton.addEventListener('click', (event) => {
    event?.preventDefault?.();
    return controller.logout().catch(() => undefined);
  });

  return controller;
}

  return { createAuthController };
});
