const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadWeatherAPI } = require("./test-helpers.js");

const WeatherAPI = loadWeatherAPI();

// ── parseDailyForecast ────────────────────────────────────

describe("parseDailyForecast", () => {
  it("returns empty array for null input", () => {
    const result = WeatherAPI.parseDailyForecast(null);
    assert.ok(Array.isArray(result), "Expected an array");
    assert.equal(result.length, 0);
  });

  it("returns empty array for missing daily key", () => {
    const result = WeatherAPI.parseDailyForecast({ hourly: {} });
    assert.ok(Array.isArray(result), "Expected an array");
    assert.equal(result.length, 0);
  });

  it("parses a valid 3-day response", () => {
    const data = {
      daily: {
        time: ["2026-03-01", "2026-03-02", "2026-03-03"],
        snowfall_sum: [5.2, 0, 3.1],
        temperature_2m_max: [28.4, 32.1, 25.9],
        temperature_2m_min: [12.3, 18.7, 10.2],
        precipitation_sum: [0.8, 0, 0.5],
        windspeed_10m_max: [15.6, 8.3, 22.1],
        windgusts_10m_max: [30.2, 15.1, 40.5],
        weathercode: [73, 0, 71],
        snow_depth_max: [48.2, 48.2, 50.1],
      },
    };
    const result = WeatherAPI.parseDailyForecast(data);
    assert.equal(result.length, 3);
    assert.equal(result[0].date, "2026-03-01");
    assert.equal(result[0].snow, 5.2);
    assert.equal(result[0].high, 28);
    assert.equal(result[0].low, 12);
    assert.equal(result[0].code, 73);
    assert.equal(result[1].snow, 0);
    assert.equal(result[2].snow, 3.1);
  });

  it("handles missing optional fields with fallback to 0", () => {
    const data = {
      daily: {
        time: ["2026-03-01"],
        snowfall_sum: [null],
        temperature_2m_max: [undefined],
        temperature_2m_min: [10],
      },
    };
    const result = WeatherAPI.parseDailyForecast(data);
    assert.equal(result.length, 1);
    assert.equal(result[0].snow, 0);
    assert.equal(result[0].high, 0);
    assert.equal(result[0].low, 10);
  });

  it("sets correct day-of-week names", () => {
    const data = {
      daily: {
        time: ["2026-03-01", "2026-03-02"], // Sun, Mon
        snowfall_sum: [0, 0],
        temperature_2m_max: [30, 30],
        temperature_2m_min: [10, 10],
      },
    };
    const result = WeatherAPI.parseDailyForecast(data);
    assert.equal(result[0].day, "Sun");
    assert.equal(result[1].day, "Mon");
  });
});

// ── weatherCodeToText ─────────────────────────────────────

describe("weatherCodeToText", () => {
  it("returns Clear for code 0", () => {
    assert.equal(WeatherAPI.weatherCodeToText(0), "Clear");
  });

  it("returns Heavy Snowfall for code 75", () => {
    assert.equal(WeatherAPI.weatherCodeToText(75), "Heavy Snowfall");
  });

  it("returns Thunderstorm for code 95", () => {
    assert.equal(WeatherAPI.weatherCodeToText(95), "Thunderstorm");
  });

  it("returns Unknown for unrecognized code", () => {
    assert.equal(WeatherAPI.weatherCodeToText(999), "Unknown");
  });

  it("returns Foggy for code 45", () => {
    assert.equal(WeatherAPI.weatherCodeToText(45), "Foggy");
  });

  it("returns Moderate Snowfall for code 73", () => {
    assert.equal(WeatherAPI.weatherCodeToText(73), "Moderate Snowfall");
  });
});

// ── weatherCodeToVisibility ───────────────────────────────

describe("weatherCodeToVisibility", () => {
  it("returns Excellent for clear (0)", () => {
    assert.equal(WeatherAPI.weatherCodeToVisibility(0), "Excellent");
  });

  it("returns Excellent for mainly clear (1)", () => {
    assert.equal(WeatherAPI.weatherCodeToVisibility(1), "Excellent");
  });

  it("returns Good for partly cloudy (2)", () => {
    assert.equal(WeatherAPI.weatherCodeToVisibility(2), "Good");
  });

  it("returns Good for overcast (3)", () => {
    assert.equal(WeatherAPI.weatherCodeToVisibility(3), "Good");
  });

  it("returns Fair for fog (45)", () => {
    assert.equal(WeatherAPI.weatherCodeToVisibility(45), "Fair");
  });

  it("returns Fair for slight snowfall (71)", () => {
    assert.equal(WeatherAPI.weatherCodeToVisibility(71), "Fair");
  });

  it("returns Poor for heavy rain (65)", () => {
    assert.equal(WeatherAPI.weatherCodeToVisibility(65), "Poor");
  });

  it("returns Poor for heavy snowfall (75)", () => {
    assert.equal(WeatherAPI.weatherCodeToVisibility(75), "Poor");
  });

  it("returns Poor for thunderstorm (95)", () => {
    assert.equal(WeatherAPI.weatherCodeToVisibility(95), "Poor");
  });
});

// ── weatherCodeToSurface ──────────────────────────────────

describe("weatherCodeToSurface", () => {
  it("returns Powder for heavy snowfall code", () => {
    assert.equal(WeatherAPI.weatherCodeToSurface(75, 20), "Powder");
  });

  it("returns Powder for snow grains code", () => {
    assert.equal(WeatherAPI.weatherCodeToSurface(77, 25), "Powder");
  });

  it("returns Powder for snow showers code", () => {
    assert.equal(WeatherAPI.weatherCodeToSurface(85, 22), "Powder");
  });

  it("returns Packed Powder for freezing rain code", () => {
    assert.equal(WeatherAPI.weatherCodeToSurface(66, 30), "Packed Powder");
  });

  it("returns Packed Powder when temp <= 28 and no snow code", () => {
    assert.equal(WeatherAPI.weatherCodeToSurface(0, 25), "Packed Powder");
  });

  it("returns Groomed when temp > 28 and no snow/freezing code", () => {
    assert.equal(WeatherAPI.weatherCodeToSurface(0, 35), "Groomed");
  });
});

// ── mergeIntoResort ───────────────────────────────────────

describe("mergeIntoResort", () => {
  const baseResort = {
    id: 1,
    name: "Test Resort",
    base_in: 60,
    temp_f: 20,
    wind_mph: 10,
    visibility: "Good",
    surface: "Packed Powder",
    last_updated: "old",
  };

  it("returns resort unchanged when apiData is null", () => {
    const result = WeatherAPI.mergeIntoResort(baseResort, null);
    assert.equal(result.name, "Test Resort");
    assert.equal(result._live, undefined);
  });

  it("sets _live flag when valid API data provided", () => {
    const apiData = {
      daily: {
        time: ["2026-03-01"],
        snowfall_sum: [2],
        temperature_2m_max: [30],
        temperature_2m_min: [15],
        precipitation_sum: [0.5],
        windspeed_10m_max: [12],
        windgusts_10m_max: [25],
        weathercode: [71],
        snow_depth_max: [70],
      },
      hourly: {
        time: ["2026-03-01T00:00", "2026-03-01T01:00"],
        temperature_2m: [22, 23],
        windspeed_10m: [8, 10],
        windgusts_10m: [15, 18],
        winddirection_10m: [270, 275],
        snowfall: [0.5, 0.3],
        snow_depth: [70, 70],
        cloudcover: [80, 85],
        visibility: [5000, 4000],
        freezinglevel_height: [1500, 1600],
        weathercode: [71, 71],
      },
    };
    const result = WeatherAPI.mergeIntoResort(baseResort, apiData);
    assert.equal(result._live, true);
    assert.equal(result.name, "Test Resort");
    assert.equal(result.forecast.length, 1);
    assert.equal(typeof result.temp_f, "number");
    assert.equal(typeof result.wind_mph, "number");
  });

  it("preserves original resort properties", () => {
    const apiData = {
      daily: { time: [], snowfall_sum: [] },
      hourly: { time: [], temperature_2m: [] },
    };
    const result = WeatherAPI.mergeIntoResort(baseResort, apiData);
    assert.equal(result.id, 1);
    assert.equal(result.name, "Test Resort");
  });
});

// ── MODEL_CONFIG ──────────────────────────────────────────

describe("MODEL_CONFIG", () => {
  it("exposes 4 models", () => {
    const keys = Object.keys(WeatherAPI.MODEL_CONFIG);
    assert.equal(keys.length, 4);
    assert.ok(keys.includes("best_match"));
    assert.ok(keys.includes("gfs"));
    assert.ok(keys.includes("ecmwf_ifs"));
    assert.ok(keys.includes("ecmwf_aifs"));
  });

  it("each model has a label and url", () => {
    for (const [key, cfg] of Object.entries(WeatherAPI.MODEL_CONFIG)) {
      assert.ok(cfg.label, `${key} missing label`);
      assert.ok(cfg.url, `${key} missing url`);
      assert.ok(typeof cfg.params === "object", `${key} missing params object`);
    }
  });
});
