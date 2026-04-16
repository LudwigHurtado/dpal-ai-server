/**
 * GIBS vegetation / drought adapter — powered by NASA POWER API
 *
 * NASA GIBS (Global Imagery Browse Services) provides WMS/WMTS tile imagery
 * for visualisation but does NOT expose a REST endpoint for per-pixel numeric
 * values.  Actual NDVI values come from MODIS MOD13Q1 (250 m, 16-day) or
 * Sentinel-2, which require NASA Earthdata authentication and HDF5/GeoTIFF
 * parsing tooling not available in a lightweight Node server.
 *
 * This adapter instead uses the NASA POWER API (MERRA-2 assimilation) which
 * provides real satellite-derived soil wetness at three depths:
 *
 *   GWETTOP   — surface layer soil wetness  (0–1)
 *   GWETROOT  — root-zone soil wetness      (0–1)  ← primary vegetation signal
 *   GWETPROF  — full-profile soil wetness   (0–1)
 *
 * Root-zone soil wetness (GWETROOT) is the single strongest predictor of
 * vegetation stress and drought (r² ≈ 0.7–0.85 against MODIS NDVI anomaly
 * in peer-reviewed literature).
 *
 * Derived indices:
 *   vegetationStress = 1 - (0.6 * gwetRoot + 0.4 * gwetTop)
 *   droughtRisk      = (smDeficit * 0.6) + (precipDeficit * 0.4)
 *
 * Free, no API key.  Updated daily, ~3-7 day lag.
 * https://power.larc.nasa.gov/api/
 *
 * TODO: Replace with direct MODIS NDVI point extraction once
 * NASA_EARTHDATA_TOKEN is available in Railway env:
 *   NASA AppEEARS: https://appeears.earthdatacloud.nasa.gov/api/
 *   Product: MOD13Q1.061 — band NDVI (250m, 16-day composite)
 */

export interface GibsData {
  vegetationStress: number;  // 0–1  (0 = healthy, 1 = severely stressed)
  droughtRisk: number;       // 0–1
  gwetRoot?: number;         // raw root-zone wetness (0–1) from MERRA-2
  gwetTop?: number;          // raw surface wetness (0–1) from MERRA-2
  precipMm?: number;         // mm over measurement window
  imageUrl: string;          // GIBS NDVI tile URL (for display only)
  confidenceScore: number;   // 0–1
  source: "nasa-power";
}

function centroid(polygon: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (!polygon || polygon.length === 0) return { lat: 34.05, lng: -118.25 };
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  return { lat, lng };
}

function powerDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Build a GIBS NDVI browse tile URL for the location (for visual display). */
function gibsNdviTileUrl(lat: number, lng: number): string {
  // MODIS Terra NDVI 8-Day composite via GIBS WMTS
  // Tile coordinates approximate — for display only
  const today = new Date().toISOString().slice(0, 10);
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/` +
    `MODIS_Terra_NDVI_8Day/default/${today}/250m/6/` +
    `${Math.floor((90 - lat) / 2.8125)}/` +
    `${Math.floor((lng + 180) / 2.8125)}.png`
  );
}

export async function fetchGibsData(
  polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<GibsData> {
  const { lat, lng } = centroid(polygon);

  // Request last 14 days (7-day lag buffer)
  const end   = new Date(Date.now() - 7 * 86_400_000);
  const start = new Date(Date.now() - 21 * 86_400_000);

  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=GWETTOP,GWETROOT,GWETPROF,PRECTOTCORR` +
    `&community=AG` +
    `&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&start=${powerDate(start)}&end=${powerDate(end)}` +
    `&format=JSON`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`NASA POWER (GIBS proxy) HTTP ${res.status}`);

  const json = await res.json() as {
    properties: {
      parameter: {
        GWETTOP:     Record<string, number>;
        GWETROOT:    Record<string, number>;
        GWETPROF:    Record<string, number>;
        PRECTOTCORR: Record<string, number>;
      };
    };
  };

  const param = json?.properties?.parameter;
  if (!param) throw new Error("NASA POWER (GIBS): unexpected response shape");

  function validVals(obj: Record<string, number>): number[] {
    return Object.values(obj).filter(v => v != null && v > -900);
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const gwetTopVals  = validVals(param.GWETTOP);
  const gwetRootVals = validVals(param.GWETROOT);
  const precipVals   = validVals(param.PRECTOTCORR);

  const gwetTop  = avg(gwetTopVals);
  const gwetRoot = avg(gwetRootVals);
  const precipMm = precipVals.reduce((a, b) => a + b, 0);

  // Vegetation stress: inverse of weighted root-zone + surface wetness
  const wetness       = clamp01(gwetRoot * 0.6 + gwetTop * 0.4);
  const vegetationStress = clamp01(1 - wetness);

  // Drought risk: soil moisture deficit + precipitation deficit
  const smDeficit     = clamp01(1 - gwetRoot);
  const precipDeficit = clamp01(1 - Math.min(precipMm / 20, 1)); // 20mm/2wk = normal
  const droughtRisk   = clamp01(smDeficit * 0.6 + precipDeficit * 0.4);

  const totalPoints = gwetTopVals.length + gwetRootVals.length + precipVals.length;
  const confidenceScore = totalPoints > 40 ? 0.88 : totalPoints > 20 ? 0.80 : 0.70;

  console.log(
    `🌿 GIBS-proxy/NASA-POWER (${lat.toFixed(2)},${lng.toFixed(2)}): ` +
    `gwetRoot=${(gwetRoot * 100).toFixed(0)}% ` +
    `vegStress=${(vegetationStress * 100).toFixed(0)}% ` +
    `drought=${(droughtRisk * 100).toFixed(0)}%`
  );

  return {
    vegetationStress:  parseFloat(vegetationStress.toFixed(3)),
    droughtRisk:       parseFloat(droughtRisk.toFixed(3)),
    gwetRoot:          parseFloat(gwetRoot.toFixed(3)),
    gwetTop:           parseFloat(gwetTop.toFixed(3)),
    precipMm:          parseFloat(precipMm.toFixed(1)),
    imageUrl:          gibsNdviTileUrl(lat, lng),
    confidenceScore,
    source:            "nasa-power",
  };
}
