# PowderTrack — Winter Dashboard

A static ski resort dashboard displaying snow conditions, forecasts, and resort data. Runs entirely in the browser with no build process or backend.

# Tech Stack

- **Language**: Vanilla JavaScript (ES6+)
- **Markup/Style**: HTML5, CSS3 with custom properties
- **Charts**: Chart.js v4.4.0 (CDN)
- **Icons**: Feather Icons (CDN)
- **Storage**: localStorage (favorites only)
- **No build tool, no package manager, no framework**

# Project Structure

```
winter-dashboard/
  index.html        # Single-page entry point, loads data.js then app.js
  css/
    style.css       # All styles — dark winter theme with CSS variables
  js/
    data.js         # Hardcoded resort data (RESORTS, SEASON_DATA, TEMP_OUTLOOK)
    app.js          # All app logic — state, rendering, event handling
```

# Running the Project

Open `winter-dashboard/index.html` directly in a browser — no server needed.

For a local server (avoids CORS issues if added later):
```bash
npx serve winter-dashboard
# or
python3 -m http.server 8000 -d winter-dashboard
```

# Architecture

## State
Single global `state` object in `app.js` — mutate directly, then call the relevant render function:
```js
state.region = 'rockies';
renderResorts();
```

## Data Flow
- `data.js` defines static arrays (`RESORTS`, `SEASON_DATA`, `TEMP_OUTLOOK`)
- `filteredResorts()` applies filters/sort from `state` and returns a subset of `RESORTS`
- Render functions (`renderResorts`, `renderForecastChart`, etc.) replace `innerHTML` entirely

## Persistence
Favorites stored to localStorage under key `pt_favorites` (array of resort IDs).

## Units
Units converted at display time only — underlying data is always imperial. Use helpers `snow()`, `temp()`, `wind()`, `elevation()` when rendering values.

## Charts
Chart.js instances are stored in global variables and **must be destroyed before re-creating**:
```js
if (forecastChart) forecastChart.destroy();
forecastChart = new Chart(...);
```

## Icons
Call `feather.replace()` after any DOM update that adds Feather icon markup.

# Code Conventions

- **JS**: camelCase for variables and functions (`filteredResorts`, `toggleFavorite`)
- **CSS**: kebab-case for classes (`.resort-card`, `.card-header`)
- **HTML**: semantic elements where possible
- No `console.log` in committed code
- No external dependencies beyond what's already on CDN
- Keep data in `data.js`, logic in `app.js`, styles in `style.css` — don't mix concerns

# Key Areas

| File | Purpose |
|---|---|
| `js/data.js:1` | RESORTS array — 12 resorts with full mock data |
| `js/app.js:1` | state object, all render/filter/event functions |
| `css/style.css:1` | CSS variables (colors, spacing) at `:root` |

# Design System

Colors are defined as CSS variables on `:root`. Always use variables, never hardcode hex values in CSS. Chart colors are defined inline in `app.js` — keep them consistent with the CSS palette:
- Background: `#0b1120`, `#0f172a`, `#1a2535`
- Accent blue: `#3b82f6`, teal: `#14b8a6`, purple: `#a855f7`

# Git & Workflow

- Remote: `https://github.com/kgopalak/powdertrack`
- Branch: `main` (only branch)
- Do NOT push unless explicitly asked
- No CI/CD pipeline — test manually in browser

# Preferences

- No TypeScript, no build step — keep it plain JS
- Prefer editing existing files over creating new ones
- Don't add frameworks or npm dependencies without asking
- No comments unless logic is genuinely non-obvious
- Concise responses
