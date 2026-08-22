const yarnTemplate = document.getElementById("yarnTemplate");
const resultTemplate = document.getElementById("resultTemplate");
const patternSkeletonTemplate = document.getElementById("patternSkeletonTemplate");
const yarnList = document.getElementById("yarnList");
const results = document.getElementById("results");
const matchFreshnessNotice = document.getElementById("matchFreshnessNotice");
const refreshStaleMatchesBtn = document.getElementById("refreshStaleMatchesBtn");
const summary = document.getElementById("summary");
const storageMessage = document.getElementById("storageMessage");
const addYarnBtn = document.getElementById("addYarnBtn");
const findBtn = document.getElementById("findBtn");
const patternTemplate = document.getElementById("patternTemplate");
const patternSearch = document.getElementById("patternSearch");
const patternReviewFilter = document.getElementById("patternReviewFilter");
const patternLanguageFilter = document.getElementById("patternLanguageFilter");
const patternTypeFilter = document.getElementById("patternTypeFilter");
const patternMaterialFilter = document.getElementById("patternMaterialFilter");
const patternSort = document.getElementById("patternSort");
const patternCatalogSummary = document.getElementById("patternCatalogSummary");
const patternCatalogNotice = document.getElementById("patternCatalogNotice");
const patternCatalog = document.getElementById("patternCatalog");
const patternCatalogActions = document.getElementById("patternCatalogActions");
const loadMorePatternsBtn = document.getElementById("loadMorePatternsBtn");
const backToCatalogFiltersBtn = document.getElementById("backToCatalogFiltersBtn");
const resetCatalogFiltersBtn = document.getElementById("resetCatalogFiltersBtn");
const catalogFiltersToggle = document.getElementById("catalogFiltersToggle");
const catalogSecondaryFilters = document.getElementById("catalogSecondaryFilters");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authForms = document.getElementById("authForms");
const authLoggedIn = document.getElementById("authLoggedIn");
const authUser = document.getElementById("authUser");
const authPanel = document.querySelector(".auth-panel");
const authModeSwitch = document.querySelector(".auth-mode-switch");
const loginModeBtn = document.getElementById("loginModeBtn");
const registerModeBtn = document.getElementById("registerModeBtn");
const authProfileSummary = document.getElementById("authProfileSummary");
const authMessage = document.getElementById("authMessage");
const legalAcceptanceForm = document.getElementById("legalAcceptanceForm");
const legalAcceptanceGate = document.getElementById("legalAcceptanceGate");
const legalAcceptanceMessage = document.getElementById("legalAcceptanceMessage");
const legalAcceptanceVersion = document.getElementById("legalAcceptanceVersion");
const deleteAccountForm = document.getElementById("deleteAccountForm");
const deleteAccountDisclosure = document.getElementById("deleteAccountDisclosure");
const deleteAccountMessage = document.getElementById("deleteAccountMessage");
const authLead = document.getElementById("authLead");
const authTitle = document.getElementById("authTitle");
const onboarding = document.getElementById("onboarding");
const onboardingAddYarnBtn = document.getElementById("onboardingAddYarnBtn");
const onboardingSkipBtn = document.getElementById("onboardingSkipBtn");
const logoutBtn = document.getElementById("logoutBtn");
const idleSessionWarning = document.getElementById("idleSessionWarning");
const idleSessionStayBtn = document.getElementById("idleSessionStayBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const passwordResetForm = document.getElementById("passwordResetForm");
const passwordUpdateForm = document.getElementById("passwordUpdateForm");
const cancelPasswordResetBtn = document.getElementById("cancelPasswordResetBtn");
const changePasswordToggle = document.getElementById("changePasswordToggle");
const changePasswordForm = document.getElementById("changePasswordForm");
const accountView = document.getElementById("accountView");
const headerAuthAction = document.getElementById("headerAuthAction");
const themeToggle = document.getElementById("themeToggle");
const themeToggleIcon = themeToggle?.querySelector(".theme-toggle__icon");
const inventoryThemeImage = document.getElementById("inventoryThemeImage");
const catalogThemeImage = document.getElementById("catalogThemeImage");
const accountThemeImage = document.getElementById("accountThemeImage");
const inventoryStats = document.getElementById("inventoryStats");
const inventoryStatYarns = document.getElementById("inventoryStatYarns");
const inventoryStatLength = document.getElementById("inventoryStatLength");
const inventoryStatWeight = document.getElementById("inventoryStatWeight");
const inventoryStatColors = document.getElementById("inventoryStatColors");
const matchesThemeImage = document.getElementById("matchesThemeImage");
const appViews = [...document.querySelectorAll(".app-view")];
const viewButtons = [...document.querySelectorAll("[data-view-target]")];
const inventoryMatchBtn = document.getElementById("inventoryMatchBtn");
const inventoryAddYarnBtn = document.getElementById("inventoryAddYarnBtn");
const backToInventoryBtn = document.getElementById("backToInventoryBtn");
const networkStatus = document.getElementById("networkStatus");
const copyrightNotice = document.getElementById("copyrightNotice");
const { createApiClient, ApiError, RequestError, isResponseEnvelope } = window.MotekApiClient;
const legalDocumentApi = window.MotekLegalDocument || {
  CURRENT_LEGAL_DOCUMENT: Object.freeze({
    termsVersion: "1.0",
    privacyVersion: "1.0",
    copyrightYear: new Date().getFullYear(),
  }),
  formatCopyrightNotice: () => "",
};
const { CURRENT_LEGAL_DOCUMENT, formatCopyrightNotice } = legalDocumentApi;
const createLegalAcceptanceController = window.createLegalAcceptanceController
  || (() => ({ setSessionLegalState: () => false }));

const REQUEST_TIMEOUT_MS = 12_000;
const scrollBehavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  ? "auto"
  : "smooth";
const catalogFilterDisclosure = typeof window.createCatalogFilterDisclosure === "function"
  ? window.createCatalogFilterDisclosure({
    toggle: catalogFiltersToggle,
    panel: catalogSecondaryFilters,
    mobileQuery: window.matchMedia("(max-width: 640px)"),
  })
  : { updateCount() {} };
const {
  buildAuthPayload,
  buildRegistrationAuthPayload,
  resolveRequestedView,
  buildPatternFacetCounts,
  buildPatternFacetOptions,
  ensureSingleNewYarnCard,
  filterPatterns,
  findNewlySavedYarn,
  formatMatchingRequirement,
  formatPatternYarnFact,
  getProjectTypeFilterLabel,
  getProjectTypeLabel,
  getExistingYarnState,
  getYarnMeasurementValidationMessage,
  getMatchFreshnessState,
  getYarnSaveHint,
  readYarnVersionHeader,
  withYarnVersionRetry,
  isDeleteConfirmed,
  initializePasswordRevealControls,
  formatCatalogSummary,
} = window.MotekClientPolicy;

function initializeLegalRegistrationFields() {
  const termsVersion = registerForm.elements.termsVersion;
  const privacyNoticeVersion = registerForm.elements.privacyNoticeVersion;
  if (termsVersion) termsVersion.value = CURRENT_LEGAL_DOCUMENT.termsVersion;
  if (privacyNoticeVersion) privacyNoticeVersion.value = CURRENT_LEGAL_DOCUMENT.privacyVersion;
  if (copyrightNotice) {
    copyrightNotice.textContent = formatCopyrightNotice(CURRENT_LEGAL_DOCUMENT);
  }
}

initializeLegalRegistrationFields();
const {
  MATERIALS,
  formatYarnMaterials,
  normalizeYarnMaterials,
} = window.MotekMaterialPolicy;
const {
  applyTheme,
  getThemeToggleState,
  normalizeTheme,
  saveTheme,
} = window.MotekThemePolicy;
const MATERIAL_LABEL_BY_VALUE = new Map(
  MATERIALS.map(({ value, label }) => [value, label]),
);
const PROJECT_TYPE_ORDER = [
  "socks",
  "sweater",
  "cardigan",
  "top",
  "shawl_scarf",
  "head_accessory",
  "gloves",
  "vest",
  "skirt_dress",
  "blanket",
  "other",
];

let baseUrl = window.location.origin;
let isAuthenticated = false;
let requiresLegalAcceptance = false;
let pendingWriteCount = 0;
let yarnRefreshGeneration = 0;
let yarnRefreshBusyGeneration = 0;
const catalogController = createCatalogController({
  initialFilters: {},
  load: async ({ page }) => {
    if (!canAccessPrivateData()) {
      return { items: [], hasMore: false, total: 0 };
    }
    const offset = Math.max(0, (page - 1) * 50);
    const payload = await api(`/api/patterns?limit=50&offset=${offset}`);
    const items = Array.isArray(payload) ? payload : (payload.items || payload.data || []);
    const total = Number(payload && payload.total);
    return {
      items,
      hasMore: Number.isFinite(total) ? offset + items.length < total : items.length >= 50,
      total: Number.isFinite(total) ? total : undefined,
    };
  },
  onStateChange: () => {
    if (typeof renderPatternCatalog === "function") renderPatternCatalog();
  },
});
let yarnVersion = null;
let onboardingDismissed = false;
let yarnFormSequence = 0;
let activeView = "account";
let catalogDisplayLimit = 12;
let initialSessionResolved = false;
let networkStatusTimer = null;
let preserveDraftAfterLogin = false;
let preservedDraftRequiresSave = false;
let hasCalculatedMatches = false;
let inventoryChangedSinceMatch = false;
let authCaptchaConfig = { enabled: false, provider: null, siteKey: null };
const captchaTokens = { login: null, register: null, passwordReset: null, passwordChange: null, deleteAccount: null };
const captchaWidgetIds = { login: null, register: null, passwordReset: null, passwordChange: null, deleteAccount: null };
const captchaRenderPromises = { login: null, register: null, passwordReset: null, passwordChange: null, deleteAccount: null };
let turnstileScriptPromise = null;

function canAccessPrivateData() {
  return isAuthenticated && !requiresLegalAcceptance;
}
const apiClient = createApiClient({
  fetchImpl: window.fetch.bind(window),
  timeoutMs: REQUEST_TIMEOUT_MS,
  onUnauthorized: (requestPath) => {
    const pathname = new URL(requestPath, window.location.origin).pathname;
    const protectedPath = pathname === "/api/matches"
      || pathname === "/api/yarns"
      || pathname.startsWith("/api/yarns/")
      || pathname === "/api/account";
    if (protectedPath) handleSessionExpired();
  },
});

const idleSessionController = window.MotekIdleSession.createIdleSessionController({
  api: (path, options) => api(path, options),
  onWarning: () => {
    idleSessionWarning.hidden = false;
    idleSessionStayBtn.focus({ preventScroll: true });
  },
  onExpired: () => {
    idleSessionWarning.hidden = true;
    handleSessionExpired();
    setAuthMessage("Sesja wygasła z powodu bezczynności. Zaloguj się ponownie.", "error");
  },
});

function applyIdleTimeout(payload) {
  if (typeof idleSessionController.setTimeoutMs === "function") {
    idleSessionController.setTimeoutMs(payload?.idleTimeoutMs);
  }
}

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => {
      turnstileScriptPromise = null;
      reject(new Error("Nie udało się załadować zabezpieczenia formularza."));
    };
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

function authFormKind(form) {
  return form === registerForm
    ? "register"
    : form === passwordResetForm
      ? "passwordReset"
      : form === changePasswordForm
        ? "passwordChange"
        : form === deleteAccountForm
          ? "deleteAccount"
        : "login";
}

async function renderCaptchaForForm(form) {
  if (!form || !authCaptchaConfig.enabled) return;

  const kind = authFormKind(form);
  if (captchaWidgetIds[kind] !== null) return;
  if (captchaRenderPromises[kind]) return captchaRenderPromises[kind];

  captchaRenderPromises[kind] = (async () => {
    await loadTurnstileScript();
    const visibleForm = document.querySelector(".auth-form:not([hidden])");
    const isVisible = form === changePasswordForm
      ? !form.hidden
      : form === deleteAccountForm
        ? deleteAccountDisclosure.open
        : visibleForm === form;
    if (!isVisible || !form.isConnected) return;
    const container = form.querySelector(`[data-turnstile-for="${kind}"]`);
    if (!container || captchaWidgetIds[kind] !== null) return;
    captchaWidgetIds[kind] = window.turnstile.render(container, {
      sitekey: authCaptchaConfig.siteKey,
      theme: "auto",
      callback: (token) => { captchaTokens[kind] = token; },
      "expired-callback": () => { captchaTokens[kind] = null; },
      "error-callback": () => { captchaTokens[kind] = null; },
    });
  })();

  try {
    await captchaRenderPromises[kind];
  } finally {
    captchaRenderPromises[kind] = null;
  }
}

async function initializeCaptcha() {
  const config = await api("/api/config");
  authCaptchaConfig = config.captcha || authCaptchaConfig;
  if (!authCaptchaConfig.enabled) return;
  await renderCaptchaForForm(document.querySelector(".auth-form:not([hidden])"));
}

function resetCaptchaForForm(form) {
  const kind = authFormKind(form);
  captchaTokens[kind] = null;
  if (captchaWidgetIds[kind] !== null && window.turnstile) {
    window.turnstile.reset(captchaWidgetIds[kind]);
  }
}
const numberFormatter = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 2,
  useGrouping: "always",
});

function focusViewHeading(target) {
  const labelledBy = target.getAttribute("aria-labelledby");
  const labelledHeading = labelledBy ? document.getElementById(labelledBy) : null;
  const heading =
    labelledHeading && target.contains(labelledHeading) && labelledHeading.getClientRects().length
      ? labelledHeading
      : [...target.querySelectorAll("h1, h2")].find(
          (candidate) => candidate.getClientRects().length,
        );

  if (!heading) return;
  heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}

function setActiveView(requestedView, { focus = true } = {}) {
  const view = resolveRequestedView({
    requested: requestedView,
    authenticated: isAuthenticated,
    acceptanceRequired: requiresLegalAcceptance,
  });
  const target = appViews.find((candidate) => candidate.dataset.view === view);
  if (!target) return;

  const returningFromCatalogToInventory = activeView === "catalog" && view === "inventory";
  yarnRefreshGeneration += 1;
  activeView = view;
  appViews.forEach((candidate) => {
    candidate.hidden = candidate !== target;
  });
  viewButtons.forEach((button) => {
    const current = button.dataset.viewTarget === view;
    button.classList.toggle("is-active", current);
    if (current) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  if (focus) {
    window.scrollTo({ top: 0, behavior: scrollBehavior });
    focusViewHeading(target);
  }

  if (returningFromCatalogToInventory && isAuthenticated && !hasUnsavedYarnChanges()) {
    refresh().catch((error) => {
      setStorageMessage(`${error.message} Nie udało się odświeżyć magazynu — spróbuj ponownie za chwilę.`, "error");
    });
  }
}

function renderThemeToggle() {
  if (!themeToggle) {
    return;
  }

  const currentTheme = normalizeTheme(document.documentElement.dataset.theme);
  const state = getThemeToggleState(currentTheme);
  themeToggle.setAttribute("aria-pressed", String(state.pressed));
  themeToggle.setAttribute("aria-label", state.label);

  if (themeToggleIcon) {
    themeToggleIcon.textContent = state.nextTheme === "dark" ? "☾" : "☀";
  }

  const isDark = currentTheme === "dark";
  const artwork = {
    src: (image) => isDark ? image.dataset.darkSrc : image.dataset.lightSrc,
    alt: isDark
      ? "Czarna kotka i ciemne włóczki w nocnej pracowni"
      : "Kolorowe włóczki i kot w pracowni",
  };

  for (const image of [
    inventoryThemeImage,
    matchesThemeImage,
    catalogThemeImage,
    accountThemeImage,
  ]) {
    if (!image) continue;
    image.src = artwork.src(image);
    image.alt = artwork.alt;
  }
}

function updateNavigationState() {
  viewButtons.forEach((button) => {
    const protectedView =
      button.classList.contains("app-nav__button") &&
      ["inventory", "matches", "catalog"].includes(button.dataset.viewTarget);
    button.disabled = protectedView && (!isAuthenticated || requiresLegalAcceptance);
  });
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.viewTarget));
});

themeToggle?.addEventListener("click", () => {
  const currentTheme = normalizeTheme(document.documentElement.dataset.theme);
  const nextTheme = getThemeToggleState(currentTheme).nextTheme;
  const appliedTheme = applyTheme(nextTheme);
  saveTheme(appliedTheme);
  renderThemeToggle();
});

renderThemeToggle();

async function detectRuntimeMode() {
  if (window.location.protocol === "file:") {
    throw new Error("Otwórz Motka przez serwer Node.js z konfiguracją Supabase.");
  }

  baseUrl = window.location.origin;
}

async function api(path, options = {}) {
  if (!baseUrl) {
    throw new Error("Brak adresu backendu Motka.");
  }
  const method = String(options.method || "GET").toUpperCase();
  const isWriteRequest = !["GET", "HEAD"].includes(method);
  if (isWriteRequest) pendingWriteCount += 1;
  try {
    const result = await apiClient.request(`${baseUrl}${path}`, options);
    const payload = isResponseEnvelope(result) ? result.data : result;
    const response = isResponseEnvelope(result) ? result.response : result?.response;
    if (path === "/api/yarns" || path.startsWith("/api/yarns/")) {
      yarnVersion = readYarnVersionHeader(response?.headers) || yarnVersion;
    }
    api.lastMatchScope = path === "/api/matches"
      ? response?.headers?.get?.("X-Motek-Match-Scope") || "full"
      : null;
    return payload;
  } finally {
    if (isWriteRequest) pendingWriteCount -= 1;
  }
}

const legalAcceptanceController = createLegalAcceptanceController({
  form: legalAcceptanceForm,
  gate: legalAcceptanceGate,
  message: legalAcceptanceMessage,
  versionOutput: legalAcceptanceVersion,
  request: (path, options) => api(path, options),
  legalDocument: CURRENT_LEGAL_DOCUMENT,
  onAccepted: async () => {
    await refreshAuthSession({ navigateToInventory: true });
  },
});

function showMessage(container, message, kind = "status", action = null) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.dataset.kind = kind;
  element.setAttribute("role", kind === "error" ? "alert" : "status");
  element.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  const text = document.createElement("p");
  text.className = "empty-state__text";
  text.textContent = message;
  element.appendChild(text);
  if (action) {
    const button = document.createElement("button");
    button.className = "button button--ghost empty-state__action";
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    element.appendChild(button);
  }
  container.replaceChildren(element);
  container.toggleAttribute("aria-busy", kind === "loading");
}

function setStorageMessage(message, kind = "", actions = []) {
  MotekDomUtils.setMessage(storageMessage, { text: message, kind, actions });
}

function isYarnVersionConflict(error) {
  return error instanceof ApiError
    && error.status === 409
    && error.message.startsWith("Magazyn został zmieniony");
}

function showYarnVersionConflict({
  retryOperation,
  preservedMessage,
  retryLabel,
  conflictMessage,
}) {
  const showConflictAgain = () => {
    showYarnVersionConflict({
      retryOperation,
      preservedMessage,
      retryLabel,
      conflictMessage,
    });
  };

  setStorageMessage(
    conflictMessage,
    "error",
    [
      {
        label: retryLabel,
        primary: true,
        onClick: async () => {
          setStorageMessage("Pobieram aktualną wersję magazynu i ponawiam zapis...");
          try {
            await loadYarns();
            await retryOperation();
          } catch (error) {
            if (isYarnVersionConflict(error)) {
              showConflictAgain();
              return;
            }
            setStorageMessage(`${error.message} ${preservedMessage}`, "error");
          }
        },
      },
      {
        label: "Pobierz nowsze dane",
        onClick: async () => {
          if (
            hasYarnFormDraft()
            && !window.confirm(
              "Pobrać nowsze dane? Niezapisane zmiany widoczne w formularzu zostaną zastąpione."
            )
          ) {
            return;
          }

          setStorageMessage("Pobieram nowsze dane...");
          try {
            await refresh();
            setStorageMessage("Magazyn jest już aktualny.", "success");
          } catch (error) {
            setStorageMessage(
              `${error.message} Niezapisane zmiany nadal są w formularzu.`,
              "error",
              [
                {
                  label: "Spróbuj ponownie",
                  onClick: showConflictAgain,
                },
              ]
            );
          }
        },
      },
    ]
  );
}

function updateNetworkStatus(online = navigator.onLine) {
  window.clearTimeout(networkStatusTimer);
  networkStatus.hidden = false;
  networkStatus.dataset.kind = online ? "success" : "error";
  networkStatus.setAttribute("role", online ? "status" : "alert");
  networkStatus.setAttribute("aria-live", online ? "polite" : "assertive");
  networkStatus.textContent = online
    ? "Połączenie wróciło. Możesz ponowić ostatnią operację."
    : "Brak połączenia z internetem. Niezapisane zmiany pozostaną w formularzu.";

  if (online) {
    networkStatusTimer = window.setTimeout(() => {
      networkStatus.hidden = true;
    }, 5000);
  }
}

window.addEventListener("offline", () => updateNetworkStatus(false));
window.addEventListener("online", () => updateNetworkStatus(true));
if (!navigator.onLine) updateNetworkStatus(false);

function createRequirement(text) {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? numberFormatter.format(number) : "0";
}

function groupMatchesByPattern(matches) {
  const groups = new Map();

  matches.forEach((item) => {
    const variantLabel = item.pattern.variantLabel || item.pattern.label || "";
    const key = item.pattern.patternId || String(item.pattern.id).split(":")[0];
    const fallbackName = variantLabel
      ? item.pattern.name.replace(` — ${variantLabel}`, "")
      : item.pattern.name;
    if (!groups.has(key)) {
      groups.set(key, {
        name: item.pattern.baseName || fallbackName,
        description: item.pattern.description,
        variants: [],
      });
    }
    groups.get(key).variants.push(item);
  });

  return [...groups.values()];
}

function createMatchVariant(item, open = false) {
  const details = document.createElement("details");
  details.className = "match-variant";
  details.open = open;

  const header = document.createElement("summary");
  const label = document.createElement("strong");
  const score = document.createElement("span");
  label.textContent = item.pattern.variantLabel || item.pattern.label || item.pattern.name;
  score.className = "match-variant__score";
  score.textContent = `${item.total}%`;
  header.append(label, score);

  const meta = document.createElement("p");
  meta.className = "match-variant__meta";
  meta.textContent = [
    item.pattern.size ? `Rozmiar: ${item.pattern.size}` : null,
    item.pattern.yarnOption ? `Wariant włóczki: ${item.pattern.yarnOption}` : null,
  ].filter(Boolean).join(" · ");

  const requirements = document.createElement("ul");
  requirements.className = "requirements";
  requirements.replaceChildren(
    ...item.pattern.requirements.map((requirement, index) =>
      createRequirement(
        formatMatchingRequirement(
          requirement,
          item.allocation?.[index]?.yarns || [],
          formatNumber,
          formatSkeinCount,
        ),
      )
    ),
  );

  details.append(header, meta, requirements);
  return details;
}

function collectYarnFromCard(card) {
  return {
    id: card.dataset.id ? Number(card.dataset.id) : null,
    name: card.querySelector('[data-field="name"]').value.trim(),
    color: card.querySelector('[data-field="color"]').value.trim(),
    materials: getSelectedYarnMaterials(card),
    weightClass: card.querySelector('[data-field="weightClass"]').value,
    length: Number(card.querySelector('[data-field="length"]').value || 0),
    weight: Number(card.querySelector('[data-field="weight"]').value || 0),
  };
}

function getSelectedYarnMaterials(card) {
  return [...card.querySelectorAll("[data-material-option]:checked")]
    .map((field) => field.value);
}

function updateYarnMaterialPicker(card) {
  const materials = getSelectedYarnMaterials(card);
  const picker = card.querySelector("[data-material-picker]");
  const summary = card.querySelector("[data-material-summary]");
  const error = card.querySelector("[data-material-error]");
  const isEmpty = materials.length === 0;

  summary.textContent = formatYarnMaterials(materials);
  picker.classList.toggle("material-picker--invalid", isEmpty);
  picker.setAttribute("aria-invalid", String(isEmpty));
  error.hidden = !isEmpty;
}

function setYarnMaterials(card, materials) {
  let selected;
  try {
    selected = normalizeYarnMaterials(materials);
  } catch {
    selected = ["mieszanka"];
  }
  const selectedSet = new Set(selected);
  card.querySelectorAll("[data-material-option]").forEach((field) => {
    field.checked = selectedSet.has(field.value);
  });
  updateYarnMaterialPicker(card);
}

function updateYarnCardSummary(card) {
  const yarn = collectYarnFromCard(card);
  const name = card.querySelector('[data-summary="name"]');
  const details = card.querySelector('[data-summary="details"]');
  const swatch = card.querySelector(".yarn-card__swatch");

  name.textContent = yarn.name || "Nowy motek";
  name.title = yarn.name || "Nowy motek";
  details.textContent = yarn.color
    ? `${yarn.color} · ${formatYarnMaterials(yarn.materials)} · ${yarn.weightClass} · ${formatNumber(yarn.length)} m · ${formatNumber(yarn.weight)} g`
    : "Uzupełnij dane włóczki";
  swatch.title = yarn.color ? `Kolor: ${yarn.color}` : "Nowa włóczka";
}

function setYarnMeasurementValidity(field, { showRequired = false } = {}) {
  if (!field.matches('[data-field="length"], [data-field="weight"]')) return;
  const message = getYarnMeasurementValidationMessage({
    field: field.dataset.field,
    validity: field.validity,
    showRequired,
  });
  field.setCustomValidity(message);
  field.toggleAttribute("aria-invalid", Boolean(message));
  const error = field.closest("label")?.querySelector("[data-field-error]");
  if (error) {
    error.hidden = !message;
    error.textContent = message;
  }
}

function syncYarnMeasurementValidity(card, options) {
  card
    .querySelectorAll('[data-field="length"], [data-field="weight"]')
    .forEach((field) => setYarnMeasurementValidity(field, options));
}

function isYarnComplete(card, options) {
  syncYarnMeasurementValidity(card, options);
  return [...card.querySelectorAll("[data-field]")].every((field) => field.checkValidity()) &&
    card.querySelector('[data-field="name"]').value.trim() !== "" &&
    card.querySelector('[data-field="color"]').value.trim() !== "" &&
    getSelectedYarnMaterials(card).length > 0;
}

function isYarnChanged(card) {
  return JSON.stringify(collectYarnFromCard(card)) !== JSON.stringify(card._originalYarn);
}

function applyYarnToCard(card, yarn) {
  ["name", "color", "weightClass", "length", "weight"].forEach((field) => {
    card.querySelector(`[data-field="${field}"]`).value = yarn[field];
  });
  setYarnMaterials(card, yarn.materials);
}

function markYarnCardAsSaved(card, yarn) {
  card.dataset.id = yarn.id;
  applyYarnToCard(card, yarn);
  card.dataset.saved = "true";
  card.dataset.editing = "false";
  card._originalYarn = collectYarnFromCard(card);
  setYarnFieldsDisabled(card, true);
  updateYarnCardSummary(card);
  updateYarnSaveButton(card);
}

function isUncertainWriteError(error) {
  return error instanceof RequestError
    || (error instanceof ApiError && error.status >= 500);
}

function showUncertainWrite(message, onVerify) {
  setStorageMessage(message, "error", [
    {
      label: "Sprawdź stan magazynu",
      primary: true,
      onClick: onVerify,
    },
  ]);
}

async function verifyUncertainNewYarn(card, draft, knownYarnIds) {
  if (!card.isConnected) {
    setStorageMessage("Formularz został już zamknięty. Odśwież magazyn, aby sprawdzić jego stan.");
    return;
  }

  setStorageMessage("Sprawdzam aktualny magazyn...");
  try {
    const yarns = await loadYarns();
    const savedYarn = findNewlySavedYarn(yarns, draft, knownYarnIds);
    if (savedYarn) {
      markYarnCardAsSaved(card, savedYarn);
      setStorageMessage("Motek był już zapisany. Formularz jest zsynchronizowany.", "success");
      await renderSummary();
      renderOnboarding(collectYarnsFromDom());
      return;
    }
    setStorageMessage(
      "Nie znaleziono tego motka w magazynie. Możesz bezpiecznie spróbować zapisać go ponownie.",
      "error",
      [
        {
          label: "Spróbuj zapisać ponownie",
          primary: true,
          onClick: () => saveNewYarn(card),
        },
      ]
    );
  } catch (error) {
    showUncertainWrite(
      `${error.message} Formularz nadal jest bezpiecznie zachowany.`,
      () => verifyUncertainNewYarn(card, draft, knownYarnIds)
    );
  }
}

async function verifyUncertainExistingYarn(card, draft, yarnId) {
  if (!card.isConnected) {
    setStorageMessage("Formularz został już zamknięty. Odśwież magazyn, aby sprawdzić jego stan.");
    return;
  }

  setStorageMessage("Sprawdzam aktualny magazyn...");
  try {
    const yarns = await loadYarns();
    const result = getExistingYarnState(yarns, yarnId, draft);
    if (result.state === "saved") {
      markYarnCardAsSaved(card, result.yarn);
      setStorageMessage("Zmiana była już zapisana. Formularz jest zsynchronizowany.", "success");
      await renderSummary();
      return;
    }
    if (result.state === "missing") {
      setStorageMessage(
        "Tego motka nie ma już w aktualnym magazynie. Możesz zachować formularz i dodać go jako nowy.",
        "error",
        [
          {
            label: "Dodaj jako nowy motek",
            primary: true,
            onClick: () => {
              card.dataset.id = "";
              card.dataset.saved = "false";
              card._originalYarn = null;
              updateYarnSaveButton(card);
              saveNewYarn(card);
            },
          },
          {
            label: "Odrzuć formularz i pobierz dane",
            onClick: async () => {
              if (
                !window.confirm(
                  "Pobrać aktualny magazyn? Niezapisany formularz zostanie zastąpiony."
                )
              ) {
                return;
              }
              try {
                await refresh();
                setStorageMessage("Magazyn jest już aktualny.", "success");
              } catch (error) {
                setStorageMessage(`${error.message} Formularz nadal jest na ekranie.`, "error");
              }
            },
          },
        ]
      );
      return;
    }
    showYarnVersionConflict({
      retryOperation: () => saveExistingYarn(card),
      preservedMessage: "Zmiany pozostały w formularzu.",
      retryLabel: "Zapisz moją wersję",
      conflictMessage:
        "Sprawdzenie wykazało, że Twoja zmiana nie została zapisana, a w magazynie jest inna wersja tego motka. Możesz zapisać swoją wersję albo pobrać nowsze dane.",
    });
  } catch (error) {
    showUncertainWrite(
      `${error.message} Zmiany nadal są bezpiecznie zachowane w formularzu.`,
      () => verifyUncertainExistingYarn(card, draft, yarnId)
    );
  }
}

function hasYarnFormDraft() {
  return [...yarnList.querySelectorAll(".yarn-card")].some((card) => {
    if (card.dataset.saved !== "true") return true;
    return card.dataset.editing === "true" && isYarnChanged(card);
  });
}

function hasUnsavedYarnChanges() {
  return pendingWriteCount > 0 || hasYarnFormDraft();
}

function handleSessionExpired() {
  if (!isAuthenticated) return;
  preservedDraftRequiresSave = hasYarnFormDraft();
  preserveDraftAfterLogin = hasUnsavedYarnChanges();
  renderAuthState({ authenticated: false });
  setAuthMessage(
    preserveDraftAfterLogin
      ? "Sesja wygasła. Zaloguj się ponownie — rozpoczęte zmiany pozostaną w formularzu."
      : "Sesja wygasła. Zaloguj się ponownie, aby kontynuować.",
    "error"
  );
  window.setTimeout(() => {
    loginForm.querySelector('input[name="email"]').focus({ preventScroll: true });
  }, 0);
}

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedYarnChanges()) return;
  event.preventDefault();
  event.returnValue = "";
});

function setYarnFieldsDisabled(card, disabled) {
  card.querySelectorAll("[data-field]").forEach((field) => {
    field.disabled = disabled;
  });
  card.querySelector("[data-material-field]").disabled = disabled;
}

function updateYarnSaveButton(card) {
  const saveButton = card.querySelector(".yarn-save");
  const cancelButton = card.querySelector(".yarn-cancel");
  const isNew = card.dataset.saved !== "true";
  const isEditing = isNew || card.dataset.editing === "true";
  const changed = isNew || isYarnChanged(card);
  const hint = getYarnSaveHint({
    yarn: collectYarnFromCard(card),
    isEditing,
    isNew,
    changed,
    busy: card.dataset.busy === "true",
  });
  card.querySelector(".yarn-edit").hidden = isNew || isEditing;
  cancelButton.hidden = !isEditing;
  cancelButton.disabled = card.dataset.busy === "true";
  cancelButton.textContent = isNew ? "Anuluj dodawanie" : "Anuluj";
  saveButton.hidden = !hint.visible;
  saveButton.disabled = hint.disabled || !isYarnComplete(card);
  saveButton.textContent = card.dataset.busy === "true" ? "Zapisywanie…" : "Zapisz";
  const hintNode = card.querySelector("[data-save-hint]");
  hintNode.hidden = !hint.visible;
  hintNode.textContent = hint.message;
}

function setYarnCardBusy(card, busy) {
  card.dataset.busy = busy ? "true" : "false";
  updateYarnSaveButton(card);
}

function updateMatchFreshnessNotice() {
  const state = getMatchFreshnessState({
    hasCalculatedMatches,
    inventoryChanged: inventoryChangedSinceMatch,
  });
  matchFreshnessNotice.hidden = !state.stale;
  matchFreshnessNotice.querySelector("span").textContent = state.message;
}

function markMatchesStale() {
  inventoryChangedSinceMatch = true;
  updateMatchFreshnessNotice();
}

function markMatchesFresh() {
  hasCalculatedMatches = true;
  inventoryChangedSinceMatch = false;
  updateMatchFreshnessNotice();
}

async function refreshSummaryAfterConfirmedSave(successMessage) {
  markMatchesStale();
  try {
    await renderSummary();
    setStorageMessage(successMessage, "success");
  } catch (error) {
    setStorageMessage(
      `${successMessage} Nie udało się odświeżyć podsumowania: ${error.message}`,
      "warning",
      [
        {
          label: "Odśwież podsumowanie",
          onClick: () => refreshSummaryAfterConfirmedSave(successMessage),
        },
      ]
    );
  }
}

async function saveNewYarn(card) {
  card.querySelectorAll('[data-field="length"], [data-field="weight"]').forEach((field) => {
    field.dataset.validationAttempted = "true";
  });
  if (!isYarnComplete(card, { showRequired: true })) {
    const invalidField = [...card.querySelectorAll("[data-field]")]
      .find((field) => !field.checkValidity());
    const field = invalidField || card.querySelector('[data-field="name"]');
    field.reportValidity();
    field.focus({ preventScroll: true });
    return;
  }

  const draft = collectYarnFromCard(card);
  const knownYarnIds = new Set(
    [...yarnList.querySelectorAll('.yarn-card[data-saved="true"]')]
      .map((savedCard) => savedCard.dataset.id)
  );
  setYarnCardBusy(card, true);
  setStorageMessage("Zapisuję motek...");
  let savedYarn;
  try {
    savedYarn = await withYarnVersionRetry({
      getVersion: () => yarnVersion,
      refreshVersion: () => loadYarns(),
      operation: () => api("/api/yarns", {
        method: "POST",
        headers: { "If-Match": yarnVersion },
        body: JSON.stringify(draft),
      }),
    });
  } catch (error) {
    if (isYarnVersionConflict(error)) {
      showYarnVersionConflict({
        retryOperation: () => saveNewYarn(card),
        preservedMessage: "Motek pozostał w formularzu.",
        retryLabel: "Dodaj mój motek",
        conflictMessage:
          "Magazyn zmienił się w innej karcie lub na innym urządzeniu. Nowy motek nadal jest w formularzu. Możesz dodać go do aktualnego magazynu albo pobrać nowsze dane.",
      });
      return;
    }
    if (isUncertainWriteError(error)) {
      showUncertainWrite(
        `${error.message} Motek mógł zostać zapisany, dlatego nie ponawiam operacji automatycznie.`,
        () => verifyUncertainNewYarn(card, draft, knownYarnIds)
      );
      return;
    }
    setStorageMessage(`${error.message} Motek pozostał w formularzu.`, "error");
    return;
  } finally {
    setYarnCardBusy(card, false);
  }

  markYarnCardAsSaved(card, savedYarn);
  renderOnboarding(collectYarnsFromDom());
  await refreshSummaryAfterConfirmedSave("Motek zapisany w magazynie.");
}

async function saveExistingYarn(card) {
  card.querySelectorAll('[data-field="length"], [data-field="weight"]').forEach((field) => {
    field.dataset.validationAttempted = "true";
  });
  if (!isYarnComplete(card, { showRequired: true })) {
    const invalidField = [...card.querySelectorAll("[data-field]")]
      .find((field) => !field.checkValidity());
    invalidField?.reportValidity();
    invalidField?.focus({ preventScroll: true });
    return;
  }
  if (!isYarnChanged(card)) return;

  const draft = collectYarnFromCard(card);
  setYarnCardBusy(card, true);
  setStorageMessage("Zapisuję zmiany motka...");
  let savedYarn;
  try {
    savedYarn = await withYarnVersionRetry({
      getVersion: () => yarnVersion,
      refreshVersion: () => loadYarns(),
      operation: () => api(`/api/yarns/${card.dataset.id}`, {
        method: "PATCH",
        headers: { "If-Match": yarnVersion },
        body: JSON.stringify(draft),
      }),
    });
  } catch (error) {
    if (isYarnVersionConflict(error)) {
      showYarnVersionConflict({
        retryOperation: () => saveExistingYarn(card),
        preservedMessage: "Zmiany pozostały w formularzu.",
        retryLabel: "Zapisz moją wersję",
        conflictMessage:
          "Ten motek lub magazyn zmienił się w innej karcie albo na innym urządzeniu. Twoja wersja nadal jest w formularzu. Jej zapisanie zastąpi zmiany tego samego motka wykonane gdzie indziej.",
      });
      return;
    }
    if (isUncertainWriteError(error)) {
      const yarnId = Number(card.dataset.id);
      showUncertainWrite(
        `${error.message} Nie wiadomo jeszcze, czy zmiana dotarła do magazynu. Formularz pozostaje na ekranie.`,
        () => verifyUncertainExistingYarn(card, draft, yarnId)
      );
      return;
    }
    setStorageMessage(`${error.message} Zmiany pozostały w formularzu.`, "error");
    return;
  } finally {
    setYarnCardBusy(card, false);
  }

  markYarnCardAsSaved(card, savedYarn);
  await refreshSummaryAfterConfirmedSave("Zmiany motka zapisane.");
}

async function refreshAfterConfirmedMutation(successMessage) {
  markMatchesStale();
  try {
    const yarns = collectYarnsFromDom();
    renderOnboarding(yarns);
    await renderSummary(yarns);
    setStorageMessage(successMessage, "success");
  } catch (error) {
    setStorageMessage(
      `${successMessage} Nie udało się odświeżyć widoku: ${error.message}`,
      "error",
      [
        {
          label: "Odśwież widok",
          onClick: () => refreshAfterConfirmedMutation(successMessage),
        },
      ]
    );
  }
}

async function verifyUncertainDelete(node, yarnId, yarnName, retryOperation) {
  setStorageMessage("Sprawdzam aktualny magazyn...");
  try {
    const yarns = await loadYarns();
    if (isDeleteConfirmed(yarns, yarnId)) {
      node.remove();
      await refreshAfterConfirmedMutation(`Usunięto „${yarnName}”.`);
      return;
    }
    setStorageMessage(
      `„${yarnName}” nadal jest w magazynie. Możesz bezpiecznie spróbować usunąć go ponownie.`,
      "error",
      [
        {
          label: "Spróbuj usunąć ponownie",
          primary: true,
          onClick: retryOperation,
        },
      ]
    );
  } catch (error) {
    showUncertainWrite(
      `${error.message} Włóczka pozostaje na ekranie do czasu potwierdzenia stanu.`,
      () => verifyUncertainDelete(node, yarnId, yarnName, retryOperation)
    );
  }
}

function addYarnCard(yarn = {}, { isNew = false } = {}) {
  const node = yarnTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = yarn.id || "";
  node.dataset.saved = isNew ? "false" : "true";
  node.dataset.editing = isNew ? "true" : "false";
  node.querySelector('[data-field="name"]').value = yarn.name || "";
  node.querySelector('[data-field="color"]').value = yarn.color || "";
  node.querySelector('[data-field="weightClass"]').value = yarn.weightClass || "dk";
  node.querySelector('[data-field="length"]').value = isNew ? "" : yarn.length ?? 0;
  node.querySelector('[data-field="weight"]').value = isNew ? "" : yarn.weight ?? 0;
  node.querySelectorAll("[data-field]").forEach((field) => {
    field.id = `yarn-${++yarnFormSequence}-${field.dataset.field}`;
    field.closest("label").htmlFor = field.id;
    const error = field.closest("label")?.querySelector("[data-field-error]");
    if (error) {
      error.id = `${field.id}-error`;
      field.setAttribute("aria-describedby", error.id);
    }
  });
  const materialOptions = node.querySelector("[data-material-options]");
  MATERIALS.forEach(({ value, label }) => {
    const option = document.createElement("label");
    const checkbox = document.createElement("input");
    const optionLabel = document.createElement("span");
    checkbox.type = "checkbox";
    checkbox.value = value;
    checkbox.dataset.materialOption = "";
    checkbox.id = `yarn-${++yarnFormSequence}-material`;
    option.htmlFor = checkbox.id;
    option.className = "material-picker__option";
    optionLabel.textContent = label;
    option.append(checkbox, optionLabel);
    materialOptions.appendChild(option);
  });
  const initialMaterials = Array.isArray(yarn.materials)
    ? yarn.materials
    : yarn.material
      ? [yarn.material]
      : ["wełna"];
  setYarnMaterials(node, initialMaterials);
  node._originalYarn = isNew ? null : collectYarnFromCard(node);

  node.querySelector(".yarn-remove").addEventListener("click", async () => {
    const isSaved = node.dataset.saved === "true";
    const yarnName = collectYarnFromCard(node).name || "tę włóczkę";
    if (isSaved && !window.confirm(`Usunąć „${yarnName}” z magazynu? Tej operacji nie można cofnąć.`)) {
      return;
    }

    if (!isSaved) {
      node.remove();
      if (!yarnList.children.length) renderYarnEmptyState();
      setStorageMessage("Anulowano dodawanie nowego motka.");
      return;
    }

    const yarnId = Number(node.dataset.id);
    const removeSavedYarn = async () => {
      setStorageMessage("Usuwam włóczkę...");
      await deleteYarn(yarnId);
      node.remove();
      await refreshAfterConfirmedMutation(`Usunięto „${yarnName}”.`);
    };

    const attemptRemoveSavedYarn = async () => {
      try {
        await removeSavedYarn();
      } catch (error) {
        if (isYarnVersionConflict(error)) {
          showYarnVersionConflict({
            retryOperation: attemptRemoveSavedYarn,
            preservedMessage: "Włóczka nie została usunięta.",
            retryLabel: "Usuń mimo zmian",
            conflictMessage:
              "Ten motek lub magazyn zmienił się w innej karcie albo na innym urządzeniu. Włóczka nie została usunięta. Możesz usunąć ją mimo nowszych zmian albo pobrać aktualny magazyn.",
          });
          return;
        }
        if (isUncertainWriteError(error)) {
          showUncertainWrite(
            `${error.message} Nie wiadomo jeszcze, czy włóczka została usunięta, dlatego nie powtarzam operacji automatycznie.`,
            () => verifyUncertainDelete(node, yarnId, yarnName, attemptRemoveSavedYarn)
          );
          return;
        }
        setStorageMessage(
          `${error.message} Włóczka pozostała w formularzu.`,
          "error"
        );
      }
    };

    await attemptRemoveSavedYarn();
  });

  node.querySelector(".yarn-save").addEventListener("click", () => {
    if (node.dataset.saved === "true") saveExistingYarn(node);
    else saveNewYarn(node);
  });
  node.querySelector(".yarn-edit").addEventListener("click", () => {
    yarnRefreshGeneration += 1;
    node.dataset.editing = "true";
    setYarnFieldsDisabled(node, false);
    updateYarnSaveButton(node);
    node.querySelector('[data-field="name"]').focus();
  });
  node.querySelector(".yarn-cancel").addEventListener("click", () => {
    if (node.dataset.saved !== "true") {
      node.remove();
      if (!yarnList.children.length) renderYarnEmptyState();
      setStorageMessage("Anulowano dodawanie nowego motka.");
      return;
    }

    applyYarnToCard(node, node._originalYarn);
    node.dataset.editing = "false";
    setYarnFieldsDisabled(node, true);
    updateYarnCardSummary(node);
    updateYarnSaveButton(node);
  });

  node.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("input", () => {
      field.removeAttribute("data-validation-attempted");
      field.removeAttribute("aria-invalid");
      setYarnMeasurementValidity(field);
      updateYarnSaveButton(node);
    });
    field.addEventListener("change", () => {
      if (field.matches("[data-material-option]")) {
        if (field.value === "mieszanka" && field.checked) {
          node.querySelectorAll("[data-material-option]").forEach((option) => {
            if (option !== field) option.checked = false;
          });
        } else if (field.checked) {
          const unspecified = node.querySelector(
            '[data-material-option][value="mieszanka"]',
          );
          if (unspecified) unspecified.checked = false;
        }
        updateYarnMaterialPicker(node);
      }
      updateYarnSaveButton(node);
    });
    field.addEventListener("invalid", () => {
      if (field.matches('[data-field="length"], [data-field="weight"]')) {
        setYarnMeasurementValidity(field, {
          showRequired: field.dataset.validationAttempted === "true"
            || !field.validity.valueMissing,
        });
        return;
      }
      field.setAttribute("aria-invalid", "true");
    });
  });

  updateYarnSaveButton(node);
  updateYarnCardSummary(node);
  setYarnFieldsDisabled(node, !isNew);
  yarnList.appendChild(node);
  return node;
}

function collectYarnsFromDom() {
  return [...yarnList.querySelectorAll('.yarn-card[data-saved="true"]')].map(collectYarnFromCard);
}

yarnList.addEventListener("click", (event) => {
  const card = event.target.closest(".yarn-card");
  if (!card || event.target.closest("[data-material-picker]")) {
    return;
  }

  card.querySelectorAll("[data-material-picker][open]").forEach((picker) => {
    picker.open = false;
  });
});

document.querySelectorAll("label").forEach((label) => {
  const field = label.querySelector("input, select");
  if (field?.id) label.htmlFor = field.id;
});

initializePasswordRevealControls(document);

async function loadYarns() {
  if (!canAccessPrivateData()) return [];
  return api("/api/yarns");
}

function renderYarnEmptyState() {
  const emptyState = document.createElement("div");
  emptyState.className = "empty-state yarn-empty-state";

  const title = document.createElement("strong");
  title.textContent = isAuthenticated
    ? "Twój magazyn jest jeszcze pusty."
    : "Zaloguj się, aby używać magazynu.";
  emptyState.appendChild(title);

  const message = document.createElement("p");
  message.textContent = isAuthenticated
    ? "Dodaj pierwszy motek, a potem sprawdź, które wzory możesz wykonać."
    : "Załóż konto lub zaloguj się, żeby zapisywać włóczki i korzystać z dopasowania.";
  emptyState.appendChild(message);

  const action = document.createElement("button");
  action.className = "button button--ghost";
  action.type = "button";
  action.textContent = isAuthenticated ? "Dodaj pierwszy motek" : "Zaloguj się lub załóż konto";
  action.addEventListener("click", () => {
    if (isAuthenticated) {
      addYarnBtn.click();
      return;
    }
    setActiveView("account");
    loginForm.scrollIntoView({ behavior: scrollBehavior, block: "center" });
    loginForm.querySelector('input[name="email"]').focus({ preventScroll: true });
  });
  emptyState.appendChild(action);
  yarnList.appendChild(emptyState);
}

function renderOnboarding(yarns) {
  onboarding.hidden = !isAuthenticated || yarns.length > 0 || onboardingDismissed;
}

async function deleteYarn(id) {
  if (!isAuthenticated) {
    throw new Error("Zaloguj się, aby zmieniać swój magazyn włóczek.");
  }
  await withYarnVersionRetry({
    getVersion: () => yarnVersion,
    refreshVersion: () => loadYarns(),
    operation: () => api(`/api/yarns/${id}`, {
      method: "DELETE",
      headers: { "If-Match": yarnVersion },
    }),
  });
}

async function loadMatches() {
  if (!canAccessPrivateData()) return [];
  return api("/api/matches");
}

async function loadPatternCatalog({ resume = false, onPage = null } = {}) {
  await (resume ? catalogController.loadMore() : catalogController.refresh());
  const state = catalogController.getState();
  const progress = {
    items: state.items,
    nextOffset: state.page * 50,
    total: state.total,
    complete: !state.hasMore,
  };
  onPage?.(progress);
  return progress;
}

function formatRatio(value) {
  const ratio = Number(value);
  return Number.isFinite(ratio) && ratio > 0
    ? `${formatNumber(ratio)} m/100 g`
    : "brak danych";
}

function formatSkeinCount(value) {
  const count = Number(value) || 0;
  const formattedCount = formatNumber(count);
  const lastTwo = count % 100;
  const last = count % 10;
  if (count === 1) return "1 motek";
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
    return `${formattedCount} motki`;
  }
  return `${formattedCount} motków`;
}

function formatVariantCount(value) {
  const formattedValue = formatNumber(value);
  const lastTwo = value % 100;
  const last = value % 10;
  if (value === 1) return "1 pasujący rozmiar";
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
    return `${formattedValue} pasujące rozmiary`;
  }
  return `${formattedValue} pasujących rozmiarów`;
}

function formatRequirement(requirement, index) {
  const name = requirement.yarn_name || `Włóczka ${index + 1}`;
  const role = requirement.option
    ? `${requirement.role || "główna"}, ${requirement.option}`
    : requirement.role || "główna";
  const materials = Array.isArray(requirement.materials)
    ? requirement.materials.join(", ")
    : "";
  const ratio = Number(requirement.meters_per_100g);
  const weightClass = requirement.yarn_weight
    ? `grubość ${requirement.yarn_weight}`
    : "";
  const details = [
    materials,
    weightClass,
    Number.isFinite(ratio) && ratio > 0 ? formatRatio(ratio) : "",
    requirement.quantity_note || "",
  ]
    .filter(Boolean)
    .join(" · ");

  return `${name} (${role}) — ${details}`;
}

function createMaterialTag(material) {
  const tag = document.createElement("span");
  tag.className = "material-tag";
  tag.textContent = material;
  return tag;
}

function showPatternInCatalog(patternName) {
  patternSearch.value = patternName;
  patternReviewFilter.value = "verified";
  patternLanguageFilter.value = "all";
  patternTypeFilter.value = "all";
  patternMaterialFilter.value = "all";
  patternSort.value = "recommended";
  catalogDisplayLimit = 12;
  renderPatternCatalog();
  setActiveView("catalog");
}

function formatPatternName(value) {
  const name = String(value || "")
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name || "Wzór bez nazwy";
}

function formatPatternLanguage(value) {
  if (value === "pl") return "Wzór po polsku";
  if (value === "en") return "Wzór po angielsku";
  return "Język nieustalony";
}

function formatProjectType(value) {
  return getProjectTypeLabel(value);
}

function readPatternFilters() {
  return {
    phrase: patternSearch.value,
    review: patternReviewFilter.value,
    language: patternLanguageFilter.value,
    type: patternTypeFilter.value,
    material: patternMaterialFilter.value,
  };
}

function createPatternFacetOption({ value, count, disabled }, getLabel) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = `${getLabel(value)} (${formatNumber(count)})`;
  option.disabled = disabled;
  return option;
}

function updatePatternFacetOptions(filters, facetCounts) {
  const catalogPatterns = catalogController.getState().items;
  const availableTypes = new Set(
    catalogPatterns.map((pattern) => pattern.projectType || "other")
  );
  const typeValues = [
    ...PROJECT_TYPE_ORDER,
    ...[...availableTypes].filter((type) => !PROJECT_TYPE_ORDER.includes(type)),
  ];
  if (filters.type !== "all" && !typeValues.includes(filters.type)) {
    typeValues.push(filters.type);
  }

  const materials = MATERIALS.map(({ value }) => value);
  if (filters.material !== "all" && !materials.includes(filters.material)) {
    materials.push(filters.material);
  }

  const typeOptions = buildPatternFacetOptions(
    typeValues,
    facetCounts.types,
    filters.type,
  ).map((option) =>
    createPatternFacetOption(option, getProjectTypeFilterLabel)
  );
  const materialOptions = buildPatternFacetOptions(
    materials,
    facetCounts.materials,
    filters.material,
  ).map((option) =>
    createPatternFacetOption(
      option,
      (value) => MATERIAL_LABEL_BY_VALUE.get(value) || value,
    )
  );
  const typeTotal = filterPatterns(catalogPatterns, filters, "type").length;
  const materialTotal = filterPatterns(
    catalogPatterns,
    filters,
    "material",
  ).length;

  patternTypeFilter.replaceChildren(
    Object.assign(document.createElement("option"), {
      value: "all",
      textContent: `Wszystkie typy (${formatNumber(typeTotal)})`,
    }),
    ...typeOptions
  );
  patternMaterialFilter.replaceChildren(
    Object.assign(document.createElement("option"), {
      value: "all",
      textContent: `Wszystkie materiały (${formatNumber(materialTotal)})`,
    }),
    ...materialOptions
  );
  patternTypeFilter.value = filters.type;
  patternMaterialFilter.value = filters.material;
}

function renderPatternCatalog() {
  const catalogState = catalogController.getState();
  const catalogPatterns = catalogState.items;
  const catalogVisibleLimit = catalogDisplayLimit;
  const filters = readPatternFilters();
  const phrase = filters.phrase.trim();
  const reviewFilter = filters.review;
  const languageFilter = filters.language;
  const typeFilter = filters.type;
  const materialFilter = filters.material;
  const sortMode = patternSort.value;
  updatePatternFacetOptions(
    filters,
    buildPatternFacetCounts(catalogPatterns, filters),
  );
  resetCatalogFiltersBtn.disabled =
    !phrase &&
    reviewFilter === "verified" &&
    languageFilter === "all" &&
    typeFilter === "all" &&
    materialFilter === "all" &&
    sortMode === "recommended";
  catalogFilterDisclosure.updateCount([
    reviewFilter !== "verified",
    languageFilter !== "all",
    typeFilter !== "all",
    materialFilter !== "all",
    sortMode !== "recommended",
  ].filter(Boolean).length);
  const matchingPatterns = filterPatterns(catalogPatterns, filters)
    .sort((left, right) => {
      const nameOrder = formatPatternName(left.name).localeCompare(
        formatPatternName(right.name),
        "pl"
      );
      if (sortMode === "name-asc") return nameOrder;
      if (sortMode === "name-desc") return -nameOrder;
      const statusOrder = Number(left.needsReview) - Number(right.needsReview);
      return statusOrder || nameOrder;
    });
  const visiblePatterns = matchingPatterns.slice(0, catalogVisibleLimit);

  const totalCatalog = Math.max(Number(catalogState.total) || 0, catalogPatterns.length);
  patternCatalogSummary.textContent = formatCatalogSummary({
    visible: visiblePatterns.length,
    matching: matchingPatterns.length,
    loaded: catalogPatterns.length,
    total: totalCatalog,
    complete: catalogState.hasMore === false,
  });
  patternCatalog.replaceChildren();
  patternCatalogActions.hidden = matchingPatterns.length === 0;
  loadMorePatternsBtn.hidden = visiblePatterns.length >= matchingPatterns.length;
  const revealCount = Math.min(12, Math.max(0, matchingPatterns.length - visiblePatterns.length));
  if (revealCount > 0) {
    const lastTwo = revealCount % 100;
    const last = revealCount % 10;
    const noun = revealCount === 1
      ? "kolejny wzór"
      : last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)
        ? "kolejne wzory"
        : "kolejnych wzorów";
    loadMorePatternsBtn.textContent = `Pokaż ${formatNumber(revealCount)} ${noun}`;
  }

  if (!visiblePatterns.length) {
    showMessage(
      patternCatalog,
      "Nie znaleziono wzorów spełniających te kryteria. Spróbuj poluzować jeden z filtrów.",
      "status",
      resetCatalogFiltersBtn.disabled
        ? null
        : { label: "Wyczyść filtry", onClick: resetPatternCatalogFilters },
    );
    return;
  }

  visiblePatterns.forEach((pattern) => {
    const card = patternTemplate.content.firstElementChild.cloneNode(true);
    const requirements = Array.isArray(pattern.yarnRequirements)
      ? pattern.yarnRequirements
      : [];
    const materials = Array.isArray(pattern.materials) ? pattern.materials : [];
    const title = card.querySelector("h3");

    title.textContent = formatPatternName(pattern.name);
    title.title = pattern.name || "";
    card
      .querySelector(".pattern-card__details summary")
      .setAttribute("aria-label", `Parametry włóczki: ${formatPatternName(pattern.name)}`);
    card.querySelector(".pattern-card__kicker").textContent =
      `${formatProjectType(pattern.projectType)} · ${formatPatternLanguage(pattern.sourceLanguage)}`;
    const description = card.querySelector(".pattern-card__description");
    description.textContent = pattern.description?.trim() || "";
    description.hidden = !description.textContent;
    if (pattern.officialSourceUrl) {
      try {
        const sourceUrl = new URL(pattern.officialSourceUrl, window.location.origin);
        if (sourceUrl.protocol === "https:") {
          const sourceLink = document.createElement("a");
          sourceLink.className = "pattern-card__source";
          sourceLink.textContent = "Oficjalne źródło";
          sourceLink.href = sourceUrl.href;
          sourceLink.target = "_blank";
          sourceLink.rel = "noopener noreferrer";
          description.after(sourceLink);
        }
      } catch {
        // Nie renderuj nieprawidłowego adresu źródłowego.
      }
    }
    card.querySelector(".pattern-card__facts").textContent =
      formatPatternYarnFact(pattern, formatRatio);

    const status = card.querySelector(".status-pill");
    status.textContent = pattern.needsReview ? "Do sprawdzenia" : "Zweryfikowany";
    status.classList.toggle("status-pill--review", pattern.needsReview);

    const tags = card.querySelector(".material-tags");
    if (materials.length) {
      tags.replaceChildren(...materials.map(createMaterialTag));
    } else {
      tags.replaceChildren(createMaterialTag("materiał nieustalony"));
    }

    const yarnList = card.querySelector(".pattern-card__yarns");
    if (requirements.length > 1) {
      yarnList.replaceChildren(
        ...requirements.map((requirement, index) =>
          createRequirement(formatRequirement(requirement, index))
        )
      );
    } else {
      yarnList.remove();
    }

    patternCatalog.appendChild(card);
  });
}

function renderPatternCatalogLoading() {
  const skeletons = Array.from({ length: 6 }, () =>
    patternSkeletonTemplate.content.firstElementChild.cloneNode(true)
  );
  patternCatalogSummary.textContent = "Pobieram i porządkuję wzory...";
  patternCatalog.replaceChildren(...skeletons);
  patternCatalog.setAttribute("aria-busy", "true");
  patternCatalogActions.hidden = true;
}

function hidePatternCatalogNotice() {
  patternCatalogNotice.hidden = true;
  patternCatalogNotice.replaceChildren();
  patternCatalogNotice.removeAttribute("aria-busy");
}

function showPartialPatternCatalog(error) {
  const catalogPatterns = catalogController.getState().items;
  const details = error && error.message
    ? ` ${error.message}`
    : " Katalog jest jeszcze pobierany.";
  patternCatalogNotice.hidden = false;
  showMessage(
    patternCatalogNotice,
    `Pokazujemy ${formatNumber(catalogPatterns.length)} pobranych wzorów.${details} Nie udało się pobrać reszty katalogu.`,
    "warning",
    {
      label: "Dokończ pobieranie",
      onClick: () =>
        refreshPatternCatalog({ resume: true }).catch(showPatternCatalogError),
    }
  );
}

function showPatternCatalogError(error) {
  hidePatternCatalogNotice();
  patternCatalogSummary.textContent = "";
  showMessage(
    patternCatalog,
    `${error.message} Katalog nie został odświeżony — spróbuj ponownie później.`,
    "error",
    {
      label: "Spróbuj ponownie",
      onClick: () => refreshPatternCatalog().catch(showPatternCatalogError),
    }
  );
}

async function refreshPatternCatalog({ resume = false } = {}) {
  if (!canAccessPrivateData()) return;
  if (resume) {
    patternCatalogNotice.hidden = false;
    showMessage(patternCatalogNotice, "Dokańczam pobieranie katalogu...", "loading");
  } else {
    renderPatternCatalogLoading();
  }
  try {
    const result = await loadPatternCatalog({
      resume,
      onPage: () => {
        renderPatternCatalog();
      },
    });
    renderPatternCatalog();
    if (result.complete) hidePatternCatalogNotice();
    else showPartialPatternCatalog(result.error);
  } finally {
    patternCatalog.removeAttribute("aria-busy");
  }
}

function showResultsError(message) {
  showMessage(results, message, "error", {
    label: "Spróbuj ponownie",
    onClick: () => findBtn.click(),
  });
}

async function renderResults() {
  if (!isAuthenticated) {
    showMessage(results, "Zaloguj się i dodaj włóczki, aby zobaczyć pasujące wzory.");
    return;
  }

  showMessage(results, "Pobieram dopasowane wzory...", "loading");
  try {
    const matches = await loadMatches();
    const matchScopeLimited = api.lastMatchScope === "subset";
    results.replaceChildren();
    markMatchesFresh();

    if (!matches.length) {
      showMessage(
        results,
        matchScopeLimited
          ? "Nie znaleziono dopasowania w analizowanym podzbiorze magazynu. Dodaj mniej motków do bieżącego zestawu albo spróbuj ponownie po dalszej optymalizacji rankingu."
          : "Brak pełnego dopasowania. Spróbuj dodać więcej metrów, większą wagę lub inny materiał."
      );
      return;
    }

    if (matchScopeLimited) {
      const notice = document.createElement("div");
      notice.className = "empty-state";
      notice.textContent = "Ranking użył najlepiej pasującego podzbioru motków. Pozostałe włóczki nadal są zapisane w Twoim magazynie.";
      results.appendChild(notice);
    }

    groupMatchesByPattern(matches).forEach((group) => {
      const card = resultTemplate.content.firstElementChild.cloneNode(true);
      const variantCount = group.variants.length;
      const bestScore = Math.max(...group.variants.map((item) => item.total));
      card.querySelector("h3").textContent = group.name;
      card.querySelector("h3").title = group.name;
      card.querySelector(".result-card__meta").textContent = formatVariantCount(variantCount);
      card.querySelector(".result-card__desc").textContent = group.description;
      card.querySelector(".score-pill").textContent = `Najlepiej ${bestScore}%`;
      const catalogLink = card.querySelector(".result-card__catalog-link");
      catalogLink.setAttribute("aria-label", `Zobacz ${group.name} w katalogu`);
      catalogLink.addEventListener("click", () => showPatternInCatalog(group.name));
      card
        .querySelector(".match-variants")
        .replaceChildren(
          ...group.variants.map((item, index) => createMatchVariant(item, index === 0))
        );
      results.appendChild(card);
    });
  } finally {
    results.removeAttribute("aria-busy");
  }
}

async function renderSummary(loadedYarns = null) {
  if (!isAuthenticated) {
    summary.textContent = "Twój prywatny magazyn pojawi się tutaj po zalogowaniu.";
    inventoryStats?.setAttribute("aria-busy", "false");
    return;
  }

  const yarns = loadedYarns || await loadYarns();
  const totalLength = yarns.reduce((sum, yarn) => sum + yarn.length, 0);
  const totalWeight = yarns.reduce((sum, yarn) => sum + yarn.weight, 0);
  const colorCount = new Set(yarns.map((yarn) => yarn.color).filter(Boolean)).size;
  const storageText = "Zapisane bezpiecznie na Twoim koncie.";

  inventoryStats?.setAttribute("aria-busy", "false");
  inventoryStatYarns.textContent = formatNumber(yarns.length);
  inventoryStatLength.textContent = formatNumber(totalLength);
  inventoryStatWeight.textContent = formatNumber(totalWeight);
  inventoryStatColors.textContent = formatNumber(colorCount);
  inventoryStats?.replaceChildren(
    inventoryStats.querySelector(".inventory-stat--coral"),
    inventoryStats.querySelector(".inventory-stat--lavender"),
    inventoryStats.querySelector(".inventory-stat--blue"),
    inventoryStats.querySelector(".inventory-stat--apricot"),
  );

  const yarnCount = document.createElement("strong");
  yarnCount.textContent = formatNumber(yarns.length);
  const length = document.createElement("strong");
  length.textContent = `${formatNumber(totalLength)} m`;
  const weight = document.createElement("strong");
  weight.textContent = `${formatNumber(totalWeight)} g`;

  summary.replaceChildren(
    yarnCount,
    document.createTextNode(" motków, "),
    length,
    document.createTextNode(" i "),
    weight,
    document.createTextNode(` łącznie. ${storageText}`)
  );
}

function setAuthMessage(message, kind = "") {
  authMessage.textContent = message;
  authMessage.dataset.kind = kind;
  authMessage.setAttribute("role", kind === "error" ? "alert" : "status");
  if (kind === "error" && message) {
    authMessage.focus({ preventScroll: true });
  }
}

function setDeleteAccountMessage(message, kind = "") {
  deleteAccountMessage.textContent = message;
  deleteAccountMessage.dataset.kind = kind;
  deleteAccountMessage.setAttribute("role", kind === "error" ? "alert" : "status");
  if (kind === "error" && message) {
    deleteAccountMessage.focus({ preventScroll: true });
  }
}

function setAuthBusy(form, busy) {
  form.querySelector('button[type="submit"]').disabled = busy;
  form.toggleAttribute("aria-busy", busy);
}

function showAuthForm(form) {
  [loginForm, registerForm, passwordResetForm, passwordUpdateForm].forEach((candidate) => {
    candidate.hidden = candidate !== form;
  });
  const isRecoveryForm = form === passwordResetForm || form === passwordUpdateForm;
  authModeSwitch.hidden = isRecoveryForm || isAuthenticated;
  loginModeBtn.setAttribute("aria-selected", String(form === loginForm));
  registerModeBtn.setAttribute("aria-selected", String(form === registerForm));
  loginModeBtn.tabIndex = form === loginForm ? 0 : -1;
  registerModeBtn.tabIndex = form === registerForm ? 0 : -1;
  authPanel.classList.toggle("auth-panel--recovery", form === passwordUpdateForm);
  renderCaptchaForForm(form).catch((error) => setAuthMessage(error.message, "error"));

  const content = new Map([
    [loginForm, ["Zaloguj się do Motka", "Wróć do swojego magazynu i rozpoczętych projektów."]],
    [registerForm, ["Załóż konto w Motku", "Zapisuj włóczki prywatnie i wracaj do nich na dowolnym urządzeniu."]],
    [passwordResetForm, ["Odzyskaj dostęp do konta", "Wyślemy bezpieczny link pozwalający ustawić nowe hasło."]],
    [passwordUpdateForm, ["Ustaw nowe hasło", "Wybierz nowe hasło, a następnie zaloguj się ponownie."]],
  ]);
  const [title, lead] = content.get(form);
  authTitle.textContent = title;
  authLead.textContent = lead;
}

async function startPasswordRecovery() {
  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken && hash.get("type") === "signup") {
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      setAuthMessage("Potwierdzam adres e-mail...");
      const confirmation = await api("/api/auth/confirmation", {
        method: "POST",
        body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      });
      applyIdleTimeout(confirmation);
      setAuthMessage("Adres e-mail został potwierdzony. Konto jest gotowe do użycia.", "success");
      return false;
    } catch (error) {
      setAuthMessage(`${error.message} Poproś o nowy link potwierdzający.`, "error");
      return true;
    }
  }
  const isRecoveryCallback = Boolean(code) && !(accessToken && refreshToken && hash.get("type") === "signup");
  if (!isRecoveryCallback) {
    return false;
  }
  // Usuń jednorazowy kod z adresu przed pierwszym żądaniem sieciowym.
  window.history.replaceState({}, document.title, window.location.pathname);

  try {
    setAuthMessage("Sprawdzam link odzyskiwania hasła...");
    const recovery = await api("/api/auth/recovery", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    applyIdleTimeout(recovery);
    window.history.replaceState({}, document.title, window.location.pathname);
    authForms.hidden = false;
    setActiveView("account", { focus: false });
    showAuthForm(passwordUpdateForm);
    passwordUpdateForm.scrollIntoView({ behavior: scrollBehavior, block: "center" });
    setAuthMessage("Ustaw nowe hasło.");
    window.setTimeout(() => {
      passwordUpdateForm.querySelector('input[name="password"]').focus({ preventScroll: true });
    }, 0);
    return true;
  } catch (error) {
    window.history.replaceState({}, document.title, window.location.pathname);
    showAuthForm(loginForm);
    setAuthMessage(`${error.message} Poproś o nowy link.`, "error");
    return true;
  }
}

function renderAuthState(payload) {
  const authenticated = Boolean(payload?.authenticated && payload.user);
  isAuthenticated = authenticated;
  const legalState = authenticated
    ? (payload.legal || { currentVersion: CURRENT_LEGAL_DOCUMENT.termsVersion, acceptedVersion: null, acceptanceRequired: true })
    : { currentVersion: CURRENT_LEGAL_DOCUMENT.termsVersion, acceptedVersion: CURRENT_LEGAL_DOCUMENT.termsVersion, acceptanceRequired: false };
  requiresLegalAcceptance = authenticated && legalAcceptanceController.setSessionLegalState(legalState);
  authForms.hidden = authenticated;
  authModeSwitch.hidden = authenticated;
  authLoggedIn.hidden = !authenticated;
  authUser.hidden = true;
  accountView.classList.toggle("is-authenticated", authenticated);
  document.body.classList.toggle("auth-logged-out", !authenticated);
  addYarnBtn.disabled = !authenticated;
  inventoryAddYarnBtn.disabled = !authenticated;
  findBtn.disabled = !authenticated;
  inventoryMatchBtn.disabled = !authenticated;
  updateNavigationState();
  headerAuthAction.textContent = authenticated ? "Wyloguj" : "Zaloguj";
  headerAuthAction.setAttribute("aria-label", authenticated ? "Wyloguj" : "Zaloguj");
  headerAuthAction.removeAttribute("title");
  if (!authenticated) {
    idleSessionController.stop();
    idleSessionWarning.hidden = true;
    deleteAccountDisclosure.open = false;
    onboardingDismissed = false;
    onboarding.hidden = true;
    patternCatalog.replaceChildren();
    patternCatalogSummary.textContent = "";
    results.replaceChildren();
    if (["inventory", "matches"].includes(activeView)) {
      setActiveView("account", { focus: false });
    }
  }

  if (!authenticated) {
    authUser.textContent = "";
    authUser.removeAttribute("title");
    authProfileSummary.textContent = "";
    deleteAccountForm.reset();
    setDeleteAccountMessage("");
    authLead.textContent = "Załóż konto, aby przygotować aplikację do prywatnego magazynu włóczek.";
    showAuthForm(loginForm);
    return;
  }

  const profile = payload.profile || {};
  authUser.textContent = "";
  authUser.removeAttribute("title");
  const profileEmail = profile.email || payload.user.email || "";
  authProfileSummary.textContent = profileEmail ? `Zalogowano jako: ${profileEmail}` : "Zalogowano jako:";
  authTitle.textContent = "Twoje konto";
  authLead.textContent = requiresLegalAcceptance
    ? "Potwierdź aktualny regulamin, aby wrócić do prywatnego magazynu."
    : "Profil i bezpieczeństwo Twojego prywatnego magazynu.";
  if (requiresLegalAcceptance) {
    yarnList.replaceChildren();
    summary.textContent = "Prywatny magazyn będzie dostępny po akceptacji aktualnych dokumentów.";
    patternCatalog.replaceChildren();
    patternCatalogSummary.textContent = "";
    results.replaceChildren();
    setActiveView("account", { focus: false });
  }
}

async function refreshAuthSession({ navigateToInventory = false } = {}) {
  let payload;
  try {
    payload = await api("/api/auth/session");
    applyIdleTimeout(payload);
  } catch (error) {
    renderAuthState({ authenticated: false });
    setAuthMessage(error.message, "error");
    return null;
  }

  renderAuthState(payload);
  if (!initialSessionResolved) {
    setActiveView(payload.authenticated ? "inventory" : "account", { focus: false });
    initialSessionResolved = true;
  }
  if (!payload.authenticated) {
    setAuthMessage("Możesz założyć konto lub zalogować się.");
    return payload;
  }

  idleSessionController.start();

  if (requiresLegalAcceptance) {
    setActiveView("account", { focus: false });
    return payload;
  }

  if (navigateToInventory) {
    setActiveView("inventory", { focus: false });
  }

  if (preserveDraftAfterLogin) {
    const requiresSave = preservedDraftRequiresSave;
    preserveDraftAfterLogin = false;
    preservedDraftRequiresSave = false;
    setActiveView("inventory", { focus: false });
    setAuthMessage(
      requiresSave
        ? "Zalogowano ponownie. Twoje zmiany są nadal w formularzu — sprawdź je i kliknij „Zapisz”."
        : "Zalogowano ponownie. Poprzednia operacja nie została wykonana — spróbuj ponownie.",
      "success"
    );
    setStorageMessage(
      requiresSave
        ? "Sesja została przywrócona. Sprawdź rozpoczęte zmiany i kliknij „Zapisz”."
        : "Sesja została przywrócona. Spróbuj ponownie wykonać ostatnią operację.",
      "success"
    );
    return;
  }

  try {
    await refresh();
  } catch (error) {
    setStorageMessage(
      `${error.message} Konto nadal jest zalogowane — spróbuj ponownie za chwilę.`,
      "error"
    );
    showResultsError(
      `${error.message} Nie udało się odświeżyć dopasowania. Spróbuj ponownie.`
    );
  }
  return payload;
}

async function submitAuthForm(form, endpoint, successMessage) {
  setAuthBusy(form, true);
  setAuthMessage("Przetwarzam...");
  try {
    const formData = new FormData(form);
    const kind = form === registerForm ? "register" : "login";
    const formValues = Object.fromEntries(formData.entries());
    const body = kind === "register"
      ? buildRegistrationAuthPayload({
        ...formValues,
        termsAccepted: registerForm.elements.termsAccepted.checked,
      }, {
        captchaEnabled: authCaptchaConfig.enabled,
        captchaToken: captchaTokens[kind],
        legalDocument: CURRENT_LEGAL_DOCUMENT,
      })
      : buildAuthPayload(formValues, {
        captchaEnabled: authCaptchaConfig.enabled,
        captchaToken: captchaTokens[kind],
      });
    const payload = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
    applyIdleTimeout(payload);
    if (payload.requiresEmailConfirmation) {
      renderAuthState({ authenticated: false });
      setAuthMessage("Konto utworzone. Potwierdź adres e-mail, aby się zalogować.");
    } else {
      setAuthMessage(successMessage, "success");
      await refreshAuthSession({ navigateToInventory: true });
      if (form === loginForm && authMessage.textContent === successMessage) {
        setAuthMessage("");
      }
    }
    form.reset();
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
    resetCaptchaForForm(form);
    setAuthBusy(form, false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitAuthForm(loginForm, "/api/auth/login", "Zalogowano.");
});

loginModeBtn.addEventListener("click", () => {
  showAuthForm(loginForm);
  setAuthMessage("");
  loginForm.querySelector('input[name="email"]').focus();
});

headerAuthAction.addEventListener("click", () => {
  if (isAuthenticated) {
    logoutBtn.click();
    return;
  }
  setActiveView("account");
  showAuthForm(loginForm);
  setAuthMessage("");
  loginForm.querySelector('input[name="email"]').focus({ preventScroll: true });
});

registerModeBtn.addEventListener("click", () => {
  showAuthForm(registerForm);
  setAuthMessage("");
  registerForm.querySelector('input[name="login"]').focus();
});

authModeSwitch.addEventListener("keydown", (event) => {
  const tabs = [loginModeBtn, registerModeBtn];
  const currentIndex = tabs.indexOf(document.activeElement);
  if (currentIndex === -1) return;

  let nextIndex = currentIndex;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  tabs[nextIndex].click();
  tabs[nextIndex].focus();
});
forgotPasswordBtn.addEventListener("click", () => {
  showAuthForm(passwordResetForm);
  setAuthMessage("Podaj adres e-mail, na który wyślemy instrukcję.");
  passwordResetForm.querySelector("input").focus();
});

cancelPasswordResetBtn.addEventListener("click", () => {
  showAuthForm(loginForm);
  setAuthMessage("");
  loginForm.querySelector('input[name="email"]').focus();
});

passwordResetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthBusy(passwordResetForm, true);
  setAuthMessage("Wysyłam instrukcję...");
  try {
    const body = buildAuthPayload(Object.fromEntries(new FormData(passwordResetForm).entries()), {
      captchaEnabled: authCaptchaConfig.enabled,
      captchaToken: captchaTokens.passwordReset,
    });
    const payload = await api("/api/auth/password-reset-request", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setAuthMessage(payload.message, "success");
    passwordResetForm.reset();
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
    resetCaptchaForForm(passwordResetForm);
    setAuthBusy(passwordResetForm, false);
  }
});

changePasswordToggle.addEventListener("click", () => {
  const isOpen = changePasswordForm.hidden;
  if (!isOpen) {
    changePasswordForm.reset();
  }
  changePasswordForm.hidden = !isOpen;
  changePasswordToggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    changePasswordForm.querySelector('input[name="currentPassword"]').focus();
    renderCaptchaForForm(changePasswordForm).catch((error) => setAuthMessage(error.message, "error"));
  }
});

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(changePasswordForm).entries());
  const passwordConfirmation = body.passwordConfirmation;
  if (body.password !== passwordConfirmation) {
    setAuthMessage("Wpisane hasła nie są zgodne.", "error");
    changePasswordForm.querySelector('input[name="passwordConfirmation"]').focus();
    return;
  }

  setAuthBusy(changePasswordForm, true);
  setAuthMessage("Zmieniam hasło...");
  try {
    await api("/api/auth/password/change", {
      method: "POST",
      body: JSON.stringify(buildAuthPayload({ currentPassword: body.currentPassword, password: body.password }, {
        captchaEnabled: authCaptchaConfig.enabled,
        captchaToken: captchaTokens.passwordChange,
      })),
    });
    changePasswordForm.reset();
    changePasswordForm.hidden = true;
    changePasswordToggle.setAttribute("aria-expanded", "false");
    renderAuthState({ authenticated: false });
    showAuthForm(loginForm);
    setAuthMessage("Hasło zmienione. Zaloguj się nowym hasłem.", "success");
  } catch {
    setAuthMessage("Nie udało się zmienić hasła. Spróbuj ponownie.", "error");
  } finally {
    setAuthBusy(changePasswordForm, false);
  }
});

passwordUpdateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthBusy(passwordUpdateForm, true);
  setAuthMessage("Zmieniam hasło...");
  try {
    const body = Object.fromEntries(new FormData(passwordUpdateForm).entries());
    await api("/api/auth/password", {
      method: "POST",
      body: JSON.stringify(body),
    });
    passwordUpdateForm.reset();
    showAuthForm(loginForm);
    renderAuthState({ authenticated: false });
    setAuthMessage("Hasło zmienione. Zaloguj się nowym hasłem.", "success");
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
    setAuthBusy(passwordUpdateForm, false);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitAuthForm(registerForm, "/api/auth/register", "Konto utworzone.");
});

logoutBtn.addEventListener("click", async () => {
  if (
    hasUnsavedYarnChanges() &&
    !window.confirm("Wylogować się? Niezapisane zmiany w magazynie zostaną utracone.")
  ) {
    return;
  }

  logoutBtn.disabled = true;
  idleSessionController.stop();
  idleSessionWarning.hidden = true;
  setAuthMessage("Wylogowuję...");
  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    preserveDraftAfterLogin = false;
    preservedDraftRequiresSave = false;
    renderAuthState({ authenticated: false });
    setActiveView("account");
    await refresh();
    setAuthMessage("Wylogowano.", "success");
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
    logoutBtn.disabled = false;
  }
});

idleSessionStayBtn.addEventListener("click", async () => {
  idleSessionStayBtn.disabled = true;
  try {
    const refreshed = await idleSessionController.markActivity({ force: true });
    if (refreshed) idleSessionWarning.hidden = true;
  } finally {
    idleSessionStayBtn.disabled = false;
  }
});

deleteAccountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!deleteAccountForm.reportValidity()) return;

  const submitButton = deleteAccountForm.querySelector('button[type="submit"]');
  const body = Object.fromEntries(new FormData(deleteAccountForm).entries());
  body.captchaToken = captchaTokens.deleteAccount;
  submitButton.disabled = true;
  deleteAccountForm.setAttribute("aria-busy", "true");
  setDeleteAccountMessage("Usuwam konto...");

  try {
    await api("/api/account", {
      method: "DELETE",
      body: JSON.stringify(body),
    });
    yarnList.replaceChildren();
    renderYarnEmptyState();
    summary.textContent = "Twój prywatny magazyn pojawi się tutaj po zalogowaniu.";
    yarnVersion = null;
    preserveDraftAfterLogin = false;
    preservedDraftRequiresSave = false;
    renderAuthState({ authenticated: false });
    setActiveView("account");
    setAuthMessage("Konto i zapisane dane zostały usunięte.", "success");
  } catch (error) {
    setDeleteAccountMessage(error.message, "error");
  } finally {
    resetCaptchaForForm(deleteAccountForm);
    deleteAccountForm.removeAttribute("aria-busy");
    submitButton.disabled = false;
  }
});

deleteAccountDisclosure.addEventListener("toggle", () => {
  if (deleteAccountDisclosure.open) {
    renderCaptchaForForm(deleteAccountForm).catch((error) => setDeleteAccountMessage(error.message, "error"));
  }
});

async function refresh() {
  if (!canAccessPrivateData()) return;
  const refreshGeneration = ++yarnRefreshGeneration;
  const busyGeneration = ++yarnRefreshBusyGeneration;
  yarnList.setAttribute("aria-busy", "true");
  summary.setAttribute("aria-busy", "true");
  try {
    const yarns = await loadYarns();
    if (refreshGeneration !== yarnRefreshGeneration) return;
    yarnList.replaceChildren();
    if (yarns.length) {
      yarns.forEach(addYarnCard);
    } else {
      renderYarnEmptyState();
    }
    renderOnboarding(yarns);
    await renderSummary(yarns);
    await renderResults();
  } finally {
    if (busyGeneration === yarnRefreshBusyGeneration) {
      yarnList.removeAttribute("aria-busy");
      summary.removeAttribute("aria-busy");
    }
  }
}

addYarnBtn.addEventListener("click", () => {
  yarnRefreshGeneration += 1;
  const { card, created } = ensureSingleNewYarnCard(
    yarnList.querySelectorAll(".yarn-card"),
    () => {
      yarnList.querySelector(".yarn-empty-state")?.remove();
      onboarding.hidden = true;
      return addYarnCard({}, { isNew: true });
    },
  );

  if (!created) {
    setStorageMessage("Formularz nowego motka jest już otwarty.");
  }
  card.scrollIntoView({ behavior: scrollBehavior, block: "center" });
  card.querySelector('[data-field="name"]').focus();
});

inventoryAddYarnBtn.addEventListener("click", () => {
  addYarnBtn.click();
});

onboardingAddYarnBtn.addEventListener("click", () => {
  onboarding.hidden = true;
  addYarnBtn.click();
});

onboardingSkipBtn.addEventListener("click", () => {
  onboardingDismissed = true;
  onboarding.hidden = true;
});

inventoryMatchBtn.addEventListener("click", () => {
  setActiveView("matches");
  findBtn.click();
});

backToInventoryBtn.addEventListener("click", () => {
  setActiveView("inventory");
});

findBtn.addEventListener("click", async () => {
  setActiveView("matches", { focus: false });
  try {
    if (yarnList.querySelector('.yarn-card[data-saved="false"]')) {
      showMessage(results, "Uzupełnij dane nowego motka i kliknij „Zapisz”, zanim uruchomisz dopasowanie.");
      return;
    }
    if (yarnList.querySelector('.yarn-card[data-editing="true"]')) {
      showMessage(results, "Zapisz albo anuluj modyfikację motka, zanim uruchomisz dopasowanie.");
      return;
    }
    findBtn.disabled = true;
    refreshStaleMatchesBtn.disabled = true;
    findBtn.textContent = "Dobieram...";
    showMessage(results, "Pobieram dopasowane wzory...", "loading");
    await refresh();
    document.getElementById("matchesTitle").scrollIntoView({ behavior: scrollBehavior, block: "start" });
  } catch (error) {
    showResultsError(error.message);
  } finally {
    findBtn.disabled = false;
    refreshStaleMatchesBtn.disabled = false;
    findBtn.textContent = "Dobierz wzór";
  }
});

refreshStaleMatchesBtn.addEventListener("click", () => {
  findBtn.click();
});

function resetPatternCatalogView() {
  catalogDisplayLimit = 12;
  renderPatternCatalog();
}

function resetPatternCatalogFilters() {
  patternSearch.value = "";
  patternReviewFilter.value = "verified";
  patternLanguageFilter.value = "all";
  patternTypeFilter.value = "all";
  patternMaterialFilter.value = "all";
  patternSort.value = "recommended";
  resetPatternCatalogView();
  patternSearch.focus({ preventScroll: true });
}

patternSearch.addEventListener("input", resetPatternCatalogView);
patternReviewFilter.addEventListener("change", resetPatternCatalogView);
patternLanguageFilter.addEventListener("change", resetPatternCatalogView);
patternTypeFilter.addEventListener("change", resetPatternCatalogView);
patternMaterialFilter.addEventListener("change", resetPatternCatalogView);
patternSort.addEventListener("change", resetPatternCatalogView);
resetCatalogFiltersBtn.addEventListener("click", resetPatternCatalogFilters);
loadMorePatternsBtn.addEventListener("click", async () => {
  const catalogState = catalogController.getState();
  if (catalogDisplayLimit < filterPatterns(catalogState.items, readPatternFilters()).length) {
    catalogDisplayLimit += 12;
    renderPatternCatalog();
    return;
  }
  if (!catalogState.hasMore || patternCatalog.hasAttribute("aria-busy")) return;
  await refreshPatternCatalog({ resume: true });
});
backToCatalogFiltersBtn.addEventListener("click", () => {
  document.getElementById("catalogFilters").scrollIntoView({
    behavior: scrollBehavior,
    block: "center",
  });
  patternSearch.focus({ preventScroll: true });
});

detectRuntimeMode()
  .then(async () => {
    const recoveryHandled = await startPasswordRecovery();
    await initializeCaptcha().catch((error) => setAuthMessage(error.message, "error"));
    if (recoveryHandled) return;
    const session = await refreshAuthSession();
    if (session?.authenticated && canAccessPrivateData()) {
      await refreshPatternCatalog().catch(showPatternCatalogError);
    }
  })
  .catch((error) => {
    showMessage(results, error.message, "error");
  });
/* global MotekDomUtils, createCatalogController */
