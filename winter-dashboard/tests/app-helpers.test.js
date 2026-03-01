const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppHelpers } = require("./test-helpers.js");

const app = loadAppHelpers();

// ── Unit Conversion: snow() ───────────────────────────────

describe("snow()", () => {
  beforeEach(() => { app.state.unit = "imperial"; });

  it("returns inches with quote mark in imperial", () => {
    assert.equal(app.snow(24), '24"');
  });

  it("returns 0 inches correctly", () => {
    assert.equal(app.snow(0), '0"');
  });

  it("converts to cm in metric", () => {
    app.state.unit = "metric";
    assert.equal(app.snow(10), "25 cm");
  });

  it("rounds metric conversion", () => {
    app.state.unit = "metric";
    assert.equal(app.snow(1), "3 cm");
  });
});

// ── Unit Conversion: temp() ───────────────────────────────

describe("temp()", () => {
  beforeEach(() => { app.state.unit = "imperial"; });

  it("returns Fahrenheit in imperial", () => {
    assert.equal(app.temp(32), "32°F");
  });

  it("converts 32°F to 0°C", () => {
    app.state.unit = "metric";
    assert.equal(app.temp(32), "0°C");
  });

  it("converts 212°F to 100°C", () => {
    app.state.unit = "metric";
    assert.equal(app.temp(212), "100°C");
  });

  it("handles negative Fahrenheit", () => {
    assert.equal(app.temp(-10), "-10°F");
  });

  it("handles negative Celsius result", () => {
    app.state.unit = "metric";
    assert.equal(app.temp(0), "-18°C");
  });
});

// ── Unit Conversion: wind() ───────────────────────────────

describe("wind()", () => {
  beforeEach(() => { app.state.unit = "imperial"; });

  it("returns mph in imperial", () => {
    assert.equal(app.wind(15), "15 mph");
  });

  it("converts to km/h in metric", () => {
    app.state.unit = "metric";
    assert.equal(app.wind(10), "16 km/h");
  });

  it("handles zero wind", () => {
    assert.equal(app.wind(0), "0 mph");
  });
});

// ── Unit Conversion: elevation() ──────────────────────────

describe("elevation()", () => {
  beforeEach(() => { app.state.unit = "imperial"; });

  it("returns feet with comma formatting in imperial", () => {
    assert.equal(app.elevation(11053), "11,053 ft");
  });

  it("converts to meters in metric", () => {
    app.state.unit = "metric";
    const result = app.elevation(10000);
    assert.ok(result.includes("m"), `Expected meters, got "${result}"`);
    assert.ok(result.includes("3,048"), `Expected ~3048m, got "${result}"`);
  });

  it("handles zero elevation", () => {
    assert.equal(app.elevation(0), "0 ft");
  });
});

// ── forecastDates() ───────────────────────────────────────

describe("forecastDates()", () => {
  it("returns 7 dates by default", () => {
    const dates = app.forecastDates();
    assert.equal(dates.length, 7);
  });

  it("returns requested count", () => {
    const dates = app.forecastDates(3);
    assert.equal(dates.length, 3);
  });

  it("dates match Day M/D format", () => {
    const dates = app.forecastDates(7);
    const pattern = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2}\/\d{1,2}$/;
    for (const d of dates) {
      assert.ok(pattern.test(d), `Date "${d}" does not match pattern`);
    }
  });

  it("dates are consecutive", () => {
    const dates = app.forecastDates(3);
    const nums = dates.map(d => {
      const parts = d.split(" ")[1].split("/");
      return parseInt(parts[1]);
    });
    for (let i = 1; i < nums.length; i++) {
      const expected = nums[i - 1] + 1;
      const actual = nums[i];
      if (actual !== expected && actual !== 1) {
        assert.fail(`Dates not consecutive: ${dates[i-1]} → ${dates[i]}`);
      }
    }
  });
});

// ── forecastLabels() ──────────────────────────────────────

describe("forecastLabels()", () => {
  it("uses date field when present", () => {
    const forecast = [
      { date: "2026-03-01", snow: 0, high: 30, low: 15 },
      { date: "2026-03-02", snow: 2, high: 28, low: 12 },
    ];
    const labels = app.forecastLabels(forecast);
    assert.equal(labels.length, 2);
    assert.equal(labels[0], "Sun 3/1");
    assert.equal(labels[1], "Mon 3/2");
  });

  it("falls back to forecastDates when no date field", () => {
    const forecast = [
      { snow: 0, high: 30, low: 15 },
      { snow: 2, high: 28, low: 12 },
    ];
    const labels = app.forecastLabels(forecast);
    assert.equal(labels.length, 2);
    const pattern = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2}\/\d{1,2}$/;
    for (const l of labels) {
      assert.ok(pattern.test(l), `Label "${l}" does not match pattern`);
    }
  });

  it("handles empty forecast array", () => {
    const labels = app.forecastLabels([]);
    assert.equal(labels.length, 7);
  });
});

// ── filteredResorts() ─────────────────────────────────────

describe("filteredResorts()", () => {
  beforeEach(() => {
    app.state.region = "all";
    app.state.search = "";
    app.state.minBase = 0;
    app.state.sortBy = "fresh";
  });

  it("returns all resorts with default filters", () => {
    const result = app.filteredResorts();
    assert.equal(result.length, app.RESORTS.length);
  });

  it("filters by region", () => {
    app.state.region = "sierra";
    const result = app.filteredResorts();
    assert.ok(result.length > 0, "Expected some Sierra resorts");
    assert.ok(result.every(r => r.region === "sierra"), "All results should be Sierra");
  });

  it("filters by search string", () => {
    app.state.search = "mammoth";
    const result = app.filteredResorts();
    assert.ok(result.length > 0, "Expected Mammoth in results");
    assert.ok(result.some(r => r.name.toLowerCase().includes("mammoth")));
  });

  it("filters by minimum base depth", () => {
    app.state.minBase = 100;
    const result = app.filteredResorts();
    assert.ok(result.every(r => r.base_in >= 100), "All results should have base >= 100");
  });

  it("sorts by fresh snow descending", () => {
    app.state.sortBy = "fresh";
    const result = app.filteredResorts();
    for (let i = 1; i < result.length; i++) {
      assert.ok(
        result[i - 1].new48h_in >= result[i].new48h_in,
        `Sort order wrong: ${result[i-1].name} (${result[i-1].new48h_in}) before ${result[i].name} (${result[i].new48h_in})`
      );
    }
  });

  it("sorts by base depth descending", () => {
    app.state.sortBy = "base";
    const result = app.filteredResorts();
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i - 1].base_in >= result[i].base_in);
    }
  });

  it("sorts by rating descending", () => {
    app.state.sortBy = "rating";
    const result = app.filteredResorts();
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i - 1].rating >= result[i].rating);
    }
  });

  it("search matches country", () => {
    app.state.search = "japan";
    const result = app.filteredResorts();
    assert.ok(result.length > 0, "Expected Japanese resorts");
  });

  it("search matches state", () => {
    app.state.search = "co";
    const result = app.filteredResorts();
    assert.ok(result.length > 0, "Expected Colorado resorts");
  });

  it("returns empty when no matches", () => {
    app.state.search = "zzzznonexistent";
    const result = app.filteredResorts();
    assert.equal(result.length, 0);
  });
});

// ── Badge functions ───────────────────────────────────────

describe("avalancheBadge()", () => {
  it("returns badge with 'Low' class for Low danger", () => {
    const html = app.avalancheBadge("Low");
    assert.ok(html.includes("Low"), "Should contain 'Low'");
    assert.ok(html.includes("badge"), "Should contain 'badge' class");
  });

  it("returns badge with danger text for Extreme", () => {
    const html = app.avalancheBadge("Extreme");
    assert.ok(html.includes("Extreme"));
  });
});

describe("surfaceBadge()", () => {
  it("returns badge with surface text", () => {
    const html = app.surfaceBadge("Powder");
    assert.ok(html.includes("Powder"));
    assert.ok(html.includes("badge"));
  });

  it("returns badge for Groomed", () => {
    const html = app.surfaceBadge("Groomed");
    assert.ok(html.includes("Groomed"));
  });
});

// ── REGION_LABELS ─────────────────────────────────────────

describe("REGION_LABELS", () => {
  it("has labels for all main regions", () => {
    const regions = ["sierra", "wasatch", "rockies", "cascades", "northeast", "alps", "japan"];
    for (const r of regions) {
      assert.ok(app.REGION_LABELS[r], `Missing label for region "${r}"`);
    }
  });
});
