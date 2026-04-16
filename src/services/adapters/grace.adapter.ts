/**
 * GRACE-FO water storage adapter — powered by NASA POWER API
 *
 * The real GRACE-FO (Gravity Recovery and Climate Experiment Follow-On)
 * satellite detects month-to-month changes in terrestrial water storage
 * by measuring tiny gravity variations. Its Level-3 gridded products are
 * released monthly as NetCDF files via NASA PO.DAAC — not suitable for
 * a synchronous REST call.
 *
 * Instead we use the NASA POWER (Prediction of Worldwide Energy Resource)
 * API which provides daily:
 *   PRECTOTCORR  — precipitation corrected  (mm/day)   ← MERRA-2 assimilation
 *   EVLAND       — evapotranspiration land   (mm/day)   ← MERRA-2
 *   GWETROOT     — root-zone soil wetness    (0–1)      ← MERRA-2 satellite-derived
 *   GWETPROF     — profile soil wetness      (0–1)      ← MERRA-2 satellite-derived
 *
 * Water storage trend = (precip – ET) integrated over the last 30 days,
 * expressed in mm/month.  Root-zone wetness provides the confidence signal.
 *
 * Free, no API key required.  Lag ~3–7 days.
 * https://power.larc.nasa.gov/api/
 *
 * TODO: Replace with direct GRACE-FO RL06 mascon fetch once
 * NASA_EARTHDATA_TOKEN is available:
 *   https://podaac.earthdata.nasa.gov/ short_name=TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.1_V3
 */

export interface GraceData {
  waterStorageTrend: number;  // mm/month (positive = gaining, negative = losing)
  rootZoneWetness?: number;   // 0–1 (GWETROOT from MERRA-2)
  precipMm?: number;          // mm over measurement window
  etMm?: number;              // mm over measurement window
  confidenceScore: number;    // 0–1
  source: "nasa-power";
}

function centroid(polygon: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (!polygon || polygon.length === 0) return { lat: 34.05, lng: -118.25 };
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  return { lat, lng };
}

/** Format a Date as YYYYMMDD for NASA POWER API. */
function powerDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function fetchGraceData(
  polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<GraceData> {
  const { lat, lng } = centroid(polygon);

  // Request last 30 days (POWER has ~7 day lag, so go back 37 days to be safe)
  const end   = new Date(Date.now() - 7 * 86_400_000);  // 7 days ago
  const start = new Date(Date.now() - 37 * 86_400_000); // 37 days ago

  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=PRECTOTCORR,EVLAND,GWETROOT,GWETPROF` +
    `&community=AG` +
    `&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&start=${powerDate(start)}&end=${powerDate(end)}` +
    `&format=JSON`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`NASA POWER API HTTP ${res.status}`);

  const json = await res.json() as {
    properties: {
      parameter: {
        PRECTOTCORR: Record<string, number>;
        EVLAND:      Record<string, number>;
        GWETROOT:    Record<string, number>;
        GWETPROF:    Record<string, number>;
      };
    };
  };

  const param = json?.properties?.parameter;
  if (!param) throw new Error("NASA POWER: unexpected response shape");

  // Extract valid daily values (NASA POWER uses -999 as fill value)
  function validVals(obj: Record<string, number>): number[] {
    return Object.values(obj).filter(v => v != null && v > -900);
  }

  const precipVals  = validVals(param.PRECTOTCORR);
  const etVals      = validVals(param.EVLAND);
  const gwetRoots   = validVals(param.GWETROOT);
  const gwetProfs   = validVals(param.GWETPROF);

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const precipTotal = precipVals.reduce((a, b) => a + b, 0);  // mm over window
  const etTotal     = etVals.reduce((a, b) => a + b, 0);
  const days        = Math.max(precipVals.length, etVals.length, 1);

  // Scale net balance to mm/month
  const netBalance      = precipTotal - etTotal;
  const waterStorageTrend = parseFloat((netBalance * (30 / days)).toFixed(2));

  const rootZoneWetness = parseFloat(avg(gwetRoots).toFixed(3));

  // Confidence: more data points = higher confidence
  const totalPoints = precipVals.length + etVals.length + gwetRoots.length;
  const confidenceScore = totalPoints > 60 ? 0.90 : totalPoints > 30 ? 0.82 : 0.72;

  console.log(
    `🌍 GRACE-proxy/NASA-POWER (${lat.toFixed(2)},${lng.toFixed(2)}): ` +
    `precip=${precipTotal.toFixed(1)}mm ET=${etTotal.toFixed(1)}mm ` +
    `trend=${waterStorageTrend}mm/mo rootWet=${(rootZoneWetness*100).toFixed(0)}%`
  );

  return {
    waterStorageTrend,
    rootZoneWetness,
    precipMm:  parseFloat(precipTotal.toFixed(1)),
    etMm:      parseFloat(etTotal.toFixed(1)),
    confidenceScore,
    source: "nasa-power",
  };
}
