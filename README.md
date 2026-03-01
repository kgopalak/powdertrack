# PowderTrack

A real-time ski resort dashboard displaying live snow conditions, multi-model weather forecasts, and resort data for 54 resorts worldwide. Runs entirely in the browser with zero build steps.

## Features

- **Live Weather Data** — Fetches real-time conditions from Open-Meteo (free, no API key)
- **54 Resorts** across 7 regions: Sierra Nevada, Wasatch, Rockies, Cascades, Northeast US, Alps, Japan
- **4 ML Model Comparison** — Overlay GFS, ECMWF IFS, and ECMWF AIFS forecasts on the same chart
- **Custom Resorts** — Add your own resorts with coordinates to get live weather
- **Unit Toggle** — Switch between imperial (in/°F) and metric (cm/°C)
- **Favorites** — Pin resorts to a quick-access sidebar
- **4 Views** — Resort cards, full forecast charts, sortable reports table, trail maps
- **Dark Winter Theme** — CSS-variable-based design system

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Vanilla JavaScript (ES6+) |
| Markup / Style | HTML5, CSS3 with custom properties |
| Charts | Chart.js v4.4.0 (CDN) |
| Icons | Feather Icons (CDN) |
| Weather API | Open-Meteo (free, no key required) |
| Storage | localStorage (favorites + custom resorts) |
| Build | None — open `index.html` in a browser |

## Quick Start

```bash
# Option 1: Open directly
open winter-dashboard/index.html

# Option 2: Local server (avoids potential CORS issues)
npx serve winter-dashboard
# or
python3 -m http.server 8000 -d winter-dashboard
```

The dashboard renders instantly with mock data, then fetches live weather data in the background (2–5 seconds). A green "Live" badge appears in the header when data is current.

## Project Structure

```
powdertrack/
├── README.md
├── .claude/
│   └── CLAUDE.md              # Dev conventions & architecture notes
└── winter-dashboard/
    ├── index.html             # Single-page entry point
    ├── css/
    │   └── style.css          # All styles — dark theme with CSS variables
    ├── js/
    │   ├── data.js            # 54 hardcoded resorts + static data constants
    │   ├── weather-api.js     # Open-Meteo API service (4 forecast models)
    │   └── app.js             # State, rendering, event handling
    └── tests/
        ├── test-helpers.js    # VM-based loader for browser scripts in Node
        ├── weather-api.test.js
        ├── data.test.js
        └── app-helpers.test.js
```

## Architecture

### Data Flow

```
data.js (54 resorts)          weather-api.js (Open-Meteo)
       │                              │
       ▼                              ▼
  RESORTS array  ◄── Object.assign ── mergeIntoResort()
       │
       ▼
  app.js state + render functions ──► DOM
```

1. **`data.js`** defines the `RESORTS` array with 54 resort objects containing static metadata (name, location, coordinates, terrain, trail/lift counts) and placeholder weather fields.
2. **`weather-api.js`** fetches live data from Open-Meteo on page load. `fetchAllResorts()` batches requests in groups of 6, calling the API with each resort's lat/lon. Responses are parsed into a standard format and merged back into the `RESORTS` array via `Object.assign()`.
3. **`app.js`** owns a single global `state` object. Mutate state, then call the relevant render function to update the DOM:

```js
state.region = 'rockies';
renderResorts();
```

### Weather Pipeline

```
Open-Meteo API
     │
     ▼
fetchForecast(resort, model)     ← builds URL with lat/lon/elevation
     │
     ▼
parseDailyForecast(response)     ← extracts 7-day snow/temp/wind
parseCurrentConditions(response) ← extracts latest hourly snapshot
snowfallNextHours(response, 48)  ← sums next-48h snowfall
     │
     ▼
mergeIntoResort(resort, apiData) ← returns new object with _live: true
     │
     ▼
Object.assign(RESORTS[i], merged) ← patches in place, all refs stay valid
```

**Supported Models:**

| Key | Model | Resolution | Endpoint |
|-----|-------|-----------|----------|
| `best_match` | Auto-select (consensus) | Varies | `/v1/forecast` |
| `gfs` | NOAA GFS Seamless | 28 km | `/v1/forecast` |
| `ecmwf_ifs` | ECMWF IFS | 9 km | `/v1/ecmwf` |
| `ecmwf_aifs` | ECMWF AIFS (ML) | 25 km | `/v1/ecmwf` |

Models are fetched lazily — only when the user toggles a checkbox in the Forecasts view. Results are cached in `state.modelData[resortId]`.

### State Management

Single global object, no framework:

```js
let state = {
  region: "all",        // Active region filter
  search: "",           // Search query
  minBase: 0,           // Minimum base depth filter
  sortBy: "fresh",      // Sort: fresh | base | forecast | rating
  unit: "imperial",     // imperial | metric
  favorites: [...],     // Resort IDs (persisted to localStorage)
  selectedResort: null,  // Currently viewed resort
  view: "resorts",      // Active view tab
  dataStatus: "mock",   // mock | loading | live | error
  lastFetch: null,       // Date of last API fetch
  modelData: {},        // Cached model forecasts { resortId: { gfs: [...] } }
  modelToggles: {},     // Which model overlays are enabled
};
```

### Persistence

| Key | Contents | Format |
|-----|----------|--------|
| `pt_favorites` | Array of resort IDs | `[1, 5, 12]` |
| `pt_custom_resorts` | Array of resort objects | Full resort shape with `custom: true` |

### Unit Conversion

Underlying data is always imperial. Conversion happens at display time only:

```js
snow(inches)     // → "24"" or "61 cm"
temp(f)          // → "28°F" or "-2°C"
wind(mph)        // → "15 mph" or "24 km/h"
elevation(ft)    // → "11,053 ft" or "3,369 m"
```

### Charts

Chart.js instances are stored globally and **destroyed before re-creation** to prevent memory leaks:

```js
if (forecastChart) forecastChart.destroy();
forecastChart = new Chart(ctx, { ... });
```

Call `feather.replace()` after any DOM update that inserts Feather icon markup.

## Design System

Colors are CSS custom properties on `:root`. Never hardcode hex in CSS.

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-dark` | `#0b1120` | Page background |
| `--bg-body` | `#0f172a` | Main content background |
| `--bg-card` | `#1a2535` | Card backgrounds |
| `--brand` | `#3b82f6` | Primary accent (blue) |
| `--accent-teal` | `#14b8a6` | Custom resort badges, add button |
| `--accent-purple` | `#a855f7` | ECMWF IFS model color |
| `--accent-green` | `#4ade80` | Live badge, positive values |
| `--accent-red` | `#f87171` | Alerts, delete buttons |

## Running Tests

Tests use Node.js built-in test runner — zero dependencies.

```bash
# Run all tests (requires Node 18+)
node --test winter-dashboard/tests/

# Run a specific test file
node --test winter-dashboard/tests/weather-api.test.js
```

## Code Conventions

- **JS**: `camelCase` for variables and functions
- **CSS**: `kebab-case` for classes (`.resort-card`, `.card-header`)
- **HTML**: Semantic elements where possible
- No `console.log` in committed code
- No external dependencies beyond CDN libraries
- Keep data in `data.js`, logic in `app.js`, styles in `style.css`
