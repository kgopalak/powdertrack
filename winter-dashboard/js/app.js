// ════════════════════════════════════════════════════════════
//  PowderTrack — App Logic
// ════════════════════════════════════════════════════════════

feather.replace();

// ── State ─────────────────────────────────────────────────
let state = {
  region: "all",
  search: "",
  minBase: 0,
  sortBy: "fresh",
  unit: "imperial",   // "imperial" | "metric"
  favorites: JSON.parse(localStorage.getItem("pt_favorites") || "[]"),
  selectedResort: null,
};

let forecastChart = null;
let tempChartInst = null;
let seasonChartInst = null;

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

  // Chart resort select
  document.getElementById("chartResortSelect").addEventListener("change", (e) => {
    const resort = RESORTS.find(r => r.id === +e.target.value);
    if (resort) renderForecastChart(resort);
  });

  // Modal close
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("resortModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("resortModal")) closeModal();
  });
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

// ── Filter & Sort ──────────────────────────────────────────
function filteredResorts() {
  let list = RESORTS.filter(r => {
    if (state.region !== "all" && r.region !== state.region) return false;
    if (state.search && !r.name.toLowerCase().includes(state.search) &&
        !r.country.toLowerCase().includes(state.search) &&
        !r.state.toLowerCase().includes(state.search)) return false;
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

  grid.innerHTML = list.map(r => {
    const isFav = state.favorites.includes(r.id);
    const stars = "★".repeat(Math.round(r.rating)) + "☆".repeat(5 - Math.round(r.rating));
    const danger = avalancheBadge(r.avalanche_danger);
    const surface = surfaceBadge(r.surface);
    const forecast7 = r.forecast.reduce((s, d) => s + d.snow, 0);
    const forecastBars = r.forecast.slice(0, 7).map(d =>
      `<div class="fc-bar-wrap">
        <div class="fc-bar" style="height:${Math.max(4, d.snow * 8)}px" title="${d.snow}&quot;"></div>
        <div class="fc-bar-val">${d.snow > 0 ? d.snow + '"' : ''}</div>
        <div class="fc-day">${d.day}</div>
      </div>`
    ).join("");

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
          <div class="seg beginner" style="width:${r.terrain.beginner}%" title="Beginner ${r.terrain.beginner}%"></div>
          <div class="seg intermediate" style="width:${r.terrain.intermediate}%" title="Intermediate ${r.terrain.intermediate}%"></div>
          <div class="seg advanced" style="width:${r.terrain.advanced}%" title="Advanced ${r.terrain.advanced}%"></div>
        </div>
        <div class="terrain-pct-row">
          <span>${r.terrain.beginner}%</span><span>${r.terrain.intermediate}%</span><span>${r.terrain.advanced}%</span>
        </div>
      </div>

      <div class="fc-mini">
        ${forecastBars}
      </div>

      <div class="card-footer">
        <div class="trail-info">
          <span>${r.open_trails}/${r.total_trails} trails</span>
          <span>${r.lifts_open}/${r.lifts_total} lifts</span>
        </div>
        <div class="card-rating" title="${r.rating}★">${stars}</div>
      </div>

      <button class="card-detail-btn" data-id="${r.id}">View Full Conditions</button>
    </div>
    `;
  }).join("");

  // Reattach feather icons
  feather.replace();

  // Favorite buttons
  grid.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(+btn.dataset.id);
    });
  });

  // Detail buttons
  grid.querySelectorAll(".card-detail-btn").forEach(btn => {
    btn.addEventListener("click", () => openModal(+btn.dataset.id));
  });
}

// ── Badges ─────────────────────────────────────────────────
function avalancheBadge(danger) {
  const map = {
    "Low": "badge-low", "Moderate": "badge-moderate",
    "Considerable": "badge-considerable", "High": "badge-high", "Extreme": "badge-extreme"
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
  // Powder picks (top 4 by new snow)
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

  // Conditions summary
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
  const best48 = Math.max(...RESORTS.map(r => r.new48h_in));
  const deepest = Math.max(...RESORTS.map(r => r.base_in));
  const bestFcst = Math.max(...RESORTS.map(r => r.forecast7d_in));
  document.getElementById("statFresh").textContent    = snow(best48);
  document.getElementById("statBase").textContent     = snow(deepest);
  document.getElementById("statForecast").textContent = snow(bestFcst);
  document.getElementById("statResorts").textContent  = RESORTS.filter(r => r.status === "open").length;
}

// ── Chart Resort Select ────────────────────────────────────
function buildChartResortSelect() {
  const sel = document.getElementById("chartResortSelect");
  sel.innerHTML = RESORTS.map(r => `<option value="${r.id}">${r.name}</option>`).join("");
}

// ── Forecast Chart ─────────────────────────────────────────
function renderForecastChart(resort) {
  const ctx = document.getElementById("forecastChart").getContext("2d");
  if (forecastChart) forecastChart.destroy();

  const labels = resort.forecast.map(d => d.day);
  const snowData = resort.forecast.map(d => d.snow);
  const tempData = resort.forecast.map(d => d.high);

  forecastChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Snowfall (in)",
          data: snowData,
          backgroundColor: "rgba(99,179,237,0.7)",
          borderColor: "rgba(99,179,237,1)",
          borderWidth: 1,
          yAxisID: "ySnow",
          order: 2,
        },
        {
          type: "line",
          label: "High Temp (°F)",
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
          ticks: { color: "#94a3b8", callback: v => v + '"' },
          title: { display: true, text: "Snowfall (in)", color: "#63b3ed" },
        },
        yTemp: {
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#f97316", callback: v => v + "°F" },
          title: { display: true, text: "Temp °F", color: "#f97316" },
        },
        x: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "#94a3b8" },
        },
      },
    },
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
        legend: {
          labels: { color: "#94a3b8", boxWidth: 10, font: { size: 11 } }
        },
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

  const forecast7 = r.forecast.reduce((s, d) => s + d.snow, 0);
  const forecastRows = r.forecast.map(d => `
    <tr>
      <td>${d.day}</td>
      <td class="${d.snow >= 6 ? 'high-snow' : d.snow >= 2 ? 'med-snow' : ''}">${snow(d.snow)}</td>
      <td>${temp(d.high)}</td>
      <td>${temp(d.low)}</td>
    </tr>
  `).join("");

  content.innerHTML = `
    <div class="modal-hero">
      <h2 class="modal-resort-name">${r.name}</h2>
      <p class="modal-location">${r.state ? r.state + " · " : ""}${r.country} · ${elevation(r.elevation.base)} – ${elevation(r.elevation.summit)}</p>
      <div class="modal-badges">
        ${avalancheBadge(r.avalanche_danger)}
        ${surfaceBadge(r.surface)}
        ${r.groomed_today ? '<span class="badge groomed">Groomed Today</span>' : ''}
      </div>
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
        <h4>7-Day Forecast</h4>
        <table class="forecast-table">
          <thead><tr><th>Day</th><th>Snow</th><th>High</th><th>Low</th></tr></thead>
          <tbody>${forecastRows}</tbody>
        </table>
      </div>
    </div>
  `;

  modal.hidden = false;
  feather.replace();
}

function closeModal() {
  document.getElementById("resortModal").hidden = true;
}
