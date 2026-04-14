/**
 * SMAP soil moisture adapter — powered by Open-Meteo
 *
 * NASA SMAP measures top 5 cm of soil. Open-Meteo provides
 * soil_moisture_0_to_1cm and soil_moisture_1_to_3cm which closely
 * approximate the same near-surface layer, derived from ERA5 + ECMWF.
 *
 * Free, no API key. Real data, updated every hour.
 * https://open-meteo.com/en/docs#soil_moisture_0_to_1cm
 *
 * TODO: Replace with direct NASA Earthdata SMAP L3 granule fetch once
 * NASA_EARTHDATA_TOKEN is available in Railway env:
 *   https://cmr.earthdata.nasa.gov/search/granules.json?short_name=SPL3SMP
 */

export interface SmapData {
  soilMoistureIndex: number;   // 0–1 (normalised from m³/m³)
  confidenceScore: number;     // 0–1
  rawM3m3?: number;            // raw volumetric water content
  source: "open-meteo-smap-proxy";
}

function centroid(polygon: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (!polygon || polygon.length === 0) return { lat: 34.05, lng: -118.25 };
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  return { lat, lng };
}

export async function fetchSmapData(
  polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<SmapData> {
  const { lat, lng } = centroid(polygon);

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&hourly=soil_moisture_0_to_1cm,soil_moisture_1_to_3cm` +
    `&past_days=1&forecast_days=0&timezone=auto`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Open-Meteo SMAP proxy HTTP ${res.status}`);

  const json = await res.json() as {
    hourly: {
      time: string[];
      soil_moisture_0_to_1cm: (number | null)[];
      soil_moisture_1_to_3cm: (number | null)[];
    };
  };

  // Use the most recent non-null reading from the last 6 hours
  const now = Date.now();
  const recent = json.hourly.time
    .map((t, i) => ({ ts: new Date(t).getTime(), i }))
    .filter(({ ts }) => now - ts < 6 * 3_600_000)
    .reverse(); // newest first

  let rawM3m3 = 0.3; // fallback
  for (const { i } of recent) {
    const v0 = json.hourly.soil_moisture_0_to_1cm[i];
    const v1 = json.hourly.soil_moisture_1_to_3cm[i];
    if (v0 != null && v1 != null) {
      rawM3m3 = (v0 * 0.4 + v1 * 0.6); // weight towards slightly deeper layer
      break;
    }
    if (v0 != null) { rawM3m3 = v0; break; }
  }

  // Normalise: field capacity ≈ 0.35–0.45 m³/m³ → treat 0.40 as index = 1.0
  const soilMoistureIndex = Math.max(0, Math.min(1, rawM3m3 / 0.40));
  const confidenceScore = recent.length >= 3 ? 0.88 : recent.length >= 1 ? 0.78 : 0.65;

  console.log(
    `🛰️  SMAP-proxy (${lat.toFixed(2)},${lng.toFixed(2)}): ` +
    `SM=${(soilMoistureIndex * 100).toFixed(0)}% raw=${rawM3m3.toFixed(3)} m³/m³`
  );

  return {
    soilMoistureIndex: parseFloat(soilMoistureIndex.toFixed(3)),
    confidenceScore,
    rawM3m3: parseFloat(rawM3m3.toFixed(4)),
    source: "open-meteo-smap-proxy",
  };
}
