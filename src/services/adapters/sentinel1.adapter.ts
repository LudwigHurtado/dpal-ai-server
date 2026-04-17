/**
 * Sentinel-1 SAR water detection adapter
 *
 * Uses the Copernicus Data Space Sentinel Hub Statistical API to pull
 * Sentinel-1 GRD (Ground Range Detected) backscatter over the project area.
 *
 * SAR physics:
 *   • Open water → very low VV backscatter (< 0.03 linear, < −15 dB)
 *   • Moist soil → moderate VV (0.03–0.10 linear)
 *   • Dry land   → high VV (> 0.10 linear)
 *
 * This adapter returns:
 *   waterFraction   — fraction of pixels detected as open water (0–1)
 *   vvMeanLinear    — mean VV backscatter in linear power
 *   vvMeanDb        — mean VV in decibels
 *   floodRisk       — 0–1 derived from backscatter anomaly vs typical land
 *   source          — "sentinel-1-sar" or "unavailable"
 *
 * Falls back to a neutral estimate if credentials are absent or the API fails.
 */

import { getCopernicusToken, hasCopernicusCredentials } from "../copernicusAuth.js";

export interface Sentinel1Data {
  waterFraction: number;   // 0–1 fraction of AOI covered by water
  vvMeanLinear: number;    // mean VV backscatter (linear power, 0–1 scale)
  vvMeanDb: number;        // mean VV in dB (typically −25 to 0)
  floodRisk: number;       // 0–1 derived from backscatter
  confidenceScore: number; // 0–1
  captureDate?: string;    // most recent SAR acquisition date
  source: "sentinel-1-sar" | "unavailable";
}

function centroid(polygon: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (!polygon || polygon.length === 0) return { lat: 34.05, lng: -118.25 };
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  return { lat, lng };
}

function bboxRing(lat: number, lng: number, d = 0.025): number[][] {
  return [
    [lng - d, lat - d], [lng + d, lat - d],
    [lng + d, lat + d], [lng - d, lat + d],
    [lng - d, lat - d],
  ];
}

function toGeoJsonRing(polygon: { lat: number; lng: number }[]): number[][] {
  if (polygon.length >= 3) {
    const ring = polygon.map(p => [p.lng, p.lat] as number[]);
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push([...ring[0]]);
    }
    return ring;
  }
  const c = centroid(polygon);
  return bboxRing(c.lat, c.lng);
}

// Water threshold in linear power: < 0.03 ≈ < −15 dB = likely open water
const WATER_THRESHOLD = 0.03;
const LAND_TYPICAL_VV = 0.08; // typical dry land VV linear

const SAR_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "dataMask"], units: "LINEAR_POWER" }],
    output: [
      { id: "vv",       bands: 1, sampleType: "FLOAT32" },
      { id: "water",    bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(samples) {
  let vv    = samples.VV;
  let water = vv < ${WATER_THRESHOLD} ? 1.0 : 0.0;
  return { vv: [vv], water: [water], dataMask: [samples.dataMask] };
}`;

const SH_STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics";

export async function fetchSentinel1Data(
  polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<Sentinel1Data> {
  if (!hasCopernicusCredentials()) {
    return { waterFraction: 0.1, vvMeanLinear: 0.06, vvMeanDb: -12, floodRisk: 0.2, confidenceScore: 0.3, source: "unavailable" };
  }

  try {
    const token = await getCopernicusToken();
    const ring  = toGeoJsonRing(polygon);

    const now  = new Date();
    const toISO  = now.toISOString().replace(/\.\d+Z$/, "Z");
    const from   = new Date(now.getTime() - 30 * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");

    const body = {
      input: {
        bounds: {
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
        },
        data: [{
          type: "sentinel-1-grd",
          dataFilter: {
            timeRange: { from, to: toISO },
            acquisitionMode: "IW",
            polarization: "DV",
          },
          processing: { backCoeff: "GAMMA0_TERRAIN", orthorectify: true },
        }],
      },
      aggregation: {
        timeRange: { from, to: toISO },
        aggregationInterval: { of: "P30D" },
        evalscript: SAR_EVALSCRIPT,
        width: 512,
        height: 512,
      },
    };

    const res = await fetch(SH_STATS_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sentinel-1 Statistical API HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json() as {
      data: Array<{
        interval: { from: string };
        outputs: {
          vv:    { bands: { B0: { stats: { mean: number; sampleCount: number } } } };
          water: { bands: { B0: { stats: { mean: number } } } };
        };
        status: string;
      }>;
    };

    const valid = (json.data ?? [])
      .filter(d => d.status === "OK" && (d.outputs?.vv?.bands?.B0?.stats?.sampleCount ?? 0) > 0)
      .sort((a, b) => new Date(b.interval.from).getTime() - new Date(a.interval.from).getTime());

    if (valid.length === 0) throw new Error("No valid Sentinel-1 acquisitions found");

    const vvMean       = valid[0].outputs.vv.bands.B0.stats.mean;
    const waterFraction = Math.max(0, Math.min(1, valid[0].outputs.water.bands.B0.stats.mean));
    const vvMeanDb     = parseFloat((10 * Math.log10(Math.max(vvMean, 1e-10))).toFixed(2));

    // Flood risk: how much lower is backscatter vs typical dry land?
    const anomaly  = Math.max(0, LAND_TYPICAL_VV - vvMean) / LAND_TYPICAL_VV;
    const floodRisk = Math.max(0, Math.min(1, waterFraction * 0.6 + anomaly * 0.4));

    const c = centroid(polygon);
    console.log(
      `📡 Sentinel-1 SAR (${c.lat.toFixed(3)},${c.lng.toFixed(3)}): ` +
      `VV=${vvMeanDb}dB waterFrac=${(waterFraction * 100).toFixed(1)}% floodRisk=${(floodRisk * 100).toFixed(0)}%`
    );

    return {
      waterFraction:  parseFloat(waterFraction.toFixed(4)),
      vvMeanLinear:   parseFloat(vvMean.toFixed(5)),
      vvMeanDb,
      floodRisk:      parseFloat(floodRisk.toFixed(3)),
      confidenceScore: 0.90,
      captureDate:    valid[0].interval.from.slice(0, 10),
      source:         "sentinel-1-sar",
    };

  } catch (err: any) {
    console.warn(`⚠️  Sentinel-1 adapter failed: ${err.message}`);
    return { waterFraction: 0.1, vvMeanLinear: 0.06, vvMeanDb: -12, floodRisk: 0.2, confidenceScore: 0.3, source: "unavailable" };
  }
}
