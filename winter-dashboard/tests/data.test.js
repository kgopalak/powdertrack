const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadDataJS } = require("./test-helpers.js");

const { RESORTS } = loadDataJS();

// ── Resort Count ──────────────────────────────────────────

describe("RESORTS array", () => {
  it("has at least 50 resorts", () => {
    assert.ok(RESORTS.length >= 50, `Expected 50+, got ${RESORTS.length}`);
  });
});

// ── Required Fields ───────────────────────────────────────

describe("resort required fields", () => {
  const requiredFields = [
    "id", "name", "region", "country", "elevation",
    "lat", "lon", "forecast", "terrain",
  ];

  it("every resort has all required fields", () => {
    for (const r of RESORTS) {
      for (const field of requiredFields) {
        assert.ok(
          r[field] !== undefined && r[field] !== null,
          `Resort "${r.name}" (id ${r.id}) missing field "${field}"`
        );
      }
    }
  });

  it("every resort has a non-empty name", () => {
    for (const r of RESORTS) {
      assert.ok(r.name.length > 0, `Resort id ${r.id} has empty name`);
    }
  });

  it("every resort has a valid region", () => {
    const validRegions = ["sierra", "wasatch", "rockies", "cascades", "northeast", "alps", "japan", "other"];
    for (const r of RESORTS) {
      assert.ok(
        validRegions.includes(r.region),
        `Resort "${r.name}" has invalid region "${r.region}"`
      );
    }
  });
});

// ── Unique IDs ────────────────────────────────────────────

describe("resort IDs", () => {
  it("all IDs are unique", () => {
    const ids = RESORTS.map(r => r.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, "Duplicate resort IDs found");
  });

  it("all IDs are positive integers", () => {
    for (const r of RESORTS) {
      assert.ok(Number.isInteger(r.id) && r.id > 0, `Resort "${r.name}" has invalid id ${r.id}`);
    }
  });
});

// ── Coordinates ───────────────────────────────────────────

describe("resort coordinates", () => {
  it("latitude is between -90 and 90", () => {
    for (const r of RESORTS) {
      assert.ok(
        r.lat >= -90 && r.lat <= 90,
        `Resort "${r.name}" has invalid lat ${r.lat}`
      );
    }
  });

  it("longitude is between -180 and 180", () => {
    for (const r of RESORTS) {
      assert.ok(
        r.lon >= -180 && r.lon <= 180,
        `Resort "${r.name}" has invalid lon ${r.lon}`
      );
    }
  });

  it("no resort has (0, 0) coordinates", () => {
    for (const r of RESORTS) {
      assert.ok(
        !(r.lat === 0 && r.lon === 0),
        `Resort "${r.name}" has default (0,0) coordinates — needs real location`
      );
    }
  });
});

// ── Forecast Arrays ───────────────────────────────────────

describe("resort forecast arrays", () => {
  it("every resort has exactly 7 forecast entries", () => {
    for (const r of RESORTS) {
      assert.equal(
        r.forecast.length, 7,
        `Resort "${r.name}" has ${r.forecast.length} forecast entries, expected 7`
      );
    }
  });

  it("each forecast entry has snow, high, and low", () => {
    for (const r of RESORTS) {
      for (let i = 0; i < r.forecast.length; i++) {
        const f = r.forecast[i];
        assert.ok(typeof f.snow === "number", `Resort "${r.name}" forecast[${i}] missing snow`);
        assert.ok(typeof f.high === "number", `Resort "${r.name}" forecast[${i}] missing high`);
        assert.ok(typeof f.low === "number", `Resort "${r.name}" forecast[${i}] missing low`);
      }
    }
  });

  it("snow values are non-negative", () => {
    for (const r of RESORTS) {
      for (const f of r.forecast) {
        assert.ok(f.snow >= 0, `Resort "${r.name}" has negative snow value ${f.snow}`);
      }
    }
  });
});

// ── Terrain ───────────────────────────────────────────────

describe("resort terrain", () => {
  it("terrain percentages sum to 100", () => {
    for (const r of RESORTS) {
      const sum = r.terrain.beginner + r.terrain.intermediate + r.terrain.advanced;
      assert.equal(sum, 100, `Resort "${r.name}" terrain sums to ${sum}, expected 100`);
    }
  });

  it("all terrain percentages are non-negative", () => {
    for (const r of RESORTS) {
      assert.ok(r.terrain.beginner >= 0, `Resort "${r.name}" beginner is negative`);
      assert.ok(r.terrain.intermediate >= 0, `Resort "${r.name}" intermediate is negative`);
      assert.ok(r.terrain.advanced >= 0, `Resort "${r.name}" advanced is negative`);
    }
  });
});

// ── Elevation ─────────────────────────────────────────────

describe("resort elevation", () => {
  it("summit elevation >= base elevation", () => {
    for (const r of RESORTS) {
      if (r.elevation.summit === 0 && r.elevation.base === 0) continue;
      assert.ok(
        r.elevation.summit >= r.elevation.base,
        `Resort "${r.name}" summit (${r.elevation.summit}) < base (${r.elevation.base})`
      );
    }
  });
});

// ── Region Coverage ───────────────────────────────────────

describe("region coverage", () => {
  const regionCounts = {};
  for (const r of RESORTS) {
    regionCounts[r.region] = (regionCounts[r.region] || 0) + 1;
  }

  const mainRegions = ["sierra", "wasatch", "rockies", "cascades", "northeast", "alps", "japan"];

  for (const region of mainRegions) {
    it(`region "${region}" has at least 3 resorts`, () => {
      assert.ok(
        (regionCounts[region] || 0) >= 3,
        `Region "${region}" has only ${regionCounts[region] || 0} resorts`
      );
    });
  }
});
