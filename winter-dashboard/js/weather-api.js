// ════════════════════════════════════════════════════════════
//  PowderTrack — Open-Meteo Weather API Service
//  Fetches live weather data from Open-Meteo (free, no API key)
//  Supports multiple ML weather models: GFS, ECMWF IFS, AIFS, GraphCast
// ════════════════════════════════════════════════════════════

const WeatherAPI = (() => {

  const BASE = "https://api.open-meteo.com/v1/forecast";

  // Model endpoints — Open-Meteo routes some models through different paths
  const MODEL_CONFIG = {
    best_match: { label: "Best Match (Auto)", url: BASE, params: {} },
    gfs:        { label: "NOAA GFS (28km)",    url: BASE, params: { models: "gfs_seamless" } },
    ecmwf_ifs:  { label: "ECMWF IFS (9km)",    url: "https://api.open-meteo.com/v1/ecmwf", params: {} },
    ecmwf_aifs: { label: "ECMWF AIFS (ML)",    url: "https://api.open-meteo.com/v1/ecmwf", params: { models: "ecmwf_aifs025" } },
  };

  const HOURLY_VARS = [
    "temperature_2m",
    "snowfall",
    "snow_depth",
    "precipitation",
    "rain",
    "windspeed_10m",
    "windgusts_10m",
    "winddirection_10m",
    "weathercode",
    "cloudcover",
    "visibility",
    "freezinglevel_height",
  ];

  const DAILY_VARS = [
    "temperature_2m_max",
    "temperature_2m_min",
    "snowfall_sum",
    "precipitation_sum",
    "windspeed_10m_max",
    "windgusts_10m_max",
    "weathercode",
    "snow_depth_max",
  ];

  // Build a URL for a given resort and model
  function buildUrl(resort, model, forecastDays = 7) {
    const cfg = MODEL_CONFIG[model] || MODEL_CONFIG.best_match;
    const params = new URLSearchParams({
      latitude: resort.lat,
      longitude: resort.lon,
      hourly: HOURLY_VARS.join(","),
      daily: DAILY_VARS.join(","),
      temperature_unit: "fahrenheit",
      windspeed_unit: "mph",
      precipitation_unit: "inch",
      forecast_days: forecastDays,
      timezone: "auto",
      ...cfg.params,
    });
    // Add elevation for altitude-corrected temps (summit elevation in feet → meters)
    const summitMeters = Math.round(resort.elevation.summit * 0.3048);
    params.set("elevation", summitMeters);
    return `${cfg.url}?${params}`;
  }

  // Fetch forecast for a single resort + model
  async function fetchForecast(resort, model = "best_match") {
    const url = buildUrl(resort, model);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Open-Meteo ${resp.status}: ${resp.statusText}`);
    return resp.json();
  }

  // Fetch all models for a single resort (for comparison panel)
  async function fetchAllModels(resort) {
    const models = Object.keys(MODEL_CONFIG);
    const results = {};
    const promises = models.map(async (m) => {
      try {
        results[m] = await fetchForecast(resort, m);
      } catch (e) {
        console.warn(`Model ${m} failed for ${resort.name}:`, e.message);
        results[m] = null;
      }
    });
    await Promise.all(promises);
    return results;
  }

  // Fetch forecasts for all resorts using best_match
  async function fetchAllResorts(resorts) {
    const results = {};
    // Batch in groups of 4 to respect rate limits
    for (let i = 0; i < resorts.length; i += 4) {
      const batch = resorts.slice(i, i + 4);
      const promises = batch.map(async (r) => {
        try {
          results[r.id] = await fetchForecast(r, "best_match");
        } catch (e) {
          console.warn(`Failed for ${r.name}:`, e.message);
          results[r.id] = null;
        }
      });
      await Promise.all(promises);
    }
    return results;
  }

  // ── Parse helpers ─────────────────────────────────────────
  // Convert raw Open-Meteo daily response → our app's forecast format
  function parseDailyForecast(data) {
    if (!data || !data.daily) return [];
    const d = data.daily;
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return d.time.map((t, i) => {
      const date = new Date(t + "T12:00:00");
      return {
        day: days[date.getDay()],
        date: t,
        snow: round1(d.snowfall_sum?.[i] || 0),
        high: Math.round(d.temperature_2m_max?.[i] || 0),
        low:  Math.round(d.temperature_2m_min?.[i] || 0),
        precip: round1(d.precipitation_sum?.[i] || 0),
        windMax: Math.round(d.windspeed_10m_max?.[i] || 0),
        gustMax: Math.round(d.windgusts_10m_max?.[i] || 0),
        code: d.weathercode?.[i] || 0,
        snowDepthMax: round1(d.snow_depth_max?.[i] || 0),
      };
    });
  }

  // Summarize current conditions from the hourly data (latest available hour)
  function parseCurrentConditions(data) {
    if (!data || !data.hourly) return null;
    const h = data.hourly;
    const now = new Date();
    // Find the closest past hour
    let idx = 0;
    for (let i = 0; i < h.time.length; i++) {
      if (new Date(h.time[i]) <= now) idx = i;
      else break;
    }
    return {
      temp_f: Math.round(h.temperature_2m?.[idx] || 0),
      wind_mph: Math.round(h.windspeed_10m?.[idx] || 0),
      gusts_mph: Math.round(h.windgusts_10m?.[idx] || 0),
      wind_dir: Math.round(h.winddirection_10m?.[idx] || 0),
      snowfall: round1(h.snowfall?.[idx] || 0),
      snow_depth_in: round1(h.snow_depth?.[idx] || 0),
      cloud_cover: Math.round(h.cloudcover?.[idx] || 0),
      visibility_ft: Math.round((h.visibility?.[idx] || 0) * 3.281), // m → ft
      freezing_level_ft: Math.round((h.freezinglevel_height?.[idx] || 0) * 3.281),
      weathercode: h.weathercode?.[idx] || 0,
      time: h.time[idx],
    };
  }

  // Sum snowfall over next N hours from hourly data
  function snowfallNextHours(data, hours) {
    if (!data || !data.hourly) return 0;
    const h = data.hourly;
    const now = new Date();
    let total = 0;
    for (let i = 0; i < h.time.length; i++) {
      const t = new Date(h.time[i]);
      if (t >= now && t <= new Date(now.getTime() + hours * 3600000)) {
        total += h.snowfall?.[i] || 0;
      }
    }
    return round1(total);
  }

  // Weather code → human-readable description
  function weatherCodeToText(code) {
    const map = {
      0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
      45: "Foggy", 48: "Depositing Rime Fog",
      51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
      61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
      66: "Light Freezing Rain", 67: "Heavy Freezing Rain",
      71: "Slight Snowfall", 73: "Moderate Snowfall", 75: "Heavy Snowfall",
      77: "Snow Grains", 80: "Slight Rain Showers", 81: "Moderate Rain Showers",
      82: "Violent Rain Showers", 85: "Slight Snow Showers", 86: "Heavy Snow Showers",
      95: "Thunderstorm", 96: "Thunderstorm w/ Slight Hail", 99: "Thunderstorm w/ Heavy Hail",
    };
    return map[code] || "Unknown";
  }

  // Weather code → visibility category
  function weatherCodeToVisibility(code) {
    if ([0, 1].includes(code)) return "Excellent";
    if ([2, 3].includes(code)) return "Good";
    if ([45, 48, 51, 53, 61, 71, 80, 85].includes(code)) return "Fair";
    return "Poor";
  }

  // Weather code → surface condition guess
  function weatherCodeToSurface(code, temp) {
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "Powder";
    if ([66, 67].includes(code)) return "Packed Powder";
    if (temp <= 28) return "Packed Powder";
    return "Groomed";
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  // Merge live API data into a resort object
  function mergeIntoResort(resort, apiData) {
    if (!apiData) return resort;
    const forecast = parseDailyForecast(apiData);
    const current = parseCurrentConditions(apiData);
    const new48h = snowfallNextHours(apiData, 48);
    const forecast7total = forecast.reduce((s, d) => s + d.snow, 0);

    return {
      ...resort,
      forecast,
      temp_f: current?.temp_f ?? resort.temp_f,
      wind_mph: current?.wind_mph ?? resort.wind_mph,
      visibility: current ? weatherCodeToVisibility(current.weathercode) : resort.visibility,
      surface: current ? weatherCodeToSurface(current.weathercode, current.temp_f) : resort.surface,
      new48h_in: new48h || resort.new48h_in,
      forecast7d_in: round1(forecast7total) || resort.forecast7d_in,
      base_in: current?.snow_depth_in > 0 ? current.snow_depth_in : resort.base_in,
      weathercode: current?.weathercode,
      weather_desc: current ? weatherCodeToText(current.weathercode) : null,
      freezing_level_ft: current?.freezing_level_ft,
      gusts_mph: current?.gusts_mph,
      cloud_cover: current?.cloud_cover,
      last_updated: current ? formatTime(current.time) : resort.last_updated,
      _live: true,
    };
  }

  function formatTime(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  // Public API
  return {
    MODEL_CONFIG,
    fetchForecast,
    fetchAllModels,
    fetchAllResorts,
    parseDailyForecast,
    parseCurrentConditions,
    snowfallNextHours,
    weatherCodeToText,
    weatherCodeToVisibility,
    mergeIntoResort,
  };
})();
