const yarnTemplate = document.getElementById("yarnTemplate");
const resultTemplate = document.getElementById("resultTemplate");
const yarnList = document.getElementById("yarnList");
const results = document.getElementById("results");
const summary = document.getElementById("summary");
const addYarnBtn = document.getElementById("addYarnBtn");
const findBtn = document.getElementById("findBtn");
const patternTemplate = document.getElementById("patternTemplate");
const patternSearch = document.getElementById("patternSearch");
const patternReviewFilter = document.getElementById("patternReviewFilter");
const patternCatalogSummary = document.getElementById("patternCatalogSummary");
const patternCatalog = document.getElementById("patternCatalog");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authForms = document.getElementById("authForms");
const authLoggedIn = document.getElementById("authLoggedIn");
const authUser = document.getElementById("authUser");
const authProfileSummary = document.getElementById("authProfileSummary");
const authMessage = document.getElementById("authMessage");
const authLead = document.getElementById("authLead");
const logoutBtn = document.getElementById("logoutBtn");

let baseUrl = window.location.origin;
let isAuthenticated = false;
let autosaveTimer = null;
let autosaveInFlight = null;
let autosavePending = false;
let catalogPatterns = [];
let yarnVersion = null;

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

  const response = await fetch(`${baseUrl}${path}`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok && response.status !== 204) {
    let details = "";
    try {
      const payload = await response.clone().json();
      details = payload?.error ? `: ${payload.error}` : "";
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(`Błąd komunikacji z backendem (${response.status})${details}`);
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
  element.textContent = message;
  container.replaceChildren(element);
}

function createRequirement(text) {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    if (autosaveInFlight) {
      autosavePending = true;
      return;
    }

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
  }, 350);
}

function addYarnCard(yarn = {}) {
  const node = yarnTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = yarn.id || "";
  node.querySelector('[data-field="name"]').value = yarn.name || "";
  node.querySelector('[data-field="color"]').value = yarn.color || "";
  node.querySelector('[data-field="material"]').value = yarn.material || "wełna";
  node.querySelector('[data-field="weightClass"]').value = yarn.weightClass || "dk";
  node.querySelector('[data-field="length"]').value = yarn.length ?? 0;
  node.querySelector('[data-field="weight"]').value = yarn.weight ?? 0;

  node.querySelector(".yarn-remove").addEventListener("click", async () => {
    if (node.dataset.id) {
      await deleteYarn(node.dataset.id);
    }
    node.remove();
    await refresh();
  });

  node.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("input", scheduleAutosave);
    field.addEventListener("change", scheduleAutosave);
  });

  yarnList.appendChild(node);
  return node;
}

function collectYarnsFromDom() {
  return [...yarnList.querySelectorAll(".yarn-card")].map((card) => ({
    id: card.dataset.id ? Number(card.dataset.id) : null,
    name: card.querySelector('[data-field="name"]').value.trim(),
    color: card.querySelector('[data-field="color"]').value.trim(),
    material: card.querySelector('[data-field="material"]').value,
    weightClass: card.querySelector('[data-field="weightClass"]').value,
    length: Number(card.querySelector('[data-field="length"]').value || 0),
    weight: Number(card.querySelector('[data-field="weight"]').value || 0),
  }));
}

async function loadYarns() {
  if (!isAuthenticated) return [];
  return api("/api/yarns");
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
  return api("/api/patterns");
}

function formatRatio(value) {
  const ratio = Number(value);
  return Number.isFinite(ratio) && ratio > 0
    ? `${ratio.toLocaleString("pl-PL")} m/100 g`
    : "brak danych";
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

function renderPatternCatalog() {
  const phrase = patternSearch.value.trim().toLocaleLowerCase("pl");
  const reviewFilter = patternReviewFilter.value;
  const visiblePatterns = catalogPatterns.filter((pattern) => {
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
    return matchesPhrase && matchesStatus;
  });

  patternCatalogSummary.textContent =
    `Widoczne wzory: ${visiblePatterns.length} z ${catalogPatterns.length}`;
  patternCatalog.replaceChildren();

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

    card.querySelector("h3").textContent = pattern.name;
    card.querySelector(".pattern-card__kicker").textContent =
      pattern.sourceLanguage === "pl" ? "Wzór po polsku" : "Wzór obcojęzyczny";
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

async function refreshPatternCatalog() {
  showMessage(patternCatalog, "Pobieram wzory z bazy...");
  catalogPatterns = await loadPatternCatalog();
  renderPatternCatalog();
}

async function renderResults() {
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

  matches.forEach((item) => {
    const card = resultTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector("h3").textContent = item.pattern.name;
    card.querySelector(".result-card__meta").textContent =
      `${item.pattern.yarnsNeeded} motek/motki, min. ${item.pattern.metersNeeded} m, ${item.pattern.gramsNeeded} g`;
    card.querySelector(".result-card__desc").textContent = item.pattern.description;
    card.querySelector(".score-pill").textContent = `Dopasowanie ${item.total}%`;
    card
      .querySelector(".requirements")
      .replaceChildren(
        createRequirement(`Materiały: ${item.pattern.materials.join(", ")}`),
        createRequirement(`Grubości: ${item.pattern.weightClasses.join(", ")}`),
        createRequirement(`Pasujące włóczki w Twoim zestawie: ${item.matchedYarns}`)
      );
    results.appendChild(card);
  });
}

async function renderSummary() {
  const yarns = await loadYarns();
  const totalLength = yarns.reduce((sum, yarn) => sum + yarn.length, 0);
  const totalWeight = yarns.reduce((sum, yarn) => sum + yarn.weight, 0);
  const storageText = "Zestaw jest przechowywany prywatnie w Supabase.";

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
}

function setAuthBusy(form, busy) {
  form.querySelector('button[type="submit"]').disabled = busy;
}

function renderAuthState(payload) {
  const authenticated = Boolean(payload?.authenticated && payload.user);
  isAuthenticated = authenticated;
  authForms.hidden = authenticated;
  authLoggedIn.hidden = !authenticated;
  authUser.hidden = !authenticated;

  if (!authenticated) {
    authUser.textContent = "";
    authProfileSummary.textContent = "";
    authLead.textContent = "Załóż konto, aby przygotować aplikację do prywatnego magazynu włóczek.";
    return;
  }

  const profile = payload.profile || {};
  const login = profile.login || payload.user.metadata?.login || payload.user.email;
  authUser.textContent = `Zalogowano jako ${login}`;
  authProfileSummary.textContent = profile.full_name
    ? `${profile.full_name} (${profile.email || payload.user.email})`
    : profile.email || payload.user.email || "Zalogowany użytkownik";
  authLead.textContent = "Sesja jest aktywna. Twój magazyn włóczek jest przechowywany prywatnie w Supabase.";
}

async function refreshAuthSession() {
  try {
    const payload = await api("/api/auth/session");
    renderAuthState(payload);
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
  yarns.forEach(addYarnCard);
  await renderSummary();
  await renderResults();
}

addYarnBtn.addEventListener("click", async () => {
  const card = addYarnCard();
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.querySelector('[data-field="name"]').focus();
  scheduleAutosave();
});

findBtn.addEventListener("click", async () => {
  try {
    findBtn.disabled = true;
    findBtn.textContent = "Szukam...";
    showMessage(results, "Zapisuję włóczki...");
    await saveYarns();
    showMessage(results, "Pobieram dopasowane wzory...");
    await refresh();
  } catch (error) {
    showMessage(results, error.message);
  } finally {
    findBtn.disabled = false;
    findBtn.textContent = "Szukaj wzoru";
  }
});

patternSearch.addEventListener("input", renderPatternCatalog);
patternReviewFilter.addEventListener("change", renderPatternCatalog);

detectRuntimeMode()
  .then(async () => {
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
