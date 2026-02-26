// ════════════════════════════════════════════════════════════
//  PowderTrack — App Logic
// ════════════════════════════════════════════════════════════

feather.replace();

// Load custom resorts from localStorage and merge into RESORTS
(function loadCustomResorts() {
  const saved = JSON.parse(localStorage.getItem("pt_custom_resorts") || "[]");
  saved.forEach(r => RESORTS.push(r));
})();

// ── State ─────────────────────────────────────────────────
let state = {
  region: "all",
  search: "",
  minBase: 0,
  sortBy: "fresh",
  unit: "imperial",
  favorites: JSON.parse(localStorage.getItem("pt_favorites") || "[]"),
  selectedResort: null,
  view: "resorts",
  reportSortCol: "new48h",
  reportSortDir: -1,
};

let forecastChart = null;
let forecastChartFull = null;
let tempChartInst = null;
let seasonChartInst = null;

// ── Helpers: Dates ─────────────────────────────────────────
function forecastDates(count = 7) {
  const today = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const result = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    result.push(`${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`);
  }
  return result;
}

function forecastDateRangeStr() {
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() + 1);
  const end   = new Date(today); end.setDate(end.getDate() + 7);
  const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setupControls();
  renderResorts();
  renderSidePanels();
  buildChartResortSelect();
  renderForecastChart(RESORTS[0]);
  renderTempChart();
  renderSeasonChart();
  renderFavorites();
  updateStats();
  feather.replace();
});

// ── Controls ───────────────────────────────────────────────
function setupControls() {
  // Nav tabs
  document.querySelectorAll(".nav-link[data-view]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      switchView(link.dataset.view);
    });
  });

  // Region buttons
  document.getElementById("regionList").addEventListener("click", (e) => {
    const btn = e.target.closest(".region-btn");
    if (!btn) return;
    document.querySelectorAll(".region-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.region = btn.dataset.region;
    renderResorts();
  });

  // Search
  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.search = e.target.value.toLowerCase();
    renderResorts();
  });

  // Base depth slider
  const slider = document.getElementById("minBase");
  slider.addEventListener("input", () => {
    state.minBase = +slider.value;
    document.getElementById("minBaseVal").textContent = `${slider.value}"`;
    renderResorts();
  });

  // Sort
  document.getElementById("sortSelect").addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderResorts();
  });

  // Units
  document.getElementById("unitInches").addEventListener("click", () => setUnit("imperial"));
  document.getElementById("unitCm").addEventListener("click", () => setUnit("metric"));

  // Forecast chart resort select (resorts view)
  document.getElementById("chartResortSelect").addEventListener("change", (e) => {
    const resort = RESORTS.find(r => r.id === +e.target.value);
    if (resort) renderForecastChart(resort);
  });

  // Forecast chart resort select (forecasts view)
  document.getElementById("fcViewResortSelect").addEventListener("change", (e) => {
    const resort = RESORTS.find(r => r.id === +e.target.value);
    if (resort) renderForecastChartFull(resort);
  });

  // Resort modal close
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("resortModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("resortModal")) closeModal();
  });

  // Add Resort button
  document.getElementById("addResortBtn").addEventListener("click", openAddResortModal);
  document.getElementById("addModalClose").addEventListener("click", closeAddResortModal);
  document.getElementById("addModalCancelBtn").addEventListener("click", closeAddResortModal);
  document.getElementById("addResortModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("addResortModal")) closeAddResortModal();
  });
  document.getElementById("addResortForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveCustomResort();
  });

  // Reports table sorting
  document.querySelectorAll(".sortable-th").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (state.reportSortCol === col) {
        state.reportSortDir *= -1;
      } else {
        state.reportSortCol = col;
        state.reportSortDir = -1;
      }
      renderReportsView();
    });
  });
}

// ── View Switching ─────────────────────────────────────────
function switchView(view) {
  state.view = view;

  document.querySelectorAll(".main-layout, .full-view").forEach(el => { el.hidden = true; });
  document.getElementById(`view-${view}`).hidden = false;

  document.querySelectorAll(".nav-link[data-view]").forEach(l => {
    l.classList.toggle("active", l.dataset.view === view);
  });

  if (view === "forecasts")  renderForecastsView();
  if (view === "reports")    renderReportsView();
  if (view === "trailmaps")  renderTrailMapsView();
}

function setUnit(unit) {
  state.unit = unit;
  document.getElementById("unitInches").classList.toggle("active", unit === "imperial");
  document.getElementById("unitCm").classList.toggle("active", unit === "metric");
  renderResorts();
  renderSidePanels();
  updateStats();
}

// ── Conversion helpers ─────────────────────────────────────
function snow(inches) {
  if (state.unit === "metric") return `${Math.round(inches * 2.54)} cm`;
  return `${inches}"`;
}
function temp(f) {
  if (state.unit === "metric") return `${Math.round((f - 32) * 5 / 9)}°C`;
  return `${f}°F`;
}
function wind(mph) {
  if (state.unit === "metric") return `${Math.round(mph * 1.609)} km/h`;
  return `${mph} mph`;
}
function elevation(ft) {
  if (state.unit === "metric") return `${Math.round(ft * 0.3048).toLocaleString()} m`;
  return `${ft.toLocaleString()} ft`;
}

// ── Region label ───────────────────────────────────────────
const REGION_LABELS = {
  sierra: "Sierra Nevada", wasatch: "Wasatch", rockies: "Rockies",
  cascades: "Cascades", northeast: "Northeast", alps: "Alps", japan: "Japan", other: "Other",
};

// ── Filter & Sort ──────────────────────────────────────────
function filteredResorts() {
  let list = RESORTS.filter(r => {
    if (state.region !== "all" && r.region !== state.region) return false;
    if (state.search && !r.name.toLowerCase().includes(state.search) &&
        !r.country.toLowerCase().includes(state.search) &&
        !(r.state || "").toLowerCase().includes(state.search)) return false;
    if (r.base_in < state.minBase) return false;
    return true;
  });

  const sortFns = {
    fresh:    (a, b) => b.new48h_in  - a.new48h_in,
    base:     (a, b) => b.base_in    - a.base_in,
    forecast: (a, b) => b.forecast7d_in - a.forecast7d_in,
    rating:   (a, b) => b.rating     - a.rating,
  };
  list.sort(sortFns[state.sortBy] || sortFns.fresh);
  return list;
}

// ── Render Resort Cards ────────────────────────────────────
function renderResorts() {
  const list = filteredResorts();
  const grid = document.getElementById("resortGrid");
  document.getElementById("resortCount").textContent = `Showing ${list.length} resort${list.length !== 1 ? "s" : ""}`;

  const dates = forecastDates(7);

  grid.innerHTML = list.map(r => {
    const isFav = state.favorites.includes(r.id);
    const stars = "★".repeat(Math.round(r.rating)) + "☆".repeat(5 - Math.round(r.rating));
    const danger = avalancheBadge(r.avalanche_danger);
    const surface = surfaceBadge(r.surface);
    const forecast7 = r.forecast.reduce((s, d) => s + d.snow, 0);
    const forecastBars = r.forecast.slice(0, 7).map((d, i) =>
      `<div class="fc-bar-wrap">
        <div class="fc-bar" style="height:${Math.max(4, d.snow * 8)}px" title="${dates[i]}: ${d.snow}&quot;"></div>
        <div class="fc-bar-val">${d.snow > 0 ? d.snow + '"' : ''}</div>
        <div class="fc-day">${dates[i].split(' ')[0]}</div>
      </div>`
    ).join("");

    const customTag = r.custom ? '<span class="badge badge-custom">Custom</span>' : '';

    return `
    <div class="resort-card" data-id="${r.id}">
      <div class="card-header">
        <div class="card-title-group">
          <h3 class="card-resort-name">${r.name}</h3>
          <span class="card-location">${r.state ? r.state + ", " : ""}${r.country}</span>
        </div>
        <button class="fav-btn ${isFav ? "active" : ""}" data-id="${r.id}" title="Favorite">★</button>
      </div>

      <div class="card-badges">
        ${surface}
        ${danger}
        ${r.groomed_today ? '<span class="badge groomed">Groomed</span>' : ''}
        ${customTag}
      </div>

      <div class="card-snow-row">
        <div class="snow-stat">
          <div class="snow-big">${snow(r.new48h_in)}</div>
          <div class="snow-label">New (48h)</div>
        </div>
        <div class="snow-stat">
          <div class="snow-big accent">${snow(r.base_in)}</div>
          <div class="snow-label">Base Depth</div>
        </div>
        <div class="snow-stat">
          <div class="snow-big green">${snow(forecast7)}</div>
          <div class="snow-label">7-Day Fcst</div>
        </div>
      </div>

      <div class="card-meta-row">
        <span class="meta-item"><i data-feather="thermometer"></i> ${temp(r.temp_f)}</span>
        <span class="meta-item"><i data-feather="wind"></i> ${wind(r.wind_mph)}</span>
        <span class="meta-item"><i data-feather="eye"></i> ${r.visibility}</span>
        <span class="meta-item"><i data-feather="map"></i> ${elevation(r.elevation.summit)}</span>
      </div>

      <div class="terrain-bar-group">
        <div class="terrain-label-row">
          <span class="beginner-label">Beginner</span>
          <span class="inter-label">Intermediate</span>
          <span class="adv-label">Advanced</span>
        </div>
        <div class="terrain-bar">
          <div class="seg beginner" style="width:${r.terrain.beginner}%"></div>
          <div class="seg intermediate" style="width:${r.terrain.intermediate}%"></div>
          <div class="seg advanced" style="width:${r.terrain.advanced}%"></div>
        </div>
        <div class="terrain-pct-row">
          <span>${r.terrain.beginner}%</span><span>${r.terrain.intermediate}%</span><span>${r.terrain.advanced}%</span>
        </div>
      </div>

      <div class="fc-mini">${forecastBars}</div>

      <div class="card-footer">
        <div class="trail-info">
          <span>${r.open_trails}/${r.total_trails} trails</span>
          <span>${r.lifts_open}/${r.lifts_total} lifts</span>
        </div>
        <div class="card-rating">${stars}</div>
      </div>

      <button class="card-detail-btn" data-id="${r.id}">View Full Conditions</button>
    </div>
    `;
  }).join("");

  feather.replace();

  grid.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(+btn.dataset.id);
    });
  });

  grid.querySelectorAll(".card-detail-btn").forEach(btn => {
    btn.addEventListener("click", () => openModal(+btn.dataset.id));
  });
}

// ── Badges ─────────────────────────────────────────────────
function avalancheBadge(danger) {
  const map = {
    "Low": "badge-low", "Moderate": "badge-moderate",
    "Considerable": "badge-considerable", "High": "badge-high",
    "Extreme": "badge-extreme", "Unknown": "badge-unknown",
  };
  return `<span class="badge avalanche ${map[danger] || ''}">${danger} Avalanche</span>`;
}
function surfaceBadge(surface) {
  const map = { "Powder": "badge-powder", "Packed Powder": "badge-packed", "Groomed": "badge-groomed" };
  return `<span class="badge surface ${map[surface] || ''}">${surface}</span>`;
}

// ── Favorites ──────────────────────────────────────────────
function toggleFavorite(id) {
  const idx = state.favorites.indexOf(id);
  if (idx === -1) state.favorites.push(id);
  else state.favorites.splice(idx, 1);
  localStorage.setItem("pt_favorites", JSON.stringify(state.favorites));
  renderResorts();
  renderFavorites();
}

function renderFavorites() {
  const el = document.getElementById("favoritesList");
  if (state.favorites.length === 0) {
    el.innerHTML = `<p class="empty-fav">Click ★ on a resort to save it here.</p>`;
    return;
  }
  el.innerHTML = state.favorites.map(id => {
    const r = RESORTS.find(x => x.id === id);
    if (!r) return "";
    return `<div class="fav-item">
      <span class="fav-name">${r.name}</span>
      <span class="fav-snow">${snow(r.new48h_in)} new</span>
    </div>`;
  }).join("");
}

// ── Side Panels ────────────────────────────────────────────
function renderSidePanels() {
  const picks = [...RESORTS].sort((a, b) => b.new48h_in - a.new48h_in).slice(0, 4);
  document.getElementById("powderPicks").innerHTML = picks.map((r, i) => `
    <div class="pick-item">
      <span class="pick-rank">#${i + 1}</span>
      <div class="pick-info">
        <span class="pick-name">${r.name}</span>
        <span class="pick-region">${r.state || r.country}</span>
      </div>
      <span class="pick-snow">${snow(r.new48h_in)}</span>
    </div>
  `).join("");

  const open = RESORTS.filter(r => r.status === "open");
  document.getElementById("conditionsSummary").innerHTML = `
    <div class="cond-row">
      <span class="cond-label">Resorts Open</span>
      <span class="cond-val">${open.length} / ${RESORTS.length}</span>
    </div>
    <div class="cond-row">
      <span class="cond-label">Best Base</span>
      <span class="cond-val">${snow(Math.max(...RESORTS.map(r => r.base_in)))}</span>
    </div>
    <div class="cond-row">
      <span class="cond-label">Most New Snow</span>
      <span class="cond-val">${snow(Math.max(...RESORTS.map(r => r.new48h_in)))}</span>
    </div>
    <div class="cond-row">
      <span class="cond-label">Best Forecast</span>
      <span class="cond-val">${snow(Math.max(...RESORTS.map(r => r.forecast7d_in)))}</span>
    </div>
    <div class="cond-row">
      <span class="cond-label">Avg Avalanche Risk</span>
      <span class="cond-val">Considerable</span>
    </div>
    <div class="cond-row">
      <span class="cond-label">Last Updated</span>
      <span class="cond-val">Today 06:00</span>
    </div>
  `;
}

// ── Stats Bar ──────────────────────────────────────────────
function updateStats() {
  const best48  = Math.max(...RESORTS.map(r => r.new48h_in));
  const deepest = Math.max(...RESORTS.map(r => r.base_in));
  const bestFcst = Math.max(...RESORTS.map(r => r.forecast7d_in));
  document.getElementById("statFresh").textContent    = snow(best48);
  document.getElementById("statBase").textContent     = snow(deepest);
  document.getElementById("statForecast").textContent = snow(bestFcst);
  document.getElementById("statResorts").textContent  = RESORTS.filter(r => r.status === "open").length;
}

// ── Chart Resort Select ────────────────────────────────────
function buildChartResortSelect() {
  const opts = RESORTS.map(r => `<option value="${r.id}">${r.name}</option>`).join("");
  document.getElementById("chartResortSelect").innerHTML = opts;
  document.getElementById("fcViewResortSelect").innerHTML = opts;
}

// ── Forecast Chart (resorts view) ──────────────────────────
function renderForecastChart(resort) {
  const ctx = document.getElementById("forecastChart").getContext("2d");
  if (forecastChart) forecastChart.destroy();

  const labels   = forecastDates(7);
  const snowData = resort.forecast.map(d => d.snow);
  const tempData = resort.forecast.map(d => state.unit === "metric"
    ? Math.round((d.high - 32) * 5 / 9)
    : d.high);
  const tempLabel = state.unit === "metric" ? "High Temp (°C)" : "High Temp (°F)";
  const tempSuffix = state.unit === "metric" ? "°C" : "°F";
  const snowLabel = state.unit === "metric" ? "Snowfall (cm)" : "Snowfall (in)";
  const snowSuffix = state.unit === "metric" ? " cm" : '"';

  forecastChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: snowLabel,
          data: state.unit === "metric" ? snowData.map(v => Math.round(v * 2.54)) : snowData,
          backgroundColor: "rgba(99,179,237,0.7)",
          borderColor: "rgba(99,179,237,1)",
          borderWidth: 1,
          yAxisID: "ySnow",
          order: 2,
        },
        {
          type: "line",
          label: tempLabel,
          data: tempData,
          borderColor: "#f97316",
          backgroundColor: "rgba(249,115,22,0.1)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#f97316",
          pointRadius: 5,
          yAxisID: "yTemp",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a2535",
          borderColor: "#334155",
          borderWidth: 1,
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label.includes("Snow") || ctx.dataset.label.includes("Snowfall"))
                return ` ${ctx.raw}${snowSuffix} snowfall`;
              return ` ${ctx.raw}${tempSuffix} high`;
            }
          }
        }
      },
      scales: {
        ySnow: {
          position: "left",
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "#94a3b8", callback: v => v + snowSuffix },
          title: { display: true, text: snowLabel, color: "#63b3ed" },
        },
        yTemp: {
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#f97316", callback: v => v + tempSuffix },
          title: { display: true, text: tempLabel, color: "#f97316" },
        },
        x: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "#94a3b8" },
        },
      },
    },
  });
}

// ── Forecast View ──────────────────────────────────────────
function renderForecastsView() {
  document.getElementById("forecastDateRange").textContent = forecastDateRangeStr();

  const sel = document.getElementById("fcViewResortSelect");
  const resort = RESORTS.find(r => r.id === +sel.value) || RESORTS[0];
  renderForecastChartFull(resort);
  renderForecastCompare();
}

function renderForecastChartFull(resort) {
  const ctx = document.getElementById("forecastChartFull").getContext("2d");
  if (forecastChartFull) forecastChartFull.destroy();

  const labels   = forecastDates(7);
  const snowData = resort.forecast.map(d => d.snow);
  const tempData = resort.forecast.map(d => d.high);

  forecastChartFull = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Snowfall (in)",
          data: snowData,
          backgroundColor: "rgba(99,179,237,0.75)",
          borderColor: "rgba(99,179,237,1)",
          borderWidth: 1,
          yAxisID: "ySnow",
          order: 2,
          borderRadius: 4,
        },
        {
          type: "line",
          label: "High Temp (°F)",
          data: tempData,
          borderColor: "#f97316",
          backgroundColor: "rgba(249,115,22,0.08)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#f97316",
          pointRadius: 6,
          pointHoverRadius: 8,
          yAxisID: "yTemp",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: "#94a3b8", boxWidth: 12, font: { size: 13 } }
        },
        tooltip: {
          backgroundColor: "#1a2535",
          borderColor: "#334155",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label.includes("Snow")) return ` ${ctx.raw}" snowfall`;
              return ` ${ctx.raw}°F high`;
            }
          }
        }
      },
      scales: {
        ySnow: {
          position: "left",
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "#94a3b8", font: { size: 13 }, callback: v => v + '"' },
          title: { display: true, text: "Snowfall (inches)", color: "#63b3ed", font: { size: 13 } },
        },
        yTemp: {
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#f97316", font: { size: 13 }, callback: v => v + "°F" },
          title: { display: true, text: "Temp High (°F)", color: "#f97316", font: { size: 13 } },
        },
        x: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "#94a3b8", font: { size: 13 } },
        },
      },
    },
  });
}

function renderForecastCompare() {
  const dates = forecastDates(7);
  const sorted = [...RESORTS].sort((a, b) => {
    const aTotal = a.forecast.reduce((s, d) => s + d.snow, 0);
    const bTotal = b.forecast.reduce((s, d) => s + d.snow, 0);
    return bTotal - aTotal;
  });

  const maxSnow = Math.max(...sorted.flatMap(r => r.forecast.map(d => d.snow)), 1);

  const grid = document.getElementById("forecastCompareGrid");
  grid.innerHTML = sorted.map(r => {
    const total = r.forecast.reduce((s, d) => s + d.snow, 0);
    const bars = r.forecast.map((d, i) => {
      const pct = Math.round((d.snow / maxSnow) * 100);
      const cls = d.snow >= 8 ? "fc-bar-high" : d.snow >= 3 ? "fc-bar-med" : "fc-bar-low";
      return `<div class="compare-day">
        <div class="compare-bar-wrap">
          <div class="compare-bar ${cls}" style="height:${Math.max(2, pct * 0.6)}px" title="${dates[i]}: ${d.snow}&quot;"></div>
        </div>
        <div class="compare-snow-val">${d.snow > 0 ? d.snow + '"' : '—'}</div>
        <div class="compare-date">${dates[i].split(' ')[0]}</div>
      </div>`;
    }).join("");

    return `
    <div class="compare-resort-card">
      <div class="compare-header">
        <div>
          <div class="compare-name">${r.name}</div>
          <div class="compare-loc">${r.state ? r.state + ', ' : ''}${r.country}</div>
        </div>
        <div class="compare-total">${total}"<span class="compare-total-lbl"> 7-day</span></div>
      </div>
      <div class="compare-days">${bars}</div>
    </div>
    `;
  }).join("");
}

// ── Reports View ───────────────────────────────────────────
function renderReportsView() {
  const now = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  document.getElementById("reportDateLabel").textContent = `Conditions as of ${now}`;

  const colMap = {
    name:      r => r.name,
    base:      r => r.base_in,
    new48h:    r => r.new48h_in,
    forecast7d: r => r.forecast7d_in,
    season:    r => r.season_total_in,
  };

  const sorted = [...RESORTS].sort((a, b) => {
    const fn = colMap[state.reportSortCol];
    if (!fn) return 0;
    const va = fn(a), vb = fn(b);
    return typeof va === "string"
      ? va.localeCompare(vb) * state.reportSortDir
      : (vb - va) * state.reportSortDir * -1;
  });

  // Update sort arrows
  document.querySelectorAll(".sortable-th").forEach(th => {
    const arrow = th.querySelector(".sort-arrow");
    if (th.dataset.col === state.reportSortCol) {
      arrow.textContent = state.reportSortDir === -1 ? " ↓" : " ↑";
      th.classList.add("active-sort");
    } else {
      arrow.textContent = "";
      th.classList.remove("active-sort");
    }
  });

  document.getElementById("reportsBody").innerHTML = sorted.map(r => {
    const dangerClass = {
      "Low": "danger-low", "Moderate": "danger-mod", "Considerable": "danger-con",
      "High": "danger-high", "Extreme": "danger-ext"
    }[r.avalanche_danger] || "";
    return `
    <tr class="report-row" data-id="${r.id}">
      <td class="report-name">
        <span class="rname">${r.name}</span>
        ${r.custom ? '<span class="badge badge-custom" style="font-size:.65rem;margin-left:.4rem">Custom</span>' : ''}
      </td>
      <td><span class="region-tag">${REGION_LABELS[r.region] || r.region}</span></td>
      <td class="num-cell accent">${snow(r.base_in)}</td>
      <td class="num-cell">${snow(r.new48h_in)}</td>
      <td class="num-cell green">${snow(r.forecast7d_in)}</td>
      <td class="num-cell yellow">${snow(r.season_total_in)}</td>
      <td>${r.surface}</td>
      <td>${r.visibility}</td>
      <td><span class="danger-badge ${dangerClass}">${r.avalanche_danger}</span></td>
      <td>${r.open_trails}/${r.total_trails}</td>
      <td>${r.lifts_open}/${r.lifts_total}</td>
    </tr>
    `;
  }).join("");

  document.querySelectorAll(".report-row").forEach(row => {
    row.addEventListener("click", () => {
      switchView("resorts");
      setTimeout(() => openModal(+row.dataset.id), 50);
    });
  });
}

// ── Trail Maps View ────────────────────────────────────────
function renderTrailMapsView() {
  const grid = document.getElementById("trailmapGrid");
  grid.innerHTML = RESORTS.map(r => {
    const total = r.forecast.reduce((s, d) => s + d.snow, 0);
    return `
    <div class="trailmap-card">
      <div class="tm-header">
        <div class="tm-name">${r.name}</div>
        <div class="tm-loc">${r.state ? r.state + ', ' : ''}${r.country}</div>
      </div>

      <div class="tm-terrain">
        <div class="terrain-bar" style="height:12px;border-radius:6px">
          <div class="seg beginner" style="width:${r.terrain.beginner}%"></div>
          <div class="seg intermediate" style="width:${r.terrain.intermediate}%"></div>
          <div class="seg advanced" style="width:${r.terrain.advanced}%"></div>
        </div>
        <div class="tm-terrain-labels">
          <span class="tm-beg">&#9679; ${r.terrain.beginner}% Beg</span>
          <span class="tm-int">&#9679; ${r.terrain.intermediate}% Int</span>
          <span class="tm-adv">&#9679; ${r.terrain.advanced}% Adv</span>
        </div>
      </div>

      <div class="tm-stats">
        <div class="tm-stat"><strong>${r.open_trails}</strong><span>Trails Open</span></div>
        <div class="tm-stat"><strong>${r.total_trails}</strong><span>Total Trails</span></div>
        <div class="tm-stat"><strong>${r.lifts_open}</strong><span>Lifts Open</span></div>
        <div class="tm-stat"><strong>${snow(r.base_in)}</strong><span>Base</span></div>
      </div>

      <div class="tm-actions">
        ${r.trail_map_url
          ? `<a href="${r.trail_map_url}" target="_blank" rel="noopener" class="tm-btn tm-btn-primary">
               <i data-feather="map"></i> View Trail Map
             </a>`
          : `<span class="tm-btn-disabled">No trail map available</span>`
        }
        <button class="tm-btn tm-btn-secondary" data-id="${r.id}">
          <i data-feather="info"></i> Conditions
        </button>
      </div>
    </div>
    `;
  }).join("");

  feather.replace();

  grid.querySelectorAll(".tm-btn-secondary[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchView("resorts");
      setTimeout(() => openModal(+btn.dataset.id), 50);
    });
  });
}

// ── Temp Outlook Chart ─────────────────────────────────────
function renderTempChart() {
  const ctx = document.getElementById("tempChart").getContext("2d");
  if (tempChartInst) tempChartInst.destroy();
  tempChartInst = new Chart(ctx, {
    type: "line",
    data: {
      labels: TEMP_OUTLOOK.labels,
      datasets: [
        {
          label: "High",
          data: TEMP_OUTLOOK.high,
          borderColor: "#f97316",
          backgroundColor: "rgba(249,115,22,0.15)",
          fill: "+1",
          tension: 0.4,
          pointRadius: 3,
        },
        {
          label: "Low",
          data: TEMP_OUTLOOK.low,
          borderColor: "#63b3ed",
          backgroundColor: "rgba(99,179,237,0.1)",
          tension: 0.4,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8", boxWidth: 10, font: { size: 11 } } },
        tooltip: { backgroundColor: "#1a2535", borderColor: "#334155", borderWidth: 1 }
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "#94a3b8", font: { size: 10 } } },
        y: { grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "#94a3b8", font: { size: 10 }, callback: v => v + "°F" } },
      },
    },
  });
}

// ── Season Snowfall Chart ─────────────────────────────────
function renderSeasonChart() {
  const ctx = document.getElementById("seasonChart").getContext("2d");
  if (seasonChartInst) seasonChartInst.destroy();
  seasonChartInst = new Chart(ctx, {
    type: "bar",
    data: {
      labels: SEASON_DATA.labels,
      datasets: [
        {
          label: "This Season",
          data: SEASON_DATA.current,
          backgroundColor: "rgba(99,179,237,0.75)",
          borderRadius: 4,
        },
        {
          label: "Avg Season",
          data: SEASON_DATA.avg,
          backgroundColor: "rgba(148,163,184,0.35)",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8", boxWidth: 10, font: { size: 10 } } },
        tooltip: { backgroundColor: "#1a2535", borderColor: "#334155", borderWidth: 1,
          callbacks: { label: ctx => ` ${ctx.raw}"` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 9 }, maxRotation: 30 } },
        y: { grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "#94a3b8", font: { size: 10 }, callback: v => v + '"' } },
      },
    },
  });
}

// ── Modal ──────────────────────────────────────────────────
function openModal(id) {
  const r = RESORTS.find(x => x.id === id);
  if (!r) return;
  const modal = document.getElementById("resortModal");
  const content = document.getElementById("modalContent");

  const dates = forecastDates(7);
  const forecast7 = r.forecast.reduce((s, d) => s + d.snow, 0);
  const forecastRows = r.forecast.map((d, i) => `
    <tr>
      <td>${dates[i]}</td>
      <td class="${d.snow >= 6 ? 'high-snow' : d.snow >= 2 ? 'med-snow' : ''}">${snow(d.snow)}</td>
      <td>${temp(d.high)}</td>
      <td>${temp(d.low)}</td>
    </tr>
  `).join("");

  const webcamSection = r.webcam_url ? `
    <div class="modal-section modal-section-full webcam-section">
      <div class="webcam-header">
        <h4>Live Webcam</h4>
        <a href="${r.webcam_url}" target="_blank" rel="noopener" class="webcam-open-btn">
          <i data-feather="external-link"></i> Open in New Tab
        </a>
      </div>
      <div class="webcam-embed-wrap">
        <iframe
          src="${r.webcam_url}"
          class="webcam-iframe"
          title="Live webcam — ${r.name}"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups">
        </iframe>
        <div class="webcam-overlay-msg">
          <i data-feather="video"></i>
          <p>Webcam may be blocked by browser security.</p>
          <a href="${r.webcam_url}" target="_blank" rel="noopener" class="webcam-link-btn">
            Open live webcam page →
          </a>
        </div>
      </div>
    </div>
  ` : '';

  const trailMapBtn = r.trail_map_url
    ? `<a href="${r.trail_map_url}" target="_blank" rel="noopener" class="modal-trail-map-btn">
         <i data-feather="map"></i> View Trail Map
       </a>`
    : '';

  content.innerHTML = `
    <div class="modal-hero">
      <h2 class="modal-resort-name">${r.name}</h2>
      <p class="modal-location">${r.state ? r.state + " · " : ""}${r.country} · ${elevation(r.elevation.base)} – ${elevation(r.elevation.summit)}</p>
      <div class="modal-badges">
        ${avalancheBadge(r.avalanche_danger)}
        ${surfaceBadge(r.surface)}
        ${r.groomed_today ? '<span class="badge groomed">Groomed Today</span>' : ''}
        ${r.custom ? '<span class="badge badge-custom">Custom Resort</span>' : ''}
      </div>
      ${trailMapBtn}
    </div>

    <div class="modal-grid">
      <div class="modal-section">
        <h4>Snow Report</h4>
        <div class="modal-stats">
          <div class="modal-stat"><div class="ms-val">${snow(r.new48h_in)}</div><div class="ms-lbl">New (48h)</div></div>
          <div class="modal-stat"><div class="ms-val accent">${snow(r.base_in)}</div><div class="ms-lbl">Base</div></div>
          <div class="modal-stat"><div class="ms-val green">${snow(forecast7)}</div><div class="ms-lbl">7-Day Fcst</div></div>
          <div class="modal-stat"><div class="ms-val yellow">${snow(r.season_total_in)}</div><div class="ms-lbl">Season Total</div></div>
        </div>
      </div>

      <div class="modal-section">
        <h4>Current Conditions</h4>
        <div class="modal-cond-list">
          <div class="mc-item"><span>Temperature</span><strong>${temp(r.temp_f)}</strong></div>
          <div class="mc-item"><span>Wind Speed</span><strong>${wind(r.wind_mph)}</strong></div>
          <div class="mc-item"><span>Visibility</span><strong>${r.visibility}</strong></div>
          <div class="mc-item"><span>Surface</span><strong>${r.surface}</strong></div>
          <div class="mc-item"><span>Last Updated</span><strong>${r.last_updated}</strong></div>
        </div>
      </div>

      <div class="modal-section">
        <h4>Terrain Breakdown</h4>
        <div class="terrain-bar" style="height:14px;border-radius:7px;overflow:hidden;margin-bottom:.5rem">
          <div class="seg beginner" style="width:${r.terrain.beginner}%"></div>
          <div class="seg intermediate" style="width:${r.terrain.intermediate}%"></div>
          <div class="seg advanced" style="width:${r.terrain.advanced}%"></div>
        </div>
        <div class="modal-terrain-labels">
          <span class="beg">&#9679; Beginner ${r.terrain.beginner}%</span>
          <span class="int">&#9679; Intermediate ${r.terrain.intermediate}%</span>
          <span class="adv">&#9679; Expert ${r.terrain.advanced}%</span>
        </div>
        <div class="mc-item mt8"><span>Trails Open</span><strong>${r.open_trails} / ${r.total_trails}</strong></div>
        <div class="mc-item"><span>Lifts Open</span><strong>${r.lifts_open} / ${r.lifts_total}</strong></div>
      </div>

      <div class="modal-section modal-section-full">
        <h4>7-Day Forecast — <span class="forecast-dates-caption">${forecastDateRangeStr()}</span></h4>
        <table class="forecast-table">
          <thead><tr><th>Date</th><th>Snow</th><th>High</th><th>Low</th></tr></thead>
          <tbody>${forecastRows}</tbody>
        </table>
      </div>

      ${webcamSection}
    </div>
  `;

  modal.hidden = false;
  feather.replace();
}

function closeModal() {
  document.getElementById("resortModal").hidden = true;
}

// ── Add Resort Modal ───────────────────────────────────────
function openAddResortModal() {
  document.getElementById("addResortForm").reset();
  document.getElementById("addResortModal").hidden = false;
  feather.replace();
}

function closeAddResortModal() {
  document.getElementById("addResortModal").hidden = true;
}

function saveCustomResort() {
  const name   = document.getElementById("ar-name").value.trim();
  const region = document.getElementById("ar-region").value;
  const country = document.getElementById("ar-country").value.trim();
  const state_ = document.getElementById("ar-state").value.trim();
  const base   = parseInt(document.getElementById("ar-base").value) || 0;
  const new48h = parseInt(document.getElementById("ar-new48h").value) || 0;
  const tempF  = parseInt(document.getElementById("ar-temp").value) || 28;
  const webcam = document.getElementById("ar-webcam").value.trim();
  const trailmap = document.getElementById("ar-trailmap").value.trim();

  if (!name || !region || !country) return;

  const newId = Math.max(...RESORTS.map(r => r.id)) + 1;
  const forecast7d = Math.round(new48h * 2.5);

  const resort = {
    id: newId,
    name,
    region,
    country,
    state: state_,
    elevation: { base: 0, summit: 0 },
    base_in: base,
    new48h_in: new48h,
    forecast7d_in: forecast7d,
    open_trails: 0,
    total_trails: 0,
    lifts_open: 0,
    lifts_total: 0,
    rating: 0,
    surface: "Unknown",
    wind_mph: 0,
    temp_f: tempF,
    visibility: "Unknown",
    groomed_today: false,
    status: "open",
    terrain: { beginner: 33, intermediate: 34, advanced: 33 },
    forecast: Array.from({ length: 7 }, (_, i) => ({
      snow: i < 2 ? new48h : Math.max(0, new48h - i),
      high: tempF + i * 2,
      low: tempF - 10,
    })),
    season_total_in: 0,
    avalanche_danger: "Unknown",
    last_updated: new Date().toISOString().slice(0, 16).replace("T", " "),
    lat: 0, lon: 0,
    webcam_url: webcam,
    trail_map_url: trailmap,
    custom: true,
  };

  RESORTS.push(resort);

  const saved = JSON.parse(localStorage.getItem("pt_custom_resorts") || "[]");
  saved.push(resort);
  localStorage.setItem("pt_custom_resorts", JSON.stringify(saved));

  buildChartResortSelect();
  renderResorts();
  updateStats();
  renderSidePanels();
  closeAddResortModal();
}
