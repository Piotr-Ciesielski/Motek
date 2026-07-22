const yarnTemplate = document.getElementById("yarnTemplate");
const resultTemplate = document.getElementById("resultTemplate");
const yarnList = document.getElementById("yarnList");
const results = document.getElementById("results");
const summary = document.getElementById("summary");
const addYarnBtn = document.getElementById("addYarnBtn");
const findBtn = document.getElementById("findBtn");

const LOCAL_STORAGE_KEY = "motek.yarns.v1";
const DEFAULT_LOCAL_YARNS = [
  { name: "Merino Soft", color: "beż", material: "wełna", weightClass: "dk", length: 220, weight: 80 },
  { name: "Cotton Air", color: "krem", material: "bawełna", weightClass: "sport", length: 180, weight: 60 },
  { name: "Acrylic Mix", color: "szary", material: "mieszanka", weightClass: "dk", length: 240, weight: 100 },
];
const DEFAULT_PATTERNS = [
  {
    name: "Prosty szal",
    description: "Lekki projekt dla mieszanych zapasów. Wystarczy jedna dobra włóczka lub kilka podobnych motków.",
    yarnsNeeded: 1,
    metersNeeded: 300,
    gramsNeeded: 100,
    materials: ["wełna", "alpaka", "akryl", "mieszanka"],
    weightClasses: ["lace", "fingering", "sport", "dk"],
    colors: "dowolny",
  },
  {
    name: "Ciepła czapka",
    description: "Dobry wybór na pojedyncze motki średniej grubości.",
    yarnsNeeded: 1,
    metersNeeded: 180,
    gramsNeeded: 60,
    materials: ["wełna", "alpaka", "akryl", "mieszanka"],
    weightClasses: ["sport", "dk", "worsted"],
    colors: "dowolny",
  },
  {
    name: "Sweter dziecięcy",
    description: "Projekt wymaga kilku motków, ale nadal jest realny dla większości domowych zapasów.",
    yarnsNeeded: 3,
    metersNeeded: 750,
    gramsNeeded: 250,
    materials: ["wełna", "alpaka", "bawełna", "mieszanka"],
    weightClasses: ["sport", "dk", "worsted"],
    colors: "spójne",
  },
];

let runtimeMode = "local";
let baseUrl = "";
let autosaveTimer = null;
let autosaveInFlight = null;
let autosavePending = false;
let memoryLocalYarns = null;

function normalizeYarns(yarns) {
  let nextId = 1;

  return yarns.map((yarn) => {
    const parsedId = Number(yarn.id);
    const id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : nextId;
    nextId = Math.max(nextId, id + 1);

    return {
      id,
      name: yarn.name || "Bez nazwy",
      color: yarn.color || "nieokreślony",
      material: yarn.material || "mieszanka",
      weightClass: yarn.weightClass || "dk",
      length: Number(yarn.length) || 0,
      weight: Number(yarn.weight) || 0,
    };
  });
}

function cloneDefaultYarns() {
  return normalizeYarns(DEFAULT_LOCAL_YARNS);
}

function persistLocalYarns(yarns) {
  const normalized = normalizeYarns(yarns);
  memoryLocalYarns = normalized;

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Some browsers restrict storage for file:// pages.
  }

  return normalized;
}

function readLocalYarns() {
  if (memoryLocalYarns) {
    return memoryLocalYarns;
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return persistLocalYarns(cloneDefaultYarns());
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return persistLocalYarns(cloneDefaultYarns());
    }

    return persistLocalYarns(parsed);
  } catch {
    memoryLocalYarns = memoryLocalYarns || cloneDefaultYarns();
    return memoryLocalYarns;
  }
}

function removeLocalYarn(id) {
  const remaining = readLocalYarns().filter((yarn) => String(yarn.id) !== String(id));
  persistLocalYarns(remaining);
}

async function detectRuntimeMode() {
  if (window.location.protocol === "file:") {
    runtimeMode = "local";
    baseUrl = "";
    return;
  }

  runtimeMode = "remote";
  baseUrl = window.location.origin;
}

async function api(path, options = {}) {
  if (!baseUrl) {
    throw new Error("Tryb lokalny nie używa backendu.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
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
    name: card.querySelector('[data-field="name"]').value.trim(),
    color: card.querySelector('[data-field="color"]').value.trim(),
    material: card.querySelector('[data-field="material"]').value,
    weightClass: card.querySelector('[data-field="weightClass"]').value,
    length: Number(card.querySelector('[data-field="length"]').value || 0),
    weight: Number(card.querySelector('[data-field="weight"]').value || 0),
  }));
}

async function loadYarns() {
  if (runtimeMode === "remote") {
    return api("/api/yarns");
  }

  return readLocalYarns();
}

async function saveYarns() {
  const local = collectYarnsFromDom();

  if (runtimeMode === "remote") {
    const existing = await api("/api/yarns");
    for (const yarn of existing) {
      await api(`/api/yarns/${yarn.id}`, { method: "DELETE" });
    }

    const savedYarns = [];
    for (const yarn of local) {
      savedYarns.push(
        await api("/api/yarns", {
          method: "POST",
          body: JSON.stringify(yarn),
        })
      );
    }
    return savedYarns;
  }

  return persistLocalYarns(local);
}

async function deleteYarn(id) {
  if (runtimeMode === "remote") {
    await api(`/api/yarns/${id}`, { method: "DELETE" });
    return;
  }

  removeLocalYarn(id);
}

function syncDomIds(savedYarns) {
  const cards = [...yarnList.querySelectorAll(".yarn-card")];
  cards.forEach((card, index) => {
    card.dataset.id = savedYarns[index]?.id || "";
  });
}

function scorePattern(pattern, yarns) {
  const totalLength = yarns.reduce((sum, yarn) => sum + yarn.length, 0);
  const totalWeight = yarns.reduce((sum, yarn) => sum + yarn.weight, 0);
  const matchedYarns = yarns.filter(
    (yarn) => pattern.materials.includes(yarn.material) && pattern.weightClasses.includes(yarn.weightClass)
  ).length;
  const lengthScore = Math.min(totalLength / pattern.metersNeeded, 1);
  const weightScore = Math.min(totalWeight / pattern.gramsNeeded, 1);
  const materialScore = Math.min(matchedYarns / pattern.yarnsNeeded, 1);
  const colorScore = pattern.colors === "dowolny" ? 1 : 0.8;
  const total = Math.round(lengthScore * 40 + weightScore * 25 + materialScore * 25 + colorScore * 10);
  const doable =
    totalLength >= pattern.metersNeeded &&
    totalWeight >= pattern.gramsNeeded &&
    matchedYarns >= pattern.yarnsNeeded;

  return { total, doable, totalLength, totalWeight, matchedYarns };
}

async function loadMatches() {
  if (runtimeMode === "remote") {
    return api("/api/matches");
  }

  const yarns = readLocalYarns();
  return DEFAULT_PATTERNS.map((pattern) => ({ pattern, ...scorePattern(pattern, yarns) }))
    .filter((item) => item.doable)
    .sort((a, b) => b.total - a.total);
}

async function renderResults() {
  const matches = await loadMatches();
  results.replaceChildren();

  if (!matches.length) {
    showMessage(
      results,
      "Brak pełnego dopasowania. Spróbuj dodać więcej metrów, większą wagę lub inny materiał."
    );
    return;
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
  const storageText =
    runtimeMode === "remote"
      ? "Zestaw jest przechowywany w backendzie."
      : "Zestaw jest przechowywany lokalnie w przeglądarce.";

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

detectRuntimeMode()
  .then(async () => {
    await refresh();
  })
  .catch((error) => {
    showMessage(results, error.message);
  });
