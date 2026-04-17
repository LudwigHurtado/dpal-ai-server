/**
 * Copernicus Sentinel-2 L2A adapter
 *
 * PRIMARY: Sentinel Hub Statistical API (Copernicus Data Space)
 *   POST https://sh.dataspace.copernicus.eu/api/v1/statistics
 *   Returns real Sentinel-2 NDVI over the project polygon for the past 90 days.
 *   Auth: OAuth2 client_credentials via copernicusAuth.ts
 *
 * FALLBACK: Open-Meteo ERA5 soil/climate data (free, no key) when
 *   Copernicus credentials are absent or the API call fails.
 */

import { getCopernicusToken, hasCopernicusCredentials } from "../copernicusAuth.js";

export interface CopernicusData {
  soilMoistureIndex: number;       // 0–1
  surfaceWaterLevel: number;       // metres proxy
  waterStorageTrend: number;       // mm/month
  vegetationStress: number;        // 0–1
  droughtRisk: number;             // 0–1
  usageReductionEstimate: number;  // 0–1
  confidenceScore: number;         // 0–1
  precipMm?: number;
  etMm?: number;
  ndviMean?: number;               // real Sentinel-2 NDVI (when available)
  ndviMin?: number;
  ndviMax?: number;
  sentinel2Date?: string;          // most recent Sentinel-2 capture date
  source: "sentinel-2-live" | "open-meteo-live";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function centroid(polygon: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (!polygon || polygon.length === 0) return { lat: 34.05, lng: -118.25 };
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  return { lat, lng };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Build a GeoJSON polygon ring from a center point + half-side in degrees (~2.5 km). */
function bboxRing(lat: number, lng: number, d = 0.025): number[][] {
  return [
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
    [lng - d, lat - d],
  ];
}

/** Convert project polygon array to GeoJSON ring, or create bbox from center. */
function toGeoJsonRing(polygon: { lat: number; lng: number }[]): number[][] {
  if (polygon.length >= 3) {
    const ring = polygon.map(p => [p.lng, p.lat] as number[]);
    // Close the ring
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push([...ring[0]]);
    }
    return ring;
  }
  const c = centroid(polygon);
  return bboxRing(c.lat, c.lng);
}

const NDVI_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"], units: "REFLECTANCE" }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(samples) {
  let ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04 + 0.0001);
  return { ndvi: [ndvi], dataMask: [samples.dataMask] };
}`;

const SH_STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics";

// ── Sentinel-2 Statistical API call ───────────────────────────────────────────

async function fetchSentinel2Ndvi(
  polygon: { lat: number; lng: number }[]
): Promise<{ mean: number; min: number; max: number; date: string } | null> {
  const token = await getCopernicusToken();
  const ring  = toGeoJsonRing(polygon);

  const now   = new Date();
  const toISO = now.toISOString().replace(/\.\d+Z$/, "Z");
  const from  = new Date(now.getTime() - 90 * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");

  const body = {
    input: {
      bounds: {
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
      },
      data: [{
        type: "sentinel-2-l2a",
        dataFilter: {
          timeRange: { from, to: toISO },
          maxCloudCoverage: 60,
        },
      }],
    },
    aggregation: {
      timeRange: { from, to: toISO },
      aggregationInterval: { of: "P90D" },
      evalscript: NDVI_EVALSCRIPT,
      width: 128,
      height: 128,
    },
  };

  const res = await fetch(SH_STATS_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${token}`,
    },
    body:   JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sentinel Hub Statistical API HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json() as {
    data: Array<{
      interval: { from: string; to: string };
      outputs: {
        ndvi: { bands: { B0: { stats: { mean: number; min: number; max: number; sampleCount: number } } } };
      };
      status: string;
    }>;
  };

  // Find the most recent interval with valid data
  const valid = (json.data ?? [])
    .filter(d => d.status === "OK" && d.outputs?.ndvi?.bands?.B0?.stats?.sampleCount > 0)
    .sort((a, b) => new Date(b.interval.from).getTime() - new Date(a.interval.from).getTime());

  if (valid.length === 0) return null;

  const stats = valid[0].outputs.ndvi.bands.B0.stats;
  return {
    mean: parseFloat(stats.mean.toFixed(4)),
    min:  parseFloat(stats.min.toFixed(4)),
    max:  parseFloat(stats.max.toFixed(4)),
    date: valid[0].interval.from.slice(0, 10),
  };
}

// ── Open-Meteo fallback ────────────────────────────────────────────────────────

async function fetchOpenMeteoFallback(lat: number, lng: number): Promise<{
  soilMoistureIndex: number;
  precipMm: number;
  etMm: number;
  droughtRisk: number;
  waterStorageTrend: number;
  surfaceWaterLevel: number;
}> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&daily=precipitation_sum,et0_fao_evapotranspiration` +
    `&hourly=soil_moisture_0_to_1cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm` +
    `&past_days=7&forecast_days=1&timezone=auto`;

  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

  const json = await res.json() as {
    daily: {
      precipitation_sum: (number | null)[];
      et0_fao_evapotranspiration: (number | null)[];
    };
    hourly: {
      time: string[];
      soil_moisture_0_to_1cm: (number | null)[];
      soil_moisture_3_to_9cm: (number | null)[];
      soil_moisture_9_to_27cm: (number | null)[];
    };
  };

  const now = Date.now();
  const recent = json.hourly.time
    .map((t, i) => ({ ts: new Date(t).getTime(), i }))
    .filter(({ ts }) => now - ts < 86_400_000)
    .map(({ i }) => i);

  const avgLayer = (arr: (number | null)[]) => {
    const v = recent.map(i => arr[i]).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.3;
  };

  const smRaw = avgLayer(json.hourly.soil_moisture_0_to_1cm) * 0.2
              + avgLayer(json.hourly.soil_moisture_3_to_9cm) * 0.35
              + avgLayer(json.hourly.soil_moisture_9_to_27cm) * 0.45;
  const soilMoistureIndex = clamp01(smRaw / 0.4);

  const precipMm = (json.daily.precipitation_sum.filter((v): v is number => v != null)).reduce((a, b) => a + b, 0);
  const etMm     = (json.daily.et0_fao_evapotranspiration.filter((v): v is number => v != null)).reduce((a, b) => a + b, 0);

  const droughtRisk      = clamp01((1 - soilMoistureIndex) * 0.6 + clamp01(1 - Math.min(precipMm / 25, 1)) * 0.4);
  const waterStorageTrend = parseFloat(((precipMm - etMm) * (30 / 7)).toFixed(2));
  const surfaceWaterLevel = etMm > 0 ? parseFloat(Math.min(precipMm / etMm * 2.5, 8).toFixed(2)) : parseFloat((precipMm / 10).toFixed(2));

  return { soilMoistureIndex, precipMm, etMm, droughtRisk, waterStorageTrend, surfaceWaterLevel };
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function fetchCopernicusData(
  polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<CopernicusData> {
  const { lat, lng } = centroid(polygon);

  // ── Try real Sentinel-2 NDVI first ─────────────────────────────────────────
  let ndviResult: Awaited<ReturnType<typeof fetchSentinel2Ndvi>> = null;
  if (hasCopernicusCredentials()) {
    try {
      ndviResult = await fetchSentinel2Ndvi(polygon);
      if (ndviResult) {
        console.log(
          `🛰️  Sentinel-2 L2A (${lat.toFixed(3)},${lng.toFixed(3)}): ` +
          `NDVI mean=${ndviResult.mean.toFixed(3)} [${ndviResult.min.toFixed(3)}–${ndviResult.max.toFixed(3)}] ` +
          `capture ${ndviResult.date}`
        );
      }
    } catch (err: any) {
      console.warn(`⚠️  Sentinel-2 Statistical API failed: ${err.message} — falling back to Open-Meteo`);
    }
  }

  // ── Always fetch Open-Meteo climate data (soil moisture, precip, ET) ────────
  let climate = { soilMoistureIndex: 0.4, precipMm: 20, etMm: 18, droughtRisk: 0.3, waterStorageTrend: 0, surfaceWaterLevel: 2.0 };
  try {
    climate = await fetchOpenMeteoFallback(lat, lng);
    console.log(
      `🌧️  Open-Meteo (${lat.toFixed(2)},${lng.toFixed(2)}): ` +
      `SM=${(climate.soilMoistureIndex * 100).toFixed(0)}% ` +
      `precip=${climate.precipMm.toFixed(1)}mm ET=${climate.etMm.toFixed(1)}mm`
    );
  } catch (err: any) {
    console.warn(`⚠️  Open-Meteo fallback failed: ${err.message}`);
  }

  // ── Derive vegetation stress from NDVI (if available) or soil moisture ──────
  let vegetationStress: number;
  let confidenceScore: number;

  if (ndviResult) {
    // Real NDVI: stress = 1 - normalized NDVI (NDVI 0.8 → stress 0.0; NDVI 0.0 → stress 1.0)
    vegetationStress = clamp01(1 - clamp01(ndviResult.mean / 0.8));
    confidenceScore  = 0.93;
  } else {
    vegetationStress = clamp01(0.9 - climate.soilMoistureIndex * 0.85);
    confidenceScore  = 0.78;
  }

  const usageReductionEstimate = clamp01(climate.soilMoistureIndex * 0.4 + (1 - climate.droughtRisk) * 0.3);

  return {
    soilMoistureIndex:      parseFloat(climate.soilMoistureIndex.toFixed(3)),
    surfaceWaterLevel:      climate.surfaceWaterLevel,
    waterStorageTrend:      climate.waterStorageTrend,
    vegetationStress:       parseFloat(vegetationStress.toFixed(3)),
    droughtRisk:            parseFloat(climate.droughtRisk.toFixed(3)),
    usageReductionEstimate: parseFloat(usageReductionEstimate.toFixed(3)),
    confidenceScore,
    precipMm:               parseFloat(climate.precipMm.toFixed(1)),
    etMm:                   parseFloat(climate.etMm.toFixed(1)),
    ndviMean:               ndviResult?.mean,
    ndviMin:                ndviResult?.min,
    ndviMax:                ndviResult?.max,
    sentinel2Date:          ndviResult?.date,
    source:                 ndviResult ? "sentinel-2-live" : "open-meteo-live",
  };
}
