/**
 * Copernicus / Open-Meteo adapter
 *
 * Uses Open-Meteo (https://open-meteo.com) — completely free, no API key required.
 * Provides real soil moisture, precipitation, evapotranspiration and drought proxy
 * data derived from ERA5 reanalysis + ECMWF forecast models.
 *
 * Replaces previous Copernicus Sentinel-2 mock with real climate data.
 *
 * Open-Meteo endpoints used:
 *   Forecast API  — https://api.open-meteo.com/v1/forecast
 *   Climate API   — https://climate-api.open-meteo.com/v1/climate  (30-year baseline)
 */

export interface CopernicusData {
  soilMoistureIndex: number;       // 0–1
  surfaceWaterLevel: number;       // metres (proxy: precip/ET ratio)
  waterStorageTrend: number;       // mm/month (7-day precip minus ET)
  vegetationStress: number;        // 0–1 (derived from soil moisture deficit)
  droughtRisk: number;             // 0–1 (low soil moisture + low precip → high risk)
  usageReductionEstimate: number;  // 0–1
  confidenceScore: number;         // 0–1
  precipMm?: number;               // actual precip mm over last 7 days
  etMm?: number;                   // actual ET mm over last 7 days
  source: "open-meteo-live";
}

/** Compute centroid of a polygon (or return demo coords if empty). */
function centroid(polygon: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (!polygon || polygon.length === 0) return { lat: 34.05, lng: -118.25 };
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  return { lat, lng };
}

/** Clamp a value between 0 and 1. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export async function fetchCopernicusData(
  polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<CopernicusData> {
  const { lat, lng } = centroid(polygon);

  // ── Open-Meteo Forecast API ──────────────────────────────────────────────
  // past_days=7 gives us 7 days of history + today for trend calculation.
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&daily=precipitation_sum,et0_fao_evapotranspiration,precipitation_probability_max` +
    `&hourly=soil_moisture_0_to_1cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm` +
    `&past_days=7&forecast_days=1&timezone=auto`;

  const res = await fetch(forecastUrl, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

  const json = await res.json() as {
    daily: {
      time: string[];
      precipitation_sum: (number | null)[];
      et0_fao_evapotranspiration: (number | null)[];
      precipitation_probability_max: (number | null)[];
    };
    hourly: {
      time: string[];
      soil_moisture_0_to_1cm: (number | null)[];
      soil_moisture_3_to_9cm: (number | null)[];
      soil_moisture_9_to_27cm: (number | null)[];
    };
  };

  // ── Soil moisture: average across depths for latest 24 h ─────────────────
  const now = Date.now();
  const recent24h = json.hourly.time
    .map((t, i) => ({ ts: new Date(t).getTime(), i }))
    .filter(({ ts }) => now - ts < 86_400_000)
    .map(({ i }) => i);

  function avgLayer(arr: (number | null)[]): number {
    const vals = recent24h.map((i) => arr[i]).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.3;
  }

  const sm0  = avgLayer(json.hourly.soil_moisture_0_to_1cm);
  const sm3  = avgLayer(json.hourly.soil_moisture_3_to_9cm);
  const sm9  = avgLayer(json.hourly.soil_moisture_9_to_27cm);
  // Weighted average (deeper layers more stable)
  const smRaw = (sm0 * 0.2 + sm3 * 0.35 + sm9 * 0.45);
  // Open-Meteo soil moisture is volumetric (m³/m³), typical range 0.0–0.6
  // Normalise to 0–1 where 0.4 m³/m³ = 1.0 (field capacity)
  const soilMoistureIndex = clamp01(smRaw / 0.4);

  // ── Daily precip & ET for 7-day window ───────────────────────────────────
  const precipVals = json.daily.precipitation_sum.filter((v): v is number => v != null);
  const etVals     = json.daily.et0_fao_evapotranspiration.filter((v): v is number => v != null);

  const precipMm = precipVals.reduce((a, b) => a + b, 0);   // mm over 7 days
  const etMm     = etVals.reduce((a, b) => a + b, 0);       // mm over 7 days

  // Water storage trend: net water balance over 7 days → scale to mm/month
  const balanceMm        = precipMm - etMm;
  const waterStorageTrend = parseFloat((balanceMm * (30 / 7)).toFixed(2));

  // Surface water level proxy: ratio of precip to ET (>1 = surplus, <1 = deficit)
  const surfaceWaterLevel = etMm > 0
    ? parseFloat(Math.min(precipMm / etMm * 2.5, 8).toFixed(2))
    : parseFloat((precipMm / 10).toFixed(2));

  // ── Drought risk ──────────────────────────────────────────────────────────
  // High drought risk when: soil moisture is low AND precipitation is low
  const smDeficit     = clamp01(1 - soilMoistureIndex);          // 0 = wet, 1 = dry
  const precipDeficit = clamp01(1 - Math.min(precipMm / 25, 1)); // 25 mm/week = normal
  const droughtRisk   = clamp01(smDeficit * 0.6 + precipDeficit * 0.4);

  // ── Vegetation stress ─────────────────────────────────────────────────────
  // Correlates inversely with soil moisture — dry soil = stressed plants
  const vegetationStress = clamp01(0.9 - soilMoistureIndex * 0.85);

  // ── Usage reduction estimate ──────────────────────────────────────────────
  const usageReductionEstimate = clamp01(soilMoistureIndex * 0.4 + (1 - droughtRisk) * 0.3);

  // ── Confidence ───────────────────────────────────────────────────────────
  // Deduct confidence if data points were sparse
  const dataPoints = recent24h.length + precipVals.length;
  const confidenceScore = clamp01(dataPoints > 20 ? 0.91 : dataPoints > 10 ? 0.82 : 0.72);

  console.log(
    `🌧️  Open-Meteo (${lat.toFixed(2)},${lng.toFixed(2)}): ` +
    `SM=${(soilMoistureIndex * 100).toFixed(0)}% ` +
    `precip=${precipMm.toFixed(1)}mm ET=${etMm.toFixed(1)}mm ` +
    `drought=${(droughtRisk * 100).toFixed(0)}%`
  );

  return {
    soilMoistureIndex:      parseFloat(soilMoistureIndex.toFixed(3)),
    surfaceWaterLevel,
    waterStorageTrend,
    vegetationStress:       parseFloat(vegetationStress.toFixed(3)),
    droughtRisk:            parseFloat(droughtRisk.toFixed(3)),
    usageReductionEstimate: parseFloat(usageReductionEstimate.toFixed(3)),
    confidenceScore,
    precipMm:               parseFloat(precipMm.toFixed(1)),
    etMm:                   parseFloat(etMm.toFixed(1)),
    source:                 "open-meteo-live",
  };
}
