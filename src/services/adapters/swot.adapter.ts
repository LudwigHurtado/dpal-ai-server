/**
 * SWOT surface water adapter — powered by Open-Meteo Flood API
 *
 * The NASA SWOT satellite (launched Dec 2022) measures surface water
 * extent and level globally. Its science-quality data products are
 * distributed as large HDF5 granules via NASA PO.DAAC and require
 * specialised parsing tooling (not practical for a server-side REST call).
 *
 * Instead we use the Open-Meteo Flood API which provides daily river
 * discharge (m³/s) derived from the GloFAS (Global Flood Awareness System)
 * hydrological model — the same model used by the Copernicus Emergency
 * Management Service and the European Centre for Medium-Range Weather
 * Forecasts (ECMWF).  Data is real, updated daily, free, no API key.
 *
 * Discharge → surface water level conversion uses a log-scale proxy
 * (Manning / hydraulic geometry relationship):
 *   level ≈ clamp(0.3, 8.0, log10(max(1, discharge)) * 1.8)
 *
 * TODO: Replace with direct NASA SWOT Level 3 River SP granule fetch
 * once NASA_EARTHDATA_TOKEN is set in Railway env and gdal/h5py are
 * available in the container:
 *   https://podaac.earthdata.nasa.gov/search/?shortName=SWOT_L3_LR_SSH_1.0
 */

export interface SwotData {
  surfaceWaterLevel: number;  // metres (hydraulic proxy)
  riverDischarge?: number;    // m³/s (raw from GloFAS)
  confidenceScore: number;    // 0–1
  source: "open-meteo-glofas";
}

function centroid(polygon: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (!polygon || polygon.length === 0) return { lat: 34.05, lng: -118.25 };
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  return { lat, lng };
}

export async function fetchSwotData(
  polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<SwotData> {
  const { lat, lng } = centroid(polygon);

  const url =
    `https://flood-api.open-meteo.com/v1/flood` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&daily=river_discharge` +
    `&past_days=7&forecast_days=0`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Open-Meteo Flood API HTTP ${res.status}`);

  const json = await res.json() as {
    daily: {
      time: string[];
      river_discharge: (number | null)[];
    };
  };

  // Use the most recent non-null discharge value
  const dischargeVals = (json.daily?.river_discharge ?? [])
    .filter((v): v is number => v != null && v >= 0);

  let discharge = 1.0; // fallback: small stream ~1 m³/s
  let confidence = 0.65;

  if (dischargeVals.length > 0) {
    // Average last 3 days if available for stability
    const recent = dischargeVals.slice(-3);
    discharge = recent.reduce((a, b) => a + b, 0) / recent.length;
    confidence = dischargeVals.length >= 5 ? 0.88 : dischargeVals.length >= 2 ? 0.78 : 0.68;
  }

  // Log-scale hydraulic proxy: small stream ≈ 0.3m, large river ≈ 6-8m
  // log10(1)=0 → 0.3m  log10(10)=1 → 1.8m  log10(1000)=3 → 5.4m
  const surfaceWaterLevel = parseFloat(
    Math.max(0.3, Math.min(8.0, Math.log10(Math.max(1, discharge)) * 1.8)).toFixed(2)
  );

  console.log(
    `🌊 SWOT-proxy (${lat.toFixed(2)},${lng.toFixed(2)}): ` +
    `Q=${discharge.toFixed(1)} m³/s → level≈${surfaceWaterLevel}m`
  );

  return {
    surfaceWaterLevel,
    riverDischarge: parseFloat(discharge.toFixed(2)),
    confidenceScore: confidence,
    source: "open-meteo-glofas",
  };
}
