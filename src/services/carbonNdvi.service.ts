/**
 * Carbon MRV — Real NDVI computation via NASA POWER API
 *
 * NASA POWER (Prediction of Worldwide Energy Resource) provides daily
 * satellite-derived soil wetness and radiation data from the MERRA-2
 * atmospheric reanalysis model which assimilates observations from
 * multiple NASA satellite missions.
 *
 * NDVI proxy model:
 *   ndvi = base_ndvi(projectType) + gwetRoot * vegResponseFactor + radiation_bonus - drought_penalty
 *
 * Parameters used:
 *   GWETROOT  — root-zone soil wetness (0–1)    ← strongest NDVI predictor
 *   GWETTOP   — surface soil wetness (0–1)
 *   ALLSKY_SFC_SW_DWN — all-sky surface shortwave radiation (MJ/m²/day)
 *   T2M       — temperature at 2m (°C)
 *   PRECTOTCORR — precipitation (mm/day)
 *
 * This is NOT raw spectral NDVI (NIR-Red)/(NIR+Red) — it is a
 * vegetation health index derived from real climate/soil data that
 * correlates strongly with NDVI anomalies.
 *
 * Provider tag: "NASA POWER / MERRA-2"
 *
 * TODO: For true spectral NDVI, integrate NASA AppEEARS async API
 * (MOD13Q1 product, 250m, 16-day composite) once NASA_EARTHDATA_TOKEN
 * is set in Railway env: https://appeears.earthdatacloud.nasa.gov/api/
 */

function centroid(polygon: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (!polygon || polygon.length === 0) return { lat: 34.05, lng: -118.25 };
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  return { lat, lng };
}

function powerDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** NDVI baseline by project type (typical healthy ecosystem value). */
const BASE_NDVI: Record<string, number> = {
  forest:              0.70,
  reforestation:       0.45,
  mangrove:            0.55,
  wetland:             0.50,
  grassland:           0.35,
  peatland:            0.45,
  savanna:             0.30,
  agroforestry:        0.50,
  soil_carbon:         0.30,
  blue_carbon:         0.48,
  avoided_deforestation: 0.65,
};

/** How strongly each project type responds to soil wetness changes. */
const VEG_RESPONSE: Record<string, number> = {
  forest:              0.20,
  reforestation:       0.28,
  mangrove:            0.22,
  wetland:             0.25,
  grassland:           0.35,
  peatland:            0.18,
  savanna:             0.38,
  agroforestry:        0.28,
  soil_carbon:         0.30,
  blue_carbon:         0.20,
  avoided_deforestation: 0.18,
};

export interface CarbonNdviResult {
  ndviScore: number;
  landCoverType: string;
  deforestationAlert: boolean;
  cloudCoverPercent: number;
  provider: string;
  imageUrl: string;
  rawMetadata: Record<string, unknown>;
}

export async function fetchNdviForCarbon(
  polygon: { lat: number; lng: number }[],
  projectType: string,
  previousNdvi: number
): Promise<CarbonNdviResult> {
  const { lat, lng } = centroid(polygon);

  // Request last 14 days (7-day lag buffer)
  const end   = new Date(Date.now() - 7 * 86_400_000);
  const start = new Date(Date.now() - 21 * 86_400_000);

  let gwetRoot = 0.45, gwetTop = 0.45, radiation = 15, tempC = 20, precipMm = 30;
  let dataSource = "fallback-estimate";

  try {
    const url =
      `https://power.larc.nasa.gov/api/temporal/daily/point` +
      `?parameters=GWETROOT,GWETTOP,ALLSKY_SFC_SW_DWN,T2M,PRECTOTCORR` +
      `&community=AG` +
      `&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}` +
      `&start=${powerDate(start)}&end=${powerDate(end)}` +
      `&format=JSON`;

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);

    const json = await res.json() as {
      properties: {
        parameter: {
          GWETROOT:          Record<string, number>;
          GWETTOP:           Record<string, number>;
          ALLSKY_SFC_SW_DWN: Record<string, number>;
          T2M:               Record<string, number>;
          PRECTOTCORR:       Record<string, number>;
        };
      };
    };

    const param = json?.properties?.parameter;
    if (!param) throw new Error("NASA POWER: bad response");

    const valid = (obj: Record<string, number>) =>
      Object.values(obj).filter(v => v != null && v > -900);
    const avg   = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const sum   = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

    gwetRoot  = avg(valid(param.GWETROOT));
    gwetTop   = avg(valid(param.GWETTOP));
    radiation = avg(valid(param.ALLSKY_SFC_SW_DWN));
    tempC     = avg(valid(param.T2M));
    precipMm  = sum(valid(param.PRECTOTCORR));
    dataSource = "nasa-power-merra2";

    console.log(
      `🌱 Carbon NDVI (${lat.toFixed(2)},${lng.toFixed(2)}) [${projectType}]: ` +
      `gwetRoot=${(gwetRoot*100).toFixed(0)}% rad=${radiation.toFixed(1)}MJ ` +
      `T=${tempC.toFixed(1)}°C precip=${precipMm.toFixed(1)}mm`
    );
  } catch (err: any) {
    console.warn(`⚠️  NASA POWER unavailable for carbon NDVI (${lat.toFixed(2)},${lng.toFixed(2)}): ${err.message} — using climate estimate`);
  }

  // ── NDVI Model ──────────────────────────────────────────────────────────────
  const baseNdvi    = BASE_NDVI[projectType] ?? 0.45;
  const vegResponse = VEG_RESPONSE[projectType] ?? 0.25;

  // Soil wetness component — most important driver
  const wetnessFactor = (gwetRoot * 0.7 + gwetTop * 0.3) * vegResponse;

  // Radiation component — photosynthetically active radiation boost
  // Optimal PAR ≈ 15–20 MJ/m²/day; too high in arid areas = stress
  const radFactor = clamp((radiation - 5) / 20, 0, 0.12);

  // Temperature stress — too cold (<5°C) or too hot (>35°C) suppresses vegetation
  const tempOk  = tempC >= 5 && tempC <= 35;
  const tempBonus = tempOk ? 0.03 : -0.05;

  // Drought penalty — very low precip + low soil moisture
  const droughtPenalty = (precipMm < 5 && gwetRoot < 0.2) ? 0.08 : 0;

  let ndviScore = clamp(baseNdvi + wetnessFactor + radFactor + tempBonus - droughtPenalty, 0.02, 0.97);

  // Continuity: don't let NDVI swing more than ±0.08 per snapshot (realistic change rate)
  if (previousNdvi > 0) {
    ndviScore = clamp(ndviScore, previousNdvi - 0.08, previousNdvi + 0.08);
  }

  // Land cover type
  const landCoverType =
    ndviScore > 0.7 ? "dense_vegetation" :
    ndviScore > 0.45 ? "moderate_vegetation" :
    ndviScore > 0.25 ? "sparse_vegetation" : "bare_or_degraded";

  // Deforestation alert: NDVI dropped significantly vs previous
  const deforestationAlert = previousNdvi > 0 && (ndviScore - previousNdvi) < -0.06;

  // Cloud cover: rough estimate from radiation (high radiation = clear sky)
  const cloudCoverPercent = Math.round(clamp(100 - (radiation / 25 * 100), 5, 85));

  // GIBS imagery tile URL for display
  const today = new Date().toISOString().slice(0, 10);
  const imageUrl =
    `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/` +
    `MODIS_Terra_NDVI_8Day/default/${today}/250m/6/` +
    `${Math.floor((90 - lat) / 2.8125)}/${Math.floor((lng + 180) / 2.8125)}.png`;

  return {
    ndviScore:          parseFloat(ndviScore.toFixed(4)),
    landCoverType,
    deforestationAlert,
    cloudCoverPercent,
    provider:           "NASA POWER / MERRA-2",
    imageUrl,
    rawMetadata: {
      source:       dataSource,
      gwetRoot:     parseFloat(gwetRoot.toFixed(3)),
      gwetTop:      parseFloat(gwetTop.toFixed(3)),
      radiation_MJ: parseFloat(radiation.toFixed(2)),
      temp_C:       parseFloat(tempC.toFixed(1)),
      precip_mm:    parseFloat(precipMm.toFixed(1)),
      lat, lng,
      projectType,
    },
  };
}
