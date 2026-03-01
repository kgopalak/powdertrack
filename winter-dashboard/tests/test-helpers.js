// ════════════════════════════════════════════════════════════
//  Test Helpers — loads browser scripts in a Node.js context
//  Uses Node's vm module to sandbox browser globals
//
//  NOTE: vm.runInContext doesn't expose let/const declarations
//  on the context object, only var/function. We convert top-level
//  let/const to var before eval so they become context properties.
// ════════════════════════════════════════════════════════════

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const JS_DIR = path.join(__dirname, "..", "js");

function hoistDeclarations(code) {
  return code
    .replace(/^const /gm, "var ")
    .replace(/^let /gm, "var ");
}

function createMockDOM() {
  return {
    getElementById: () => ({
      hidden: false,
      textContent: "",
      innerHTML: "",
      value: "",
      className: "",
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      addEventListener: () => {},
      getContext: () => ({
        createLinearGradient: () => ({ addColorStop: () => {} }),
        fillRect: () => {},
      }),
      style: {},
      querySelectorAll: () => [],
      querySelector: () => null,
      scrollIntoView: () => {},
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => ({
      className: "",
      innerHTML: "",
      textContent: "",
      style: {},
      appendChild: () => {},
      setAttribute: () => {},
      addEventListener: () => {},
      classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    }),
  };
}

function createMockLocalStorage() {
  const store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

function loadWeatherAPI() {
  let code = fs.readFileSync(path.join(JS_DIR, "weather-api.js"), "utf8");
  code = hoistDeclarations(code);
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math,
    URL,
    URLSearchParams,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  });
  vm.runInContext(code, context);
  return context.WeatherAPI;
}

function loadDataJS() {
  let code = fs.readFileSync(path.join(JS_DIR, "data.js"), "utf8");
  code = hoistDeclarations(code);
  const context = vm.createContext({ console, Date, Math });
  vm.runInContext(code, context);
  return {
    RESORTS: context.RESORTS,
    SEASON_DATA: context.SEASON_DATA,
    TEMP_OUTLOOK: context.TEMP_OUTLOOK,
  };
}

function loadAppHelpers() {
  let dataCode = fs.readFileSync(path.join(JS_DIR, "data.js"), "utf8");
  let appCode = fs.readFileSync(path.join(JS_DIR, "app.js"), "utf8");
  dataCode = hoistDeclarations(dataCode);
  appCode = hoistDeclarations(appCode);

  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    RegExp,
    Map,
    Set,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Intl,
    URL,
    URLSearchParams,
    document: createMockDOM(),
    localStorage: createMockLocalStorage(),
    window: {},
    feather: { replace: () => {} },
    Chart: function () { return { destroy: () => {}, update: () => {} }; },
    WeatherAPI: {
      MODEL_CONFIG: {
        best_match: { label: "Best Match", url: "", params: {} },
        gfs: { label: "GFS", url: "", params: {} },
        ecmwf_ifs: { label: "ECMWF IFS", url: "", params: {} },
        ecmwf_aifs: { label: "ECMWF AIFS", url: "", params: {} },
      },
      fetchForecast: async () => null,
      parseDailyForecast: () => [],
    },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    confirm: () => true,
    alert: () => {},
  });

  vm.runInContext(dataCode, context);
  vm.runInContext(appCode, context);

  return {
    state: context.state,
    RESORTS: context.RESORTS,
    snow: context.snow,
    temp: context.temp,
    wind: context.wind,
    elevation: context.elevation,
    forecastDates: context.forecastDates,
    forecastLabels: context.forecastLabels,
    filteredResorts: context.filteredResorts,
    avalancheBadge: context.avalancheBadge,
    surfaceBadge: context.surfaceBadge,
    REGION_LABELS: context.REGION_LABELS,
  };
}

module.exports = { loadWeatherAPI, loadDataJS, loadAppHelpers, createMockLocalStorage };
