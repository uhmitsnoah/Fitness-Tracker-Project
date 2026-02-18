const STORAGE_KEY = "bulkTrackerData_v2";
const OPEN_FOOD_FACTS_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const FOOD_LIBRARY = [
  {
    name: "Taco Bell Chicken Quesadilla",
    aliases: ["taco bell quesadilla", "taco bell quesadillas", "chicken quesadilla taco bell"],
    calories: 510,
    protein: 27,
    carbs: 37,
    fat: 27,
  },
  {
    name: "Chipotle Chicken Burrito",
    aliases: ["chipotle burrito chicken"],
    calories: 1065,
    protein: 56,
    carbs: 115,
    fat: 43,
  },
  {
    name: "McDonald's Big Mac",
    aliases: ["big mac", "mcdonalds big mac"],
    calories: 550,
    protein: 25,
    carbs: 45,
    fat: 30,
  },
  {
    name: "Whey Protein Shake (1 scoop + water)",
    aliases: ["whey shake", "protein shake", "whey protein"],
    calories: 120,
    protein: 24,
    carbs: 3,
    fat: 1.5,
  },
  {
    name: "Chicken Breast (6 oz cooked)",
    aliases: ["chicken breast", "6 oz chicken breast"],
    calories: 280,
    protein: 53,
    carbs: 0,
    fat: 6,
  },
  {
    name: "White Rice (1 cup cooked)",
    aliases: ["white rice", "rice 1 cup"],
    calories: 205,
    protein: 4.3,
    carbs: 45,
    fat: 0.4,
  },
  {
    name: "Ground Beef 90/10 (6 oz cooked)",
    aliases: ["ground beef", "lean ground beef"],
    calories: 340,
    protein: 43,
    carbs: 0,
    fat: 17,
  },
  {
    name: "Whole Eggs (3 large)",
    aliases: ["3 eggs", "whole eggs"],
    calories: 216,
    protein: 19,
    carbs: 1.2,
    fat: 14.5,
  },
  {
    name: "Greek Yogurt Nonfat (1 cup)",
    aliases: ["greek yogurt", "nonfat greek yogurt"],
    calories: 130,
    protein: 23,
    carbs: 9,
    fat: 0,
  },
  {
    name: "Peanut Butter (2 tbsp)",
    aliases: ["peanut butter", "2 tbsp peanut butter"],
    calories: 190,
    protein: 8,
    carbs: 7,
    fat: 16,
  },
  {
    name: "Banana (1 medium)",
    aliases: ["banana", "medium banana"],
    calories: 105,
    protein: 1.3,
    carbs: 27,
    fat: 0.4,
  },
  {
    name: "Milk 2% (1 cup)",
    aliases: ["2% milk", "milk cup"],
    calories: 122,
    protein: 8,
    carbs: 12,
    fat: 5,
  },
  {
    name: "Pepperoni Pizza Slice",
    aliases: ["pizza slice", "pepperoni slice", "pepperoni pizza"],
    calories: 313,
    protein: 13,
    carbs: 35,
    fat: 13,
  },
];

const state = loadState();
let editingEntryId = null;
let deferredInstallPrompt = null;
let foodLookupTimer = null;
const nutritionLookupCache = new Map();
let syncPushTimer = null;
let isApplyingRemoteState = false;

const todayIso = () => new Date().toISOString().slice(0, 10);

const goalsForm = document.getElementById("goals-form");
const goalCaloriesInput = document.getElementById("goal-calories");
const goalProteinInput = document.getElementById("goal-protein");
const goalStepsInput = document.getElementById("goal-steps");
const startWeightInput = document.getElementById("start-weight");
const profileForm = document.getElementById("profile-form");
const entryForm = document.getElementById("entry-form");
const checkinForm = document.getElementById("checkin-form");

const entrySubmitBtn = document.getElementById("entry-submit");
const entryCancelBtn = document.getElementById("entry-cancel");
const entryLookupBtn = document.getElementById("entry-lookup");
const entryNameInput = document.getElementById("entry-name");
const entryCaloriesInput = document.getElementById("entry-calories");
const entryProteinInput = document.getElementById("entry-protein");
const entryCarbsInput = document.getElementById("entry-carbs");
const entryFatInput = document.getElementById("entry-fat");
const foodSuggestionsEl = document.getElementById("food-suggestions");
const foodMatchStatusEl = document.getElementById("food-match-status");

const summaryEl = document.getElementById("summary");
const entriesListEl = document.getElementById("entries-list");
const historyEl = document.getElementById("history");
const weeklyReportEl = document.getElementById("weekly-report");

const chartCaloriesEl = document.getElementById("chart-calories");
const chartProteinEl = document.getElementById("chart-protein");
const chartWeightEl = document.getElementById("chart-weight");

const installBtn = document.getElementById("install-btn");
const installHelp = document.getElementById("install-help");
const targetOutputEl = document.getElementById("target-output");
const applyTargetsBtn = document.getElementById("apply-targets");
const syncForm = document.getElementById("sync-form");
const syncUrlInput = document.getElementById("sync-url");
const syncKeyInput = document.getElementById("sync-key");
const syncIdInput = document.getElementById("sync-id");
const syncAutoInput = document.getElementById("sync-auto");
const syncPushBtn = document.getElementById("sync-push");
const syncPullBtn = document.getElementById("sync-pull");
const syncStatusEl = document.getElementById("sync-status");

initialize();

function initialize() {
  document.getElementById("entry-date").value = todayIso();
  document.getElementById("checkin-date").value = todayIso();

  populateFoodSuggestions();
  hydrateProfile();
  hydrateGoals();
  hydrateSyncSettings();
  setupInstallSupport();
  registerServiceWorker();
  wireEvents();
  renderTargetOutput(state.lastTargets);
  setSyncStatus(syncReady() ? "Sync configured. Use Push/Pull or leave Auto Sync on." : "Configure Supabase to enable sync.");
  render();
}

function wireEvents() {
  syncForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.sync = {
      url: syncUrlInput.value.trim(),
      anonKey: syncKeyInput.value.trim(),
      syncId: syncIdInput.value.trim(),
      auto: syncAutoInput.value === "true",
    };
    saveState();
    setSyncStatus(syncReady() ? "Sync setup saved." : "Missing fields. Add URL, anon key, and sync ID.");
  });

  syncPushBtn?.addEventListener("click", async () => {
    await pushStateToCloud(true);
  });

  syncPullBtn?.addEventListener("click", async () => {
    await pullStateFromCloud(true);
  });

  [goalCaloriesInput, goalProteinInput, goalStepsInput, startWeightInput].forEach((input) => {
    input?.addEventListener("input", () => {
      saveGoalsFromForm();
      render();
    });
  });

  entryLookupBtn?.addEventListener("click", async () => {
    await lookupNutrition(entryNameInput.value);
  });

  entryNameInput.addEventListener("input", () => {
    clearTimeout(foodLookupTimer);
    foodLookupTimer = setTimeout(() => {
      tryAutoFillFromName(entryNameInput.value);
    }, 220);
  });

  entryNameInput.addEventListener("change", () => {
    tryAutoFillFromName(entryNameInput.value);
  });

  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const profile = readProfileFromForm();
    const targets = calculateBulkTargets(profile);
    state.profile = profile;
    state.lastTargets = targets;
    saveState();
    renderTargetOutput(targets);
  });

  applyTargetsBtn.addEventListener("click", () => {
    if (!profileForm.reportValidity()) return;
    const profile = readProfileFromForm();
    const targets = state.lastTargets || calculateBulkTargets(profile);

    document.getElementById("goal-calories").value = targets.calories;
    document.getElementById("goal-protein").value = targets.protein;
    document.getElementById("goal-steps").value = targets.steps;
    document.getElementById("start-weight").value = profile.weightLb;

    state.profile = profile;
    state.lastTargets = targets;
    state.goals = {
      calories: targets.calories,
      protein: targets.protein,
      steps: targets.steps,
      startWeight: profile.weightLb,
    };
    saveState();
    renderTargetOutput(targets);
    render();
  });

  goalsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveGoalsFromForm();
    render();
  });

  entryForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const nextEntry = {
      date: document.getElementById("entry-date").value,
      type: document.getElementById("entry-type").value,
      name: document.getElementById("entry-name").value.trim(),
      calories: toNumber(document.getElementById("entry-calories").value),
      protein: toNumber(document.getElementById("entry-protein").value),
      carbs: toNumber(document.getElementById("entry-carbs").value),
      fat: toNumber(document.getElementById("entry-fat").value),
    };

    if (editingEntryId) {
      const existing = state.entries.find((entry) => entry.id === editingEntryId);
      if (existing) Object.assign(existing, nextEntry);
      setEditMode(null);
    } else {
      state.entries.push({ id: crypto.randomUUID(), ...nextEntry });
    }

    resetEntryForm();
    saveState();
    render();
  });

  entryCancelBtn.addEventListener("click", () => {
    setEditMode(null);
    resetEntryForm();
  });

  checkinForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const date = document.getElementById("checkin-date").value;
    const steps = toNumber(document.getElementById("checkin-steps").value);
    const weight = toNumber(document.getElementById("checkin-weight").value);

    const existing = state.checkins.find((item) => item.date === date);
    if (existing) {
      existing.steps = steps;
      existing.weight = weight;
    } else {
      state.checkins.push({ date, steps, weight });
    }

    checkinForm.reset();
    document.getElementById("checkin-date").value = todayIso();
    saveState();
    render();
  });

  entriesListEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.id;
    if (!id) return;

    if (target.dataset.action === "delete") {
      state.entries = state.entries.filter((entry) => entry.id !== id);
      if (editingEntryId === id) {
        setEditMode(null);
        resetEntryForm();
      }
      saveState();
      render();
      return;
    }

    if (target.dataset.action === "edit") {
      const entry = state.entries.find((item) => item.id === id);
      if (!entry) return;
      setEditMode(entry.id);
      populateEntryForm(entry);
    }
  });
}

function render() {
  const today = todayIso();
  const todayEntries = state.entries.filter((entry) => entry.date === today);
  const todayCheckin = state.checkins.find((item) => item.date === today);

  const totals = todayEntries.reduce(
    (acc, entry) => {
      acc.calories += entry.calories;
      acc.protein += entry.protein;
      acc.carbs += entry.carbs;
      acc.fat += entry.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const currentWeight = latestWeight();
  const gain = currentWeight && state.goals.startWeight ? currentWeight - state.goals.startWeight : 0;

  summaryEl.innerHTML = `
    ${metric("Calories", totals.calories, state.goals.calories, "kcal")}
    ${metric("Protein", totals.protein, state.goals.protein, "g")}
    ${metric("Steps", todayCheckin?.steps || 0, state.goals.steps, "")}
    <div class="metric">
      Weight Progress
      <strong>${fmt(currentWeight || 0)} lb</strong>
      <small>Gain since start: ${fmt(gain)} lb</small>
    </div>
  `;

  if (todayEntries.length === 0) {
    entriesListEl.innerHTML = '<li class="row"><span>No entries yet for today.</span></li>';
  } else {
    entriesListEl.innerHTML = todayEntries
      .map(
        (entry) => `
      <li class="row">
        <div>
          <strong>${escapeHtml(entry.name)}</strong>
          <small>${entry.type} | ${fmt(entry.calories)} kcal | ${fmt(entry.protein)}g protein | C ${fmt(entry.carbs)} / F ${fmt(entry.fat)}</small>
        </div>
        <div class="inline-actions">
          <button class="edit" data-action="edit" data-id="${entry.id}">Edit</button>
          <button class="delete" data-action="delete" data-id="${entry.id}">Delete</button>
        </div>
      </li>`
      )
      .join("");
  }

  renderWeeklyReport();
  renderCharts();
  renderHistory();
}

function renderWeeklyReport() {
  const lastWeek = rollingWindowTotals(7, 0);
  const previousWeek = rollingWindowTotals(7, 7);

  const caloriesDelta = lastWeek.calories - previousWeek.calories;
  const proteinDelta = lastWeek.protein - previousWeek.protein;
  const stepsDelta = lastWeek.steps - previousWeek.steps;
  const weightDelta = lastWeek.weightChange;

  weeklyReportEl.innerHTML = `
    <div class="metric">
      Last 7-Day Calories
      <strong>${fmt(lastWeek.calories)} kcal</strong>
      <small>${signed(caloriesDelta)} vs previous week</small>
    </div>
    <div class="metric">
      Last 7-Day Protein
      <strong>${fmt(lastWeek.protein)} g</strong>
      <small>${signed(proteinDelta)} g vs previous week</small>
    </div>
    <div class="metric">
      Last 7-Day Steps
      <strong>${fmt(lastWeek.steps)}</strong>
      <small>${signed(stepsDelta)} steps vs previous week</small>
    </div>
    <div class="metric">
      7-Day Weight Change
      <strong>${signed(weightDelta)} lb</strong>
      <small>Current bulk trend</small>
    </div>
  `;
}

function renderCharts() {
  const series = buildSeries(14);

  chartCaloriesEl.innerHTML = lineChartSvg(series.labels, series.calories, "kcal");
  chartProteinEl.innerHTML = lineChartSvg(series.labels, series.protein, "g");
  chartWeightEl.innerHTML = lineChartSvg(series.labels, series.weight, "lb");
}

function renderHistory() {
  const byDate = buildDailyMap();

  const rows = Object.entries(byDate)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 14);

  if (rows.length === 0) {
    historyEl.innerHTML = "<p>No data yet.</p>";
    return;
  }

  historyEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Calories</th>
          <th>Protein (g)</th>
          <th>Steps</th>
          <th>Weight (lb)</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            ([date, totals]) => `
          <tr>
            <td>${date}</td>
            <td>${fmt(totals.calories)}</td>
            <td>${fmt(totals.protein)}</td>
            <td>${fmt(totals.steps)}</td>
            <td>${totals.weight === null ? "-" : fmt(totals.weight)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function setEditMode(id) {
  editingEntryId = id;
  const isEditing = Boolean(id);
  entrySubmitBtn.textContent = isEditing ? "Update Entry" : "Add Entry";
  entryCancelBtn.classList.toggle("hidden", !isEditing);
}

function populateEntryForm(entry) {
  document.getElementById("entry-date").value = entry.date;
  document.getElementById("entry-type").value = entry.type;
  document.getElementById("entry-name").value = entry.name;
  document.getElementById("entry-calories").value = entry.calories;
  document.getElementById("entry-protein").value = entry.protein;
  document.getElementById("entry-carbs").value = entry.carbs;
  document.getElementById("entry-fat").value = entry.fat;
}

function resetEntryForm() {
  entryForm.reset();
  document.getElementById("entry-date").value = todayIso();
  document.getElementById("entry-type").value = "Food";
  setFoodStatus("");
}

function buildDailyMap() {
  const byDate = {};

  state.entries.forEach((entry) => {
    if (!byDate[entry.date]) {
      byDate[entry.date] = { calories: 0, protein: 0, steps: 0, weight: null };
    }
    byDate[entry.date].calories += entry.calories;
    byDate[entry.date].protein += entry.protein;
  });

  state.checkins.forEach((checkin) => {
    if (!byDate[checkin.date]) {
      byDate[checkin.date] = { calories: 0, protein: 0, steps: 0, weight: null };
    }
    byDate[checkin.date].steps = checkin.steps;
    byDate[checkin.date].weight = checkin.weight;
  });

  return byDate;
}

function buildSeries(days) {
  const map = buildDailyMap();
  const labels = [];
  const calories = [];
  const protein = [];
  const weight = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = dateDaysAgoIso(i);
    const data = map[date] || { calories: 0, protein: 0, weight: null };
    labels.push(date.slice(5));
    calories.push(data.calories || 0);
    protein.push(data.protein || 0);
    weight.push(data.weight ?? null);
  }

  return { labels, calories, protein, weight };
}

function lineChartSvg(labels, values, unit) {
  const width = 360;
  const height = 140;
  const pad = 16;

  const points = values
    .map((value, i) => ({ value, i }))
    .filter((point) => point.value !== null && Number.isFinite(point.value));

  if (points.length < 2) {
    return `<p class="chart-empty">Add at least 2 days of data for charting (${unit}).</p>`;
  }

  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const range = Math.max(max - min, 1);

  const chartPoints = points.map((p) => {
    const x = pad + (p.i / (labels.length - 1 || 1)) * (width - pad * 2);
    const y = height - pad - ((p.value - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const last = points[points.length - 1].value;

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="145" role="img" aria-label="${unit} trend chart">
      <defs>
        <linearGradient id="line-grad-${unit}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1dbf8f"></stop>
          <stop offset="100%" stop-color="#2f73ff"></stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="#fff8ef"></rect>
      <polyline fill="none" stroke="url(#line-grad-${unit})" stroke-width="3" points="${chartPoints.join(" ")}"></polyline>
      <text x="${pad}" y="16" font-size="10" fill="#667083">Min ${fmt(min)}</text>
      <text x="${width - 72}" y="16" font-size="10" fill="#667083">Max ${fmt(max)}</text>
      <text x="${width - 78}" y="${height - 8}" font-size="10" fill="#334">Now ${fmt(last)} ${unit}</text>
    </svg>
  `;
}

function rollingWindowTotals(length, offsetFromToday) {
  const map = buildDailyMap();
  const days = [];

  for (let i = offsetFromToday; i < offsetFromToday + length; i += 1) {
    days.push(dateDaysAgoIso(i));
  }

  let calories = 0;
  let protein = 0;
  let steps = 0;

  days.forEach((date) => {
    const data = map[date];
    if (!data) return;
    calories += data.calories || 0;
    protein += data.protein || 0;
    steps += data.steps || 0;
  });

  const weights = days
    .map((date) => map[date]?.weight)
    .filter((value) => value !== null && value !== undefined);

  const weightChange = weights.length > 1 ? weights[0] - weights[weights.length - 1] : 0;

  return { calories, protein, steps, weightChange };
}

function dateDaysAgoIso(daysAgo) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}

function metric(label, value, goal, unit) {
  const remainder = goal ? goal - value : 0;
  const direction = remainder > 0 ? "left" : "over";
  const suffix = unit ? ` ${unit}` : "";
  const text = goal ? `${fmt(Math.abs(remainder))}${suffix} ${direction} goal` : "Set a goal above";
  const progress = goal > 0 ? Math.max(0, Math.min((value / goal) * 100, 100)) : 0;

  return `
    <div class="metric">
      ${label}
      <strong>${fmt(value)}${suffix}</strong>
      <small>${text}</small>
      <div class="metric-track" aria-hidden="true">
        <span class="metric-fill" style="width:${fmt(progress)}%"></span>
      </div>
    </div>
  `;
}

function latestWeight() {
  if (state.checkins.length === 0) return 0;
  const sorted = [...state.checkins].sort((a, b) => (a.date < b.date ? 1 : -1));
  return sorted[0].weight;
}

function hydrateGoals() {
  goalCaloriesInput.value = state.goals.calories || 3200;
  goalProteinInput.value = state.goals.protein || 180;
  goalStepsInput.value = state.goals.steps || 9000;
  startWeightInput.value = state.goals.startWeight || 170;
}

function hydrateSyncSettings() {
  const sync = state.sync || {};
  syncUrlInput.value = sync.url || "";
  syncKeyInput.value = sync.anonKey || "";
  syncIdInput.value = sync.syncId || "";
  syncAutoInput.value = String(sync.auto !== false);
}

function hydrateProfile() {
  const profile = state.profile || {};
  document.getElementById("profile-sex").value = profile.sex || "male";
  document.getElementById("profile-age").value = profile.age || 24;
  document.getElementById("profile-height-ft").value = profile.heightFt || 5;
  document.getElementById("profile-height-in").value = profile.heightIn ?? 10;
  document.getElementById("profile-weight-lb").value = profile.weightLb || state.goals.startWeight || 170;
  document.getElementById("profile-activity").value = String(profile.activity || 1.55);
  document.getElementById("profile-surplus").value = profile.surplus || 300;
}

function readProfileFromForm() {
  return {
    sex: document.getElementById("profile-sex").value,
    age: toNumber(document.getElementById("profile-age").value),
    heightFt: toNumber(document.getElementById("profile-height-ft").value),
    heightIn: toNumber(document.getElementById("profile-height-in").value),
    weightLb: toNumber(document.getElementById("profile-weight-lb").value),
    activity: toNumber(document.getElementById("profile-activity").value),
    surplus: toNumber(document.getElementById("profile-surplus").value),
  };
}

function calculateBulkTargets(profile) {
  const totalInches = profile.heightFt * 12 + profile.heightIn;
  const heightCm = totalInches * 2.54;
  const weightKg = profile.weightLb * 0.45359237;

  const baseBmr =
    10 * weightKg + 6.25 * heightCm - 5 * profile.age + (profile.sex === "female" ? -161 : 5);
  const maintenance = baseBmr * profile.activity;
  const calories = round5(maintenance + profile.surplus);
  const protein = Math.round(profile.weightLb * 0.9);
  const fat = Math.max(45, Math.round((calories * 0.25) / 9));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  let steps = 8500;
  if (profile.activity <= 1.2) steps = 7000;
  else if (profile.activity <= 1.375) steps = 8000;
  else if (profile.activity >= 1.725) steps = 10000;

  return { calories, protein, carbs, fat, steps };
}

function renderTargetOutput(targets) {
  if (!targets) {
    targetOutputEl.textContent = "Enter your stats and calculate targets.";
    return;
  }

  targetOutputEl.innerHTML = `
    Recommended daily targets for lean bulking:
    <strong>${fmt(targets.calories)} kcal</strong>,
    <strong>${fmt(targets.protein)}g protein</strong>,
    <strong>${fmt(targets.carbs)}g carbs</strong>,
    <strong>${fmt(targets.fat)}g fat</strong>,
    <strong>${fmt(targets.steps)} steps</strong>.
  `;
}

function populateFoodSuggestions() {
  foodSuggestionsEl.innerHTML = FOOD_LIBRARY.map((item) => `<option value="${escapeHtml(item.name)}">`).join(
    ""
  );
}

function tryAutoFillFromName(rawName) {
  const query = normalizeFoodName(rawName);
  if (query.length < 3) {
    setFoodStatus("");
    return;
  }

  const best = findBestFoodMatch(query);
  if (!best || best.score < 0.5) {
    setFoodStatus("No nutrition match yet. Try a more specific item name.");
    return;
  }

  entryCaloriesInput.value = best.item.calories;
  entryProteinInput.value = best.item.protein;
  entryCarbsInput.value = best.item.carbs;
  entryFatInput.value = best.item.fat;
  setFoodStatus(`Auto-filled from: ${best.item.name}`);
}

async function lookupNutrition(rawName) {
  const query = normalizeFoodName(rawName);
  if (query.length < 3) {
    setFoodStatus("Type at least 3 characters for lookup.");
    return;
  }

  setFoodStatus("Searching nutrition database...");

  const onlineResult = await findOnlineNutrition(query);
  if (onlineResult) {
    fillNutritionInputs(onlineResult);
    setFoodStatus(`Auto-filled from online: ${onlineResult.name}`);
    return;
  }

  const localResult = findBestFoodMatch(query);
  if (localResult && localResult.score >= 0.5) {
    fillNutritionInputs(localResult.item);
    setFoodStatus(`Online lookup missed. Used local match: ${localResult.item.name}`);
    return;
  }

  setFoodStatus("No nutrition result found. Try a more specific name.");
}

async function findOnlineNutrition(normalizedQuery) {
  if (nutritionLookupCache.has(normalizedQuery)) {
    return nutritionLookupCache.get(normalizedQuery);
  }

  const url = `${OPEN_FOOD_FACTS_SEARCH_URL}?search_terms=${encodeURIComponent(
    normalizedQuery
  )}&search_simple=1&action=process&json=1&page_size=50`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const payload = await response.json();
    const products = Array.isArray(payload?.products) ? payload.products : [];
    if (products.length === 0) return null;

    let winner = null;
    products.forEach((product) => {
      const mapped = mapOpenFoodFactsProduct(product);
      if (!mapped) return;
      const score = similarityScore(normalizedQuery, normalizeFoodName(mapped.name));
      if (!winner || score > winner.score) winner = { score, mapped };
    });

    if (!winner || winner.score < 0.3) return null;
    nutritionLookupCache.set(normalizedQuery, winner.mapped);
    return winner.mapped;
  } catch {
    return null;
  }
}

function mapOpenFoodFactsProduct(product) {
  const nutriments = product?.nutriments || {};
  const kjEnergy = firstNumber(nutriments["energy_serving"], nutriments["energy_100g"], nutriments.energy);
  const kcalFromKj = kjEnergy ? kjEnergy / 4.184 : 0;
  const calories =
    firstNumber(
      nutriments["energy-kcal_serving"],
      nutriments["energy-kcal_100g"],
      nutriments["energy-kcal"],
      kcalFromKj
    ) || 0;
  const protein = firstNumber(nutriments["proteins_serving"], nutriments["proteins_100g"], nutriments.proteins) || 0;
  const carbs = firstNumber(nutriments["carbohydrates_serving"], nutriments["carbohydrates_100g"], nutriments.carbohydrates) || 0;
  const fat = firstNumber(nutriments["fat_serving"], nutriments["fat_100g"], nutriments.fat) || 0;

  // We need at least calories plus one macro to be useful.
  if (!calories || (protein === 0 && carbs === 0 && fat === 0)) return null;

  return {
    name: product.product_name || product.generic_name || "Matched Food",
    calories: round1(calories),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
  };
}

function fillNutritionInputs(item) {
  entryCaloriesInput.value = item.calories;
  entryProteinInput.value = item.protein;
  entryCarbsInput.value = item.carbs;
  entryFatInput.value = item.fat;
}

function findBestFoodMatch(query) {
  let winner = null;
  FOOD_LIBRARY.forEach((item) => {
    const names = [item.name, ...(item.aliases || [])].map(normalizeFoodName);
    names.forEach((name) => {
      const score = similarityScore(query, name);
      if (!winner || score > winner.score) winner = { item, score };
    });
  });
  return winner;
}

function similarityScore(a, b) {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(0.95, Math.min(a.length, b.length) / Math.max(a.length, b.length) + 0.2);

  const aWords = new Set(a.split(" ").filter(Boolean));
  const bWords = new Set(b.split(" ").filter(Boolean));
  const overlap = [...aWords].filter((word) => bWords.has(word)).length;
  if (overlap === 0) return 0;
  return overlap / Math.max(aWords.size, bWords.size);
}

function normalizeFoodName(value) {
  const base = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return base
    .split(" ")
    .map((word) => {
      if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
      if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
      return word;
    })
    .join(" ");
}

function firstNumber(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  }
  return null;
}

function setFoodStatus(message) {
  if (!foodMatchStatusEl) return;
  foodMatchStatusEl.textContent = message;
}

function setSyncStatus(message) {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = message;
}

function syncReady() {
  const sync = state.sync || {};
  return Boolean(sync.url && sync.anonKey && sync.syncId);
}

function syncHeaders() {
  const sync = state.sync || {};
  return {
    apikey: sync.anonKey,
    Authorization: `Bearer ${sync.anonKey}`,
    "Content-Type": "application/json",
  };
}

function syncEndpoint() {
  return `${state.sync.url.replace(/\/$/, "")}/rest/v1/sync_profiles`;
}

function queueAutoSyncPush() {
  if (isApplyingRemoteState) return;
  if (!syncReady() || state.sync?.auto === false) return;

  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(() => {
    pushStateToCloud(false);
  }, 1600);
}

async function pushStateToCloud(manual) {
  if (!syncReady()) {
    if (manual) setSyncStatus("Sync not configured yet.");
    return;
  }

  if (manual) setSyncStatus("Pushing to cloud...");

  const payload = {
    id: state.sync.syncId,
    payload: state,
    updated_at: new Date(state.meta?.lastModified || Date.now()).toISOString(),
  };

  try {
    const response = await fetch(syncEndpoint(), {
      method: "POST",
      headers: { ...syncHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([payload]),
    });

    if (!response.ok) {
      if (manual) setSyncStatus(`Push failed (${response.status}). Check table/policies.`);
      return;
    }

    if (manual) setSyncStatus("Push complete.");
  } catch {
    if (manual) setSyncStatus("Push failed (network error).");
  }
}

async function pullStateFromCloud(manual) {
  if (!syncReady()) {
    if (manual) setSyncStatus("Sync not configured yet.");
    return;
  }

  if (manual) setSyncStatus("Pulling from cloud...");

  const query = `${syncEndpoint()}?id=eq.${encodeURIComponent(
    state.sync.syncId
  )}&select=payload,updated_at&limit=1`;

  try {
    const response = await fetch(query, {
      method: "GET",
      headers: syncHeaders(),
    });

    if (!response.ok) {
      if (manual) setSyncStatus(`Pull failed (${response.status}). Check table/policies.`);
      return;
    }

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.payload) {
      if (manual) setSyncStatus("No remote data found for this Sync ID.");
      return;
    }

    const remoteState = row.payload;
    const remoteTs = Number(remoteState?.meta?.lastModified || Date.parse(row.updated_at) || 0);
    const localTs = Number(state.meta?.lastModified || 0);

    if (remoteTs <= localTs && manual) {
      setSyncStatus("Local data is already newest.");
      return;
    }

    applyStateFromRemote(remoteState);
    if (manual) setSyncStatus("Pull complete. Local data updated.");
  } catch {
    if (manual) setSyncStatus("Pull failed (network error).");
  }
}

function applyStateFromRemote(remote) {
  isApplyingRemoteState = true;

  const safe = {
    goals: remote.goals || {},
    profile: remote.profile || {},
    lastTargets: remote.lastTargets || null,
    entries: remote.entries || [],
    checkins: remote.checkins || [],
    sync: state.sync || {},
    meta: remote.meta || { lastModified: Date.now() },
  };

  state.goals = safe.goals;
  state.profile = safe.profile;
  state.lastTargets = safe.lastTargets;
  state.entries = safe.entries;
  state.checkins = safe.checkins;
  state.meta = safe.meta;

  hydrateGoals();
  hydrateProfile();
  renderTargetOutput(state.lastTargets);
  render();
  saveState();

  isApplyingRemoteState = false;
}

function setupInstallSupport() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installBtn.disabled = false;
    installHelp.textContent = "Tap install to pin this app to your home screen.";
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.disabled = true;
    installHelp.textContent = "Installed or dismissed. You can still add manually from browser menu.";
  });

  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    installHelp.textContent = "On iPhone: Share -> Add to Home Screen.";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const isLocalHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (!isLocalHttp) return;

  navigator.serviceWorker
    .register("./sw.js")
    .then((registration) => registration.update())
    .catch(() => {
      // Skip failing noisily on unsupported hosts.
    });
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      goals: {},
      profile: {},
      lastTargets: null,
      entries: [],
      checkins: [],
      sync: { url: "", anonKey: "", syncId: "", auto: true },
      meta: { lastModified: Date.now() },
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      goals: parsed.goals || {},
      profile: parsed.profile || {},
      lastTargets: parsed.lastTargets || null,
      entries: parsed.entries || [],
      checkins: parsed.checkins || [],
      sync: parsed.sync || { url: "", anonKey: "", syncId: "", auto: true },
      meta: parsed.meta || { lastModified: Date.now() },
    };
  } catch {
    return {
      goals: {},
      profile: {},
      lastTargets: null,
      entries: [],
      checkins: [],
      sync: { url: "", anonKey: "", syncId: "", auto: true },
      meta: { lastModified: Date.now() },
    };
  }
}

function saveState() {
  state.meta = state.meta || {};
  state.meta.lastModified = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueAutoSyncPush();
}

function saveGoalsFromForm() {
  state.goals = {
    calories: toNumber(goalCaloriesInput.value),
    protein: toNumber(goalProteinInput.value),
    steps: toNumber(goalStepsInput.value),
    startWeight: toNumber(startWeightInput.value),
  };
  saveState();
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function fmt(value) {
  return Number(value).toFixed(1).replace(".0", "");
}

function signed(value) {
  if (value > 0) return `+${fmt(value)}`;
  if (value < 0) return `-${fmt(Math.abs(value))}`;
  return "0";
}

function round5(value) {
  return Math.round(value / 5) * 5;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
