const yarnTemplate = document.getElementById("yarnTemplate");
const resultTemplate = document.getElementById("resultTemplate");
const patternSkeletonTemplate = document.getElementById("patternSkeletonTemplate");
const yarnList = document.getElementById("yarnList");
const results = document.getElementById("results");
const summary = document.getElementById("summary");
const storageMessage = document.getElementById("storageMessage");
const addYarnBtn = document.getElementById("addYarnBtn");
const findBtn = document.getElementById("findBtn");
const patternTemplate = document.getElementById("patternTemplate");
const patternSearch = document.getElementById("patternSearch");
const patternReviewFilter = document.getElementById("patternReviewFilter");
const patternLanguageFilter = document.getElementById("patternLanguageFilter");
const patternMaterialFilter = document.getElementById("patternMaterialFilter");
const patternSort = document.getElementById("patternSort");
const patternCatalogSummary = document.getElementById("patternCatalogSummary");
const patternCatalog = document.getElementById("patternCatalog");
const patternCatalogActions = document.getElementById("patternCatalogActions");
const loadMorePatternsBtn = document.getElementById("loadMorePatternsBtn");
const backToCatalogFiltersBtn = document.getElementById("backToCatalogFiltersBtn");
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
const authLead = document.getElementById("authLead");
const authTitle = document.getElementById("authTitle");
const onboarding = document.getElementById("onboarding");
const onboardingAddYarnBtn = document.getElementById("onboardingAddYarnBtn");
const onboardingSkipBtn = document.getElementById("onboardingSkipBtn");
const logoutBtn = document.getElementById("logoutBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const passwordResetForm = document.getElementById("passwordResetForm");
const passwordUpdateForm = document.getElementById("passwordUpdateForm");
const cancelPasswordResetBtn = document.getElementById("cancelPasswordResetBtn");
const accountView = document.getElementById("accountView");
const headerUser = document.getElementById("headerUser");
const appViews = [...document.querySelectorAll(".app-view")];
const viewButtons = [...document.querySelectorAll("[data-view-target]")];
const inventoryMatchBtn = document.getElementById("inventoryMatchBtn");
const backToInventoryBtn = document.getElementById("backToInventoryBtn");
const heroAuthBtn = document.getElementById("heroAuthBtn");

let baseUrl = window.location.origin;
let isAuthenticated = false;
let autosaveTimer = null;
let autosaveInFlight = null;
let autosavePending = false;
let catalogPatterns = [];
let yarnVersion = null;
let onboardingDismissed = false;
let yarnFormSequence = 0;
let activeView = "account";
let initialSessionResolved = false;
let catalogVisibleLimit = 12;

function setActiveView(requestedView, { focus = true } = {}) {
  const protectedViews = new Set(["inventory", "matches"]);
  const view = !isAuthenticated && protectedViews.has(requestedView)
    ? "account"
    : requestedView;
  const target = appViews.find((candidate) => candidate.dataset.view === view);
  if (!target) return;

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
    window.scrollTo({ top: 0, behavior: "smooth" });
    target.querySelector("h1, h2")?.focus({ preventScroll: true });
  }
}

function updateNavigationState() {
  viewButtons.forEach((button) => {
    const protectedView =
      button.classList.contains("app-nav__button") &&
      ["inventory", "matches"].includes(button.dataset.viewTarget);
    button.disabled = protectedView && !isAuthenticated;
  });
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.viewTarget));
});

heroAuthBtn.addEventListener("click", () => {
  authPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    loginForm.querySelector('input[name="email"]').focus({ preventScroll: true });
  }, 250);
});

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

  const { headers: optionHeaders = {}, ...requestOptions } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: "same-origin",
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...optionHeaders,
    },
  });

  if (!response.ok && response.status !== 204) {
    let message = "";
    try {
      const payload = await response.clone().json();
      message = typeof payload?.error === "string" ? payload.error.trim() : "";
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(message || "Nie udało się połączyć z Motkiem. Spróbuj ponownie.");
  }

  if (path === "/api/yarns" || path.startsWith("/api/yarns/")) {
    yarnVersion = response.headers.get("etag") || yarnVersion;
  }

  api.lastMatchScope = path === "/api/matches"
    ? response.headers.get("X-Motek-Match-Scope") || "full"
    : null;
  return response.status === 204 ? null : response.json();
}

function showMessage(container, message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.textContent = message;
  container.replaceChildren(element);
}

function setStorageMessage(message, kind = "") {
  storageMessage.textContent = message;
  storageMessage.dataset.kind = kind;
}

function createRequirement(text) {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
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
  meta.textContent =
    `${formatSkeinCount(item.pattern.yarnsNeeded)}, min. ${item.pattern.metersNeeded} m, ${item.pattern.gramsNeeded} g`;

  const requirements = document.createElement("ul");
  requirements.className = "requirements";
  requirements.replaceChildren(
    createRequirement(`Materiały: ${item.pattern.materials.join(", ")}`),
    createRequirement(`Grubości: ${item.pattern.weightClasses.join(", ")}`),
    createRequirement(`Pasujące włóczki w Twoim zestawie: ${item.matchedYarns}`)
  );

  details.append(header, meta, requirements);
  return details;
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    flushAutosave();
  }, 350);
}

async function flushAutosave() {
  if (autosaveInFlight) {
    autosavePending = true;
    return;
  }

  setStorageMessage("Zapisuję magazyn...");
  try {
    do {
      autosavePending = false;
      autosaveInFlight = saveYarns()
        .then((savedYarns) => {
          syncDomIds(savedYarns);
          return renderSummary();
        })
        .finally(() => {
          autosaveInFlight = null;
        });
      await autosaveInFlight;
    } while (autosavePending);
    setStorageMessage("Magazyn zapisany.", "success");
  } catch (error) {
    autosavePending = false;
    setStorageMessage(
      `${error.message} Zmiany pozostały w formularzu — popraw połączenie i spróbuj ponownie.`,
      "error"
    );
  }
}

function collectYarnFromCard(card) {
  return {
    id: card.dataset.id ? Number(card.dataset.id) : null,
    name: card.querySelector('[data-field="name"]').value.trim(),
    color: card.querySelector('[data-field="color"]').value.trim(),
    material: card.querySelector('[data-field="material"]').value,
    weightClass: card.querySelector('[data-field="weightClass"]').value,
    length: Number(card.querySelector('[data-field="length"]').value || 0),
    weight: Number(card.querySelector('[data-field="weight"]').value || 0),
  };
}

function updateYarnCardSummary(card) {
  const yarn = collectYarnFromCard(card);
  const name = card.querySelector('[data-summary="name"]');
  const details = card.querySelector('[data-summary="details"]');
  const swatch = card.querySelector(".yarn-card__swatch");

  name.textContent = yarn.name || "Nowy motek";
  details.textContent = yarn.color
    ? `${yarn.color} · ${yarn.material} · ${yarn.weightClass} · ${yarn.length} m · ${yarn.weight} g`
    : "Uzupełnij dane włóczki";
  swatch.title = yarn.color ? `Kolor: ${yarn.color}` : "Nowa włóczka";
}

function isYarnComplete(card) {
  return [...card.querySelectorAll("[data-field]")].every((field) => field.checkValidity()) &&
    card.querySelector('[data-field="name"]').value.trim() !== "" &&
    card.querySelector('[data-field="color"]').value.trim() !== "";
}

function isYarnChanged(card) {
  return JSON.stringify(collectYarnFromCard(card)) !== JSON.stringify(card._originalYarn);
}

function setYarnFieldsDisabled(card, disabled) {
  card.querySelectorAll("[data-field]").forEach((field) => {
    field.disabled = disabled;
  });
}

function updateYarnSaveButton(card) {
  const saveButton = card.querySelector(".yarn-save");
  const cancelButton = card.querySelector(".yarn-cancel");
  const complete = isYarnComplete(card);
  const isNew = card.dataset.saved !== "true";
  const isEditing = isNew || card.dataset.editing === "true";
  const changed = isNew || isYarnChanged(card);
  card.querySelector(".yarn-edit").hidden = isNew || isEditing;
  cancelButton.hidden = !isEditing;
  cancelButton.textContent = isNew ? "Anuluj dodawanie" : "Anuluj";
  saveButton.hidden = !isEditing || !complete || !changed;
  saveButton.disabled = !complete || !changed;
}

async function saveNewYarn(card) {
  const saveButton = card.querySelector(".yarn-save");
  if (!isYarnComplete(card)) {
    card.querySelector('[data-field="name"]').reportValidity();
    return;
  }

  saveButton.disabled = true;
  setStorageMessage("Zapisuję motek...");
  try {
    const savedYarn = await api("/api/yarns", {
      method: "POST",
      headers: { "If-Match": yarnVersion },
      body: JSON.stringify(collectYarnFromCard(card)),
    });
    card.dataset.id = savedYarn.id;
    card.dataset.saved = "true";
    card.dataset.editing = "false";
    card._originalYarn = collectYarnFromCard(card);
    setYarnFieldsDisabled(card, true);
    updateYarnCardSummary(card);
    updateYarnSaveButton(card);
    setStorageMessage("Motek zapisany w magazynie.", "success");
    await renderSummary();
    renderOnboarding(collectYarnsFromDom());
  } catch (error) {
    saveButton.disabled = false;
    setStorageMessage(`${error.message} Motek pozostał w formularzu.`, "error");
  }
}

async function saveExistingYarn(card) {
  const saveButton = card.querySelector(".yarn-save");
  if (!isYarnComplete(card) || !isYarnChanged(card)) return;

  saveButton.disabled = true;
  setStorageMessage("Zapisuję zmiany motka...");
  try {
    await api(`/api/yarns/${card.dataset.id}`, {
      method: "PATCH",
      headers: { "If-Match": yarnVersion },
      body: JSON.stringify(collectYarnFromCard(card)),
    });
    card._originalYarn = collectYarnFromCard(card);
    card.dataset.editing = "false";
    setYarnFieldsDisabled(card, true);
    updateYarnCardSummary(card);
    updateYarnSaveButton(card);
    setStorageMessage("Zmiany motka zapisane.", "success");
    await renderSummary();
  } catch (error) {
    saveButton.disabled = false;
    setStorageMessage(`${error.message} Zmiany pozostały w formularzu.`, "error");
  }
}

function addYarnCard(yarn = {}, { isNew = false } = {}) {
  const node = yarnTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = yarn.id || "";
  node.dataset.saved = isNew ? "false" : "true";
  node.dataset.editing = isNew ? "true" : "false";
  node.querySelector('[data-field="name"]').value = yarn.name || "";
  node.querySelector('[data-field="color"]').value = yarn.color || "";
  node.querySelector('[data-field="material"]').value = yarn.material || "wełna";
  node.querySelector('[data-field="weightClass"]').value = yarn.weightClass || "dk";
  node.querySelector('[data-field="length"]').value = isNew ? "" : yarn.length ?? 0;
  node.querySelector('[data-field="weight"]').value = isNew ? "" : yarn.weight ?? 0;
  node._originalYarn = isNew ? null : collectYarnFromCard(node);
  node.querySelectorAll("[data-field]").forEach((field) => {
    field.id = `yarn-${++yarnFormSequence}-${field.dataset.field}`;
    field.closest("label").htmlFor = field.id;
  });

  node.querySelector(".yarn-remove").addEventListener("click", async () => {
    const isSaved = node.dataset.saved === "true";
    const yarnName = collectYarnFromCard(node).name || "tę włóczkę";
    if (isSaved && !window.confirm(`Usunąć „${yarnName}” z magazynu? Tej operacji nie można cofnąć.`)) {
      return;
    }

    try {
      if (!isSaved) {
        node.remove();
        if (!yarnList.children.length) renderYarnEmptyState();
        setStorageMessage("Anulowano dodawanie nowego motka.");
        return;
      }

      setStorageMessage("Usuwam włóczkę...");
      if (node.dataset.id) {
        await deleteYarn(node.dataset.id);
      }
      node.remove();
      await refresh();
      setStorageMessage(`Usunięto „${yarnName}”.`, "success");
    } catch (error) {
      setStorageMessage(
        `${error.message} Włóczka pozostała w formularzu.`,
        "error"
      );
    }
  });

  node.querySelector(".yarn-save").addEventListener("click", () => {
    if (node.dataset.saved === "true") saveExistingYarn(node);
    else saveNewYarn(node);
  });
  node.querySelector(".yarn-edit").addEventListener("click", () => {
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

    Object.entries(node._originalYarn).forEach(([field, value]) => {
      if (field === "id") return;
      node.querySelector(`[data-field="${field}"]`).value = value;
    });
    node.dataset.editing = "false";
    setYarnFieldsDisabled(node, true);
    updateYarnCardSummary(node);
    updateYarnSaveButton(node);
  });

  node.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("input", () => {
      field.removeAttribute("aria-invalid");
      updateYarnSaveButton(node);
    });
    field.addEventListener("change", () => updateYarnSaveButton(node));
    field.addEventListener("invalid", () => field.setAttribute("aria-invalid", "true"));
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

document.querySelectorAll("label").forEach((label) => {
  const field = label.querySelector("input, select");
  if (field?.id) label.htmlFor = field.id;
});

async function loadYarns() {
  if (!isAuthenticated) return [];
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
    loginForm.scrollIntoView({ behavior: "smooth", block: "center" });
    loginForm.querySelector('input[name="email"]').focus({ preventScroll: true });
  });
  emptyState.appendChild(action);
  yarnList.appendChild(emptyState);
}

function renderOnboarding(yarns) {
  onboarding.hidden = !isAuthenticated || yarns.length > 0 || onboardingDismissed;
}

async function saveYarns() {
  const local = collectYarnsFromDom();

  if (!isAuthenticated) {
    throw new Error("Zaloguj się, aby zapisywać włóczki w swoim magazynie.");
  }

  const existing = await api("/api/yarns");
  const localIds = new Set(local.filter((yarn) => yarn.id).map((yarn) => yarn.id));

  for (const yarn of existing) {
    if (!localIds.has(yarn.id)) {
      await api(`/api/yarns/${yarn.id}`, {
        method: "DELETE",
        headers: { "If-Match": yarnVersion },
      });
    }
  }

  const savedYarns = [];
  for (const yarn of local) {
    const body = { ...yarn };
    delete body.id;
    savedYarns.push(yarn.id
      ? await api(`/api/yarns/${yarn.id}`, {
          method: "PATCH",
          headers: { "If-Match": yarnVersion },
          body: JSON.stringify(body),
        })
      : await api("/api/yarns", {
          method: "POST",
          headers: { "If-Match": yarnVersion },
          body: JSON.stringify(body),
        }));
  }
  return savedYarns;
}

async function deleteYarn(id) {
  if (!isAuthenticated) {
    throw new Error("Zaloguj się, aby zmieniać swój magazyn włóczek.");
  }
  await api(`/api/yarns/${id}`, {
    method: "DELETE",
    headers: { "If-Match": yarnVersion },
  });
}

function syncDomIds(savedYarns) {
  const cards = [...yarnList.querySelectorAll(".yarn-card")];
  cards.forEach((card, index) => {
    card.dataset.id = savedYarns[index]?.id || "";
  });
}

async function loadMatches() {
  if (!isAuthenticated) return [];
  return api("/api/matches");
}

async function loadPatternCatalog() {
  const patterns = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await api(`/api/patterns?limit=50&offset=${offset}`);
    patterns.push(...page.items);
    hasMore = page.hasMore;
    offset += page.items.length;
    if (!page.items.length) break;
  }

  return patterns;
}

function formatRatio(value) {
  const ratio = Number(value);
  return Number.isFinite(ratio) && ratio > 0
    ? `${ratio.toLocaleString("pl-PL")} m/100 g`
    : "brak danych";
}

function formatSkeinCount(value) {
  const count = Number(value) || 0;
  const lastTwo = count % 100;
  const last = count % 10;
  if (count === 1) return "1 motek";
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
    return `${count} motki`;
  }
  return `${count} motków`;
}

function formatVariantCount(value) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (value === 1) return "1 pasujący rozmiar";
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
    return `${value} pasujące rozmiary`;
  }
  return `${value} pasujących rozmiarów`;
}

function formatRequirement(requirement, index) {
  const name = requirement.yarn_name || `Włóczka ${index + 1}`;
  const role = requirement.option
    ? `${requirement.role || "główna"}, ${requirement.option}`
    : requirement.role || "główna";
  const materials = Array.isArray(requirement.materials)
    ? requirement.materials.join(", ")
    : "";
  const details = [materials, formatRatio(requirement.meters_per_100g)]
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

function populatePatternMaterialFilter() {
  const materials = [...new Set(
    catalogPatterns.flatMap((pattern) =>
      Array.isArray(pattern.materials) ? pattern.materials : []
    )
  )]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "pl"));
  const options = materials.map((material) => {
    const option = document.createElement("option");
    option.value = material;
    option.textContent = material;
    return option;
  });
  patternMaterialFilter.replaceChildren(
    Object.assign(document.createElement("option"), {
      value: "all",
      textContent: "Wszystkie materiały",
    }),
    ...options
  );
}

function renderPatternCatalog() {
  const phrase = patternSearch.value.trim().toLocaleLowerCase("pl");
  const reviewFilter = patternReviewFilter.value;
  const languageFilter = patternLanguageFilter.value;
  const materialFilter = patternMaterialFilter.value;
  const sortMode = patternSort.value;
  const matchingPatterns = catalogPatterns
    .filter((pattern) => {
      const searchable = [
        pattern.name,
        pattern.description,
        ...(Array.isArray(pattern.materials) ? pattern.materials : []),
      ]
        .join(" ")
        .toLocaleLowerCase("pl");
      const matchesPhrase = !phrase || searchable.includes(phrase);
      const matchesStatus =
        reviewFilter === "all" ||
        (reviewFilter === "review" && pattern.needsReview) ||
        (reviewFilter === "verified" && !pattern.needsReview);
      const matchesLanguage =
        languageFilter === "all" || pattern.sourceLanguage === languageFilter;
      const matchesMaterial =
        materialFilter === "all" ||
        (Array.isArray(pattern.materials) &&
          pattern.materials.includes(materialFilter));
      return matchesPhrase && matchesStatus && matchesLanguage && matchesMaterial;
    })
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

  patternCatalogSummary.textContent =
    `Pokazano ${visiblePatterns.length} z ${matchingPatterns.length} pasujących wzorów. ` +
    `Cały katalog: ${catalogPatterns.length}.`;
  patternCatalog.replaceChildren();
  patternCatalogActions.hidden = matchingPatterns.length === 0;
  loadMorePatternsBtn.hidden = visiblePatterns.length >= matchingPatterns.length;

  if (!visiblePatterns.length) {
    showMessage(patternCatalog, "Nie znaleziono wzorów spełniających te kryteria.");
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
    card.querySelector(".pattern-card__kicker").textContent =
      formatPatternLanguage(pattern.sourceLanguage);
    card.querySelector(".pattern-card__description").textContent =
      pattern.description;
    card.querySelector(".pattern-card__facts").textContent =
      `Główna włóczka: ${formatRatio(pattern.metersPer100g)}`;

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

async function refreshPatternCatalog() {
  renderPatternCatalogLoading();
  try {
    catalogPatterns = await loadPatternCatalog();
    populatePatternMaterialFilter();
    renderPatternCatalog();
  } finally {
    patternCatalog.removeAttribute("aria-busy");
  }
}

async function renderResults() {
  if (!isAuthenticated) {
    showMessage(results, "Zaloguj się i dodaj włóczki, aby zobaczyć pasujące wzory.");
    return;
  }

  const matches = await loadMatches();
  const matchScopeLimited = api.lastMatchScope === "subset";
  results.replaceChildren();

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
    card.querySelector(".result-card__meta").textContent = formatVariantCount(variantCount);
    card.querySelector(".result-card__desc").textContent = group.description;
    card.querySelector(".score-pill").textContent = `Najlepiej ${bestScore}%`;
    card
      .querySelector(".match-variants")
      .replaceChildren(
        ...group.variants.map((item, index) => createMatchVariant(item, index === 0))
      );
    results.appendChild(card);
  });
}

async function renderSummary() {
  if (!isAuthenticated) {
    summary.textContent = "Twój prywatny magazyn pojawi się tutaj po zalogowaniu.";
    return;
  }

  const yarns = await loadYarns();
  const totalLength = yarns.reduce((sum, yarn) => sum + yarn.length, 0);
  const totalWeight = yarns.reduce((sum, yarn) => sum + yarn.weight, 0);
  const storageText = "Zapisane bezpiecznie na Twoim koncie.";

  const yarnCount = document.createElement("strong");
  yarnCount.textContent = String(yarns.length);
  const length = document.createElement("strong");
  length.textContent = `${totalLength} m`;
  const weight = document.createElement("strong");
  weight.textContent = `${totalWeight} g`;

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

function setAuthBusy(form, busy) {
  form.querySelector('button[type="submit"]').disabled = busy;
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
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken || !refreshToken || new URLSearchParams(window.location.search).get("recovery") !== "1") {
    return false;
  }

  try {
    setAuthMessage("Sprawdzam link odzyskiwania hasła...");
    await api("/api/auth/recovery", {
      method: "POST",
      body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
    });
    window.history.replaceState({}, document.title, window.location.pathname);
    authForms.hidden = false;
    setActiveView("account", { focus: false });
    showAuthForm(passwordUpdateForm);
    passwordUpdateForm.scrollIntoView({ behavior: "smooth", block: "center" });
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
  authForms.hidden = authenticated;
  authModeSwitch.hidden = authenticated;
  authLoggedIn.hidden = !authenticated;
  authUser.hidden = !authenticated;
  accountView.classList.toggle("is-authenticated", authenticated);
  addYarnBtn.disabled = !authenticated;
  findBtn.disabled = !authenticated;
  inventoryMatchBtn.disabled = !authenticated;
  updateNavigationState();
  if (!authenticated) {
    onboardingDismissed = false;
    onboarding.hidden = true;
    headerUser.hidden = true;
    headerUser.textContent = "";
    if (["inventory", "matches"].includes(activeView)) {
      setActiveView("account", { focus: false });
    }
  }

  if (!authenticated) {
    authUser.textContent = "";
    authProfileSummary.textContent = "";
    authLead.textContent = "Załóż konto, aby przygotować aplikację do prywatnego magazynu włóczek.";
    showAuthForm(loginForm);
    return;
  }

  const profile = payload.profile || {};
  const login = profile.login || payload.user.metadata?.login || payload.user.email;
  authUser.textContent = `Zalogowano jako ${login}`;
  headerUser.textContent = login;
  headerUser.hidden = false;
  authProfileSummary.textContent = profile.full_name
    ? `${profile.full_name} (${profile.email || payload.user.email})`
    : profile.email || payload.user.email || "Zalogowany użytkownik";
  authTitle.textContent = "Twoje konto";
  authLead.textContent = "Profil i bezpieczeństwo Twojego prywatnego magazynu.";
}

async function refreshAuthSession() {
  try {
    const payload = await api("/api/auth/session");
    renderAuthState(payload);
    if (!initialSessionResolved) {
      setActiveView(payload.authenticated ? "inventory" : "account", { focus: false });
      initialSessionResolved = true;
    }
    if (!payload.authenticated) {
      setAuthMessage("Możesz założyć konto lub zalogować się.");
    } else {
      await refresh();
    }
  } catch (error) {
    renderAuthState({ authenticated: false });
    setAuthMessage(error.message, "error");
  }
}

async function submitAuthForm(form, endpoint, successMessage) {
  setAuthBusy(form, true);
  setAuthMessage("Przetwarzam...");
  try {
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    const payload = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
    renderAuthState({
      authenticated: Boolean(payload.user && !payload.requiresEmailConfirmation),
      user: payload.user,
      profile: null,
    });
    if (payload.requiresEmailConfirmation) {
      setAuthMessage("Konto utworzone. Potwierdź adres e-mail, aby się zalogować.");
    } else {
      setAuthMessage(successMessage, "success");
      await refreshAuthSession();
      setActiveView("inventory");
    }
    form.reset();
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
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
    const body = Object.fromEntries(new FormData(passwordResetForm).entries());
    const payload = await api("/api/auth/password-reset-request", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setAuthMessage(payload.message, "success");
    passwordResetForm.reset();
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
    setAuthBusy(passwordResetForm, false);
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
  logoutBtn.disabled = true;
  setAuthMessage("Wylogowuję...");
  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
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

async function refresh() {
  const yarns = await loadYarns();
  yarnList.replaceChildren();
  if (yarns.length) {
    yarns.forEach(addYarnCard);
  } else {
    renderYarnEmptyState();
  }
  renderOnboarding(yarns);
  await renderSummary();
  await renderResults();
}

addYarnBtn.addEventListener("click", async () => {
  yarnList.querySelector(".yarn-empty-state")?.remove();
  onboarding.hidden = true;
  const card = addYarnCard({}, { isNew: true });
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.querySelector('[data-field="name"]').focus();
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
    findBtn.textContent = "Dobieram...";
    showMessage(results, "Zapisuję włóczki...");
    await saveYarns();
    showMessage(results, "Pobieram dopasowane wzory...");
    await refresh();
    document.getElementById("matchesTitle").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showMessage(results, error.message);
  } finally {
    findBtn.disabled = false;
    findBtn.textContent = "Dobierz wzór";
  }
});

function resetPatternCatalogView() {
  catalogVisibleLimit = 12;
  renderPatternCatalog();
}

patternSearch.addEventListener("input", resetPatternCatalogView);
patternReviewFilter.addEventListener("change", resetPatternCatalogView);
patternLanguageFilter.addEventListener("change", resetPatternCatalogView);
patternMaterialFilter.addEventListener("change", resetPatternCatalogView);
patternSort.addEventListener("change", resetPatternCatalogView);
loadMorePatternsBtn.addEventListener("click", () => {
  catalogVisibleLimit += 12;
  renderPatternCatalog();
});
backToCatalogFiltersBtn.addEventListener("click", () => {
  document.getElementById("catalogFilters").scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
  patternSearch.focus({ preventScroll: true });
});

detectRuntimeMode()
  .then(async () => {
    const recoveryHandled = await startPasswordRecovery();
    if (recoveryHandled) return;
    await Promise.all([
      refreshAuthSession(),
      refresh(),
      refreshPatternCatalog().catch((error) => {
        patternCatalogSummary.textContent = "";
        showMessage(patternCatalog, error.message);
      }),
    ]);
  })
  .catch((error) => {
    showMessage(results, error.message);
  });
