/**
 * DPAL Earth Observation — /api/earth-observation/scan
 *
 * Uses Open-Meteo weather + air-quality APIs (free, no auth) to return
 * real atmospheric and surface-condition signals per observation type.
 * Values are Copernicus CAMS / ECMWF model output — not optical imagery,
 * but honest, live, and labelled accordingly.
 */

import { Router, type Request, type Response } from 'express';
import axios from 'axios';

const router = Router();

const OPEN_METEO    = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';

type ObservationType =
  | 'deforestation' | 'agriculture' | 'pollution'
  | 'carbon_projects' | 'floods_fires' | 'roads_cities'
  | 'water' | 'heat';

type RiskLevel = 'low' | 'moderate' | 'high' | 'unknown';

interface ScanResult {
  dataAvailable: boolean;
  observationType: ObservationType;
  signalStatus: string;
  primarySignal: string | null;
  riskLevel: RiskLevel;
  confidenceScore: number | null;
  captureDate: string;
  source: string;
  message: string;
  metrics: Record<string, number | string | null>;
}

function latestNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i];
  }
  return null;
}

function sum(arr: (number | null)[]): number {
  return arr.reduce((a: number, b) => a + (b ?? 0), 0);
}

function avg(arr: (number | null)[]): number | null {
  const clean = arr.filter((v) => v !== null) as number[];
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
}

function riskFromScore(score: number): RiskLevel {
  if (score < 0.3) return 'low';
  if (score < 0.6) return 'moderate';
  return 'high';
}

// ── GET /scan ─────────────────────────────────────────────────────────────────

router.get('/scan', async (req: Request, res: Response) => {
  const lat       = parseFloat(req.query.lat      as string);
  const lng       = parseFloat(req.query.lng      as string);
  const radiusKm  = parseFloat(req.query.radiusKm as string) || 25;
  const type      = (req.query.type as ObservationType) || 'deforestation';
  const captureDate = new Date().toISOString();

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required numeric parameters' });
  }

  try {
    // ── Weather / land surface (Open-Meteo forecast + reanalysis) ──
    const [weatherResp, aqResp] = await Promise.all([
      axios.get(OPEN_METEO, {
        params: {
          latitude:  lat,
          longitude: lng,
          daily: [
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_sum',
            'et0_fao_evapotranspiration',
            'sunshine_duration',
          ].join(','),
          hourly: [
            'temperature_2m',
            'precipitation',
            'soil_moisture_0_to_1cm',
            'soil_moisture_1_to_3cm',
            'cape',
            'surface_pressure',
          ].join(','),
          timezone:     'auto',
          forecast_days: 3,
          past_days:     14,
        },
        timeout: 10_000,
      }),
      // Always fetch AQ — used by pollution type; others use a subset
      axios.get(OPEN_METEO_AQ, {
        params: {
          latitude:  lat,
          longitude: lng,
          hourly: [
            'pm2_5', 'pm10', 'nitrogen_dioxide',
            'carbon_monoxide', 'ozone', 'dust',
            'european_aqi', 'us_aqi',
          ].join(','),
          timezone:      'auto',
          forecast_days: 1,
        },
        timeout: 10_000,
      }).catch(() => null), // AQ is supplemental — don't fail the whole scan
    ]);

    const daily  = weatherResp.data?.daily  ?? {};
    const hourly = weatherResp.data?.hourly ?? {};
    const aqH    = aqResp?.data?.hourly    ?? {};

    // ── Derived weather signals ──
    const precipSumAll   = (daily.precipitation_sum  as (number|null)[]) ?? [];
    const precip14d      = sum(precipSumAll.slice(-14));
    const precip7d       = sum(precipSumAll.slice(-7));
    const precip3d       = sum(precipSumAll.slice(-3));
    const tempMaxArr     = (daily.temperature_2m_max  as (number|null)[]) ?? [];
    const tempMinArr     = (daily.temperature_2m_min  as (number|null)[]) ?? [];
    const recentMaxTemp  = avg(tempMaxArr.slice(-7))  ?? 0;
    const recentMinTemp  = avg(tempMinArr.slice(-7))  ?? 0;
    const soilMoisture   = latestNonNull((hourly.soil_moisture_0_to_1cm  as (number|null)[]) ?? []) ?? 0;
    const soilMoisture3  = latestNonNull((hourly.soil_moisture_1_to_3cm  as (number|null)[]) ?? []) ?? 0;
    const cape           = latestNonNull((hourly.cape as (number|null)[]) ?? []) ?? 0;
    const et0Arr         = (daily.et0_fao_evapotranspiration as (number|null)[]) ?? [];
    const et07d          = avg(et0Arr.slice(-7)) ?? 0;
    const sunArr         = (daily.sunshine_duration as (number|null)[]) ?? [];
    const avgSun         = avg(sunArr.slice(-7)) ?? 0; // seconds

    // ── Air quality signals ──
    const pm25    = latestNonNull((aqH.pm2_5              as (number|null)[]) ?? []);
    const pm10    = latestNonNull((aqH.pm10               as (number|null)[]) ?? []);
    const no2     = latestNonNull((aqH.nitrogen_dioxide   as (number|null)[]) ?? []);
    const co      = latestNonNull((aqH.carbon_monoxide    as (number|null)[]) ?? []);
    const o3      = latestNonNull((aqH.ozone              as (number|null)[]) ?? []);
    const dust    = latestNonNull((aqH.dust               as (number|null)[]) ?? []);
    const euAqi   = latestNonNull((aqH.european_aqi       as (number|null)[]) ?? []);
    const usAqi   = latestNonNull((aqH.us_aqi             as (number|null)[]) ?? []);

    let result: ScanResult;

    // ── Per-type interpretation ────────────────────────────────────────────
    switch (type) {

      case 'deforestation': {
        // Vegetation stress proxy: low soil moisture + low precip + high temp
        const drynessScore = Math.min(1, Math.max(0, 1 - (soilMoisture / 0.3)));
        const heatScore    = Math.min(1, Math.max(0, (recentMaxTemp - 25) / 20));
        const precipScore  = Math.min(1, Math.max(0, 1 - (precip14d / 80)));
        const riskScore    = drynessScore * 0.5 + heatScore * 0.25 + precipScore * 0.25;
        const ndviProxy    = Math.max(0, Math.min(1, soilMoisture * 2 + precip14d / 120 - heatScore * 0.3));
        result = {
          dataAvailable: true, observationType: type,
          signalStatus: riskScore > 0.55 ? 'Elevated vegetation stress detected' : 'Canopy conditions nominal',
          primarySignal: riskScore > 0.55
            ? `Dry conditions — soil moisture ${(soilMoisture * 100).toFixed(0)}%, 14-day precip ${precip14d.toFixed(1)} mm`
            : `Adequate moisture — NDVI proxy ${(ndviProxy * 100).toFixed(0)}/100`,
          riskLevel: riskFromScore(riskScore),
          confidenceScore: 0.72,
          captureDate, source: 'Open-Meteo ECMWF · Copernicus CAMS',
          message: `Soil moisture ${(soilMoisture * 100).toFixed(0)}% at surface, 14-day precipitation ${precip14d.toFixed(1)} mm, max temp ${recentMaxTemp.toFixed(1)}°C. NDVI proxy ${(ndviProxy * 100).toFixed(0)}/100 — values above 65 suggest intact canopy; below 40 warrants optical satellite verification.`,
          metrics: {
            'NDVI proxy (0–100)': Math.round(ndviProxy * 100),
            'Soil moisture (surface %)': parseFloat((soilMoisture * 100).toFixed(1)),
            '14-day precipitation (mm)': parseFloat(precip14d.toFixed(1)),
            '7-day precip (mm)': parseFloat(precip7d.toFixed(1)),
            'Max temperature 7d avg (°C)': parseFloat(recentMaxTemp.toFixed(1)),
            'Vegetation stress score': parseFloat(riskScore.toFixed(2)),
          },
        };
        break;
      }

      case 'agriculture': {
        const aridity = precip14d < 20 && et07d > 3;
        const waterlogged = precip7d > 100 && soilMoisture > 0.4;
        const droughtStress = soilMoisture < 0.15;
        const cropStressScore = aridity ? 0.7 : droughtStress ? 0.75 : waterlogged ? 0.5 : Math.max(0, 0.3 - (soilMoisture - 0.25) * 2);
        result = {
          dataAvailable: true, observationType: type,
          signalStatus: droughtStress ? 'Drought stress detected' : waterlogged ? 'Excess moisture — waterlogging risk' : 'Crop conditions favourable',
          primarySignal: droughtStress
            ? `Soil moisture critically low (${(soilMoisture * 100).toFixed(0)}%) — irrigation likely needed`
            : waterlogged
              ? `Saturated soil (${(soilMoisture * 100).toFixed(0)}%) — drainage concern`
              : `Soil moisture ${(soilMoisture * 100).toFixed(0)}%, 7-day precip ${precip7d.toFixed(1)} mm`,
          riskLevel: riskFromScore(cropStressScore),
          confidenceScore: 0.78,
          captureDate, source: 'Open-Meteo ECMWF · Copernicus CAMS',
          message: `Soil moisture: ${(soilMoisture * 100).toFixed(0)}% (surface), ${(soilMoisture3 * 100).toFixed(0)}% (3 cm depth). Precipitation: ${precip7d.toFixed(1)} mm last 7 days, ${precip14d.toFixed(1)} mm last 14 days. Reference evapotranspiration: ${et07d.toFixed(1)} mm/day. Sunshine: ${(avgSun / 3600).toFixed(1)} hrs/day.`,
          metrics: {
            'Soil moisture surface (%)':   parseFloat((soilMoisture  * 100).toFixed(1)),
            'Soil moisture 3 cm (%)':      parseFloat((soilMoisture3 * 100).toFixed(1)),
            '7-day precipitation (mm)':    parseFloat(precip7d.toFixed(1)),
            '14-day precipitation (mm)':   parseFloat(precip14d.toFixed(1)),
            'ET0 ref evapotranspiration (mm/day)': parseFloat(et07d.toFixed(2)),
            'Sunshine hours/day (7d avg)': parseFloat((avgSun / 3600).toFixed(1)),
            'Max temp 7d avg (°C)':        parseFloat(recentMaxTemp.toFixed(1)),
          },
        };
        break;
      }

      case 'pollution': {
        const aqi = euAqi ?? 0;
        const aqiRisk = aqi <= 20 ? 0.1 : aqi <= 40 ? 0.3 : aqi <= 60 ? 0.55 : aqi <= 80 ? 0.75 : 0.95;
        const primaryPollutant =
          pm25 !== null && pm25 > 25 ? `PM2.5 elevated (${pm25.toFixed(1)} µg/m³)` :
          no2  !== null && no2  > 25  ? `NO₂ elevated (${no2.toFixed(2)} µg/m³)` :
          dust !== null && dust > 50  ? `Dust concentration (${dust.toFixed(1)} µg/m³)` :
          o3   !== null && o3   > 100 ? `Ozone elevated (${o3.toFixed(1)} µg/m³)` :
          'No dominant pollutant above guideline threshold';
        result = {
          dataAvailable: true, observationType: type,
          signalStatus: aqi <= 20 ? 'Air quality good' : aqi <= 40 ? 'Air quality fair' : aqi <= 60 ? 'Moderate pollution' : 'Poor air quality',
          primarySignal: primaryPollutant,
          riskLevel: riskFromScore(aqiRisk),
          confidenceScore: 0.82,
          captureDate, source: 'Copernicus CAMS via Open-Meteo',
          message: `European AQI: ${euAqi ?? 'n/a'} · US AQI: ${usAqi ?? 'n/a'}. PM2.5: ${pm25?.toFixed(1) ?? 'n/a'} µg/m³ (WHO 24h limit: 15). NO₂: ${no2?.toFixed(2) ?? 'n/a'} µg/m³ (WHO: 25). Ozone: ${o3?.toFixed(1) ?? 'n/a'} µg/m³ (WHO: 100). CO: ${co !== null ? (co / 1.145).toFixed(0) + ' ppb' : 'n/a'}. Dust: ${dust?.toFixed(1) ?? 'n/a'} µg/m³.`,
          metrics: {
            'European AQI':      euAqi,
            'US AQI':            usAqi,
            'PM2.5 (µg/m³)':     pm25  !== null ? parseFloat(pm25.toFixed(1))  : null,
            'PM10 (µg/m³)':      pm10  !== null ? parseFloat(pm10.toFixed(1))  : null,
            'NO₂ (µg/m³)':       no2   !== null ? parseFloat(no2.toFixed(2))   : null,
            'Ozone O₃ (µg/m³)':  o3    !== null ? parseFloat(o3.toFixed(1))    : null,
            'CO (ppb)':          co    !== null ? Math.round(co / 1.145)        : null,
            'Dust (µg/m³)':      dust  !== null ? parseFloat(dust.toFixed(1))  : null,
          },
        };
        break;
      }

      case 'carbon_projects': {
        const moistureGood = soilMoisture > 0.2 && soilMoisture < 0.5;
        const precipGood   = precip14d > 20 && precip14d < 200;
        const tempGood     = recentMaxTemp > 10 && recentMaxTemp < 35;
        const growthScore  = (moistureGood ? 0.4 : 0) + (precipGood ? 0.3 : 0) + (tempGood ? 0.3 : 0);
        const seqProxy     = Math.min(10, growthScore * 10); // tCO2e/ha/yr rough proxy
        result = {
          dataAvailable: true, observationType: type,
          signalStatus: growthScore > 0.6 ? 'Favourable sequestration conditions' : 'Sub-optimal growth conditions',
          primarySignal: `Growth potential score ${(growthScore * 100).toFixed(0)}/100 — sequestration proxy ~${seqProxy.toFixed(1)} tCO2e/ha/yr`,
          riskLevel: riskFromScore(1 - growthScore),
          confidenceScore: 0.68,
          captureDate, source: 'Open-Meteo ECMWF · Copernicus CAMS',
          message: `Carbon sequestration conditions: soil moisture ${(soilMoisture * 100).toFixed(0)}%, 14-day precip ${precip14d.toFixed(1)} mm, avg max temp ${recentMaxTemp.toFixed(1)}°C. Growth potential score ${(growthScore * 100).toFixed(0)}/100. Sequestration proxy ~${seqProxy.toFixed(1)} tCO2e/ha/yr (atmospheric proxy — Landsat NDVI required for verified MRV credit issuance).`,
          metrics: {
            'Growth potential score (0–100)':       Math.round(growthScore * 100),
            'Sequestration proxy (tCO2e/ha/yr)':    parseFloat(seqProxy.toFixed(2)),
            'Soil moisture (%)':                     parseFloat((soilMoisture * 100).toFixed(1)),
            '14-day precipitation (mm)':             parseFloat(precip14d.toFixed(1)),
            'ET0 (mm/day)':                          parseFloat(et07d.toFixed(2)),
            'Avg max temp (°C)':                     parseFloat(recentMaxTemp.toFixed(1)),
          },
        };
        break;
      }

      case 'floods_fires': {
        // Flood: recent heavy rain + saturated soil
        const floodScore = Math.min(1, (precip3d / 80) * 0.6 + (soilMoisture > 0.4 ? 0.4 : soilMoisture * 1.0));
        // Fire: dry + hot + unstable atmosphere (CAPE)
        const fireScore  = Math.min(1, (1 - soilMoisture / 0.3) * 0.4 + (Math.max(0, recentMaxTemp - 28) / 20) * 0.3 + Math.min(0.3, cape / 2000));
        const dominant   = floodScore > fireScore ? 'flood' : 'fire';
        const riskScore  = Math.max(floodScore, fireScore);
        result = {
          dataAvailable: true, observationType: type,
          signalStatus: dominant === 'flood'
            ? (floodScore > 0.5 ? 'Elevated flood risk' : 'Moderate flood potential')
            : (fireScore > 0.5 ? 'Elevated fire weather conditions' : 'Moderate fire risk conditions'),
          primarySignal: dominant === 'flood'
            ? `3-day precipitation ${precip3d.toFixed(1)} mm, soil saturation ${(soilMoisture * 100).toFixed(0)}%`
            : `Dry conditions — soil moisture ${(soilMoisture * 100).toFixed(0)}%, CAPE ${cape.toFixed(0)} J/kg, temp ${recentMaxTemp.toFixed(1)}°C`,
          riskLevel: riskFromScore(riskScore),
          confidenceScore: 0.75,
          captureDate, source: 'Open-Meteo ECMWF',
          message: `Flood score: ${(floodScore * 100).toFixed(0)}/100 — Fire score: ${(fireScore * 100).toFixed(0)}/100. 3-day precip: ${precip3d.toFixed(1)} mm. 7-day precip: ${precip7d.toFixed(1)} mm. Soil moisture: ${(soilMoisture * 100).toFixed(0)}%. CAPE (atmospheric instability): ${cape.toFixed(0)} J/kg. Max temp: ${recentMaxTemp.toFixed(1)}°C. Optical SAR verification (Sentinel-1) needed for confirmed flood extent; VIIRS for active fire detection.`,
          metrics: {
            'Flood risk score (0–100)':          Math.round(floodScore * 100),
            'Fire weather score (0–100)':         Math.round(fireScore  * 100),
            '3-day precipitation (mm)':           parseFloat(precip3d.toFixed(1)),
            '7-day precipitation (mm)':           parseFloat(precip7d.toFixed(1)),
            'Soil moisture surface (%)':          parseFloat((soilMoisture * 100).toFixed(1)),
            'CAPE J/kg (storm instability)':      parseFloat(cape.toFixed(0)),
            'Max temperature 7d avg (°C)':        parseFloat(recentMaxTemp.toFixed(1)),
          },
        };
        break;
      }

      case 'roads_cities': {
        // Urban heat proxy: sustained high temps, low moisture, high sunshine
        const heatIslandScore = Math.min(1, Math.max(0,
          (recentMaxTemp - 20) / 25 * 0.5 +
          (1 - soilMoisture / 0.3) * 0.3 +
          (avgSun / 3600 / 12) * 0.2,
        ));
        result = {
          dataAvailable: true, observationType: type,
          signalStatus: heatIslandScore > 0.55 ? 'Urban heat island conditions likely' : 'Moderate surface temperature',
          primarySignal: `Max temp ${recentMaxTemp.toFixed(1)}°C, min ${recentMinTemp.toFixed(1)}°C, sunshine ${(avgSun / 3600).toFixed(1)} h/day`,
          riskLevel: riskFromScore(heatIslandScore),
          confidenceScore: 0.70,
          captureDate, source: 'Open-Meteo ECMWF',
          message: `Urban heat proxy score: ${(heatIslandScore * 100).toFixed(0)}/100. Avg max temperature: ${recentMaxTemp.toFixed(1)}°C. Avg min temperature: ${recentMinTemp.toFixed(1)}°C. Diurnal range: ${(recentMaxTemp - recentMinTemp).toFixed(1)}°C. Sunshine: ${(avgSun / 3600).toFixed(1)} h/day. Surface soil moisture: ${(soilMoisture * 100).toFixed(0)}%. Landsat TIRS or MODIS LST product needed for urban heat island confirmation.`,
          metrics: {
            'Urban heat proxy (0–100)':     Math.round(heatIslandScore * 100),
            'Avg max temp 7d (°C)':         parseFloat(recentMaxTemp.toFixed(1)),
            'Avg min temp 7d (°C)':         parseFloat(recentMinTemp.toFixed(1)),
            'Diurnal range (°C)':           parseFloat((recentMaxTemp - recentMinTemp).toFixed(1)),
            'Sunshine h/day (7d avg)':      parseFloat((avgSun / 3600).toFixed(1)),
            'Surface soil moisture (%)':    parseFloat((soilMoisture * 100).toFixed(1)),
          },
        };
        break;
      }

      case 'water': {
        const waterDeficit  = precip14d < 20 && soilMoisture < 0.15;
        const waterSurplus  = precip7d > 80 || (soilMoisture > 0.45 && precip3d > 30);
        const waterRiskScore = waterDeficit ? 0.75 : waterSurplus ? 0.55 : 0.2;
        result = {
          dataAvailable: true, observationType: type,
          signalStatus: waterDeficit ? 'Water deficit — drought conditions' : waterSurplus ? 'Water surplus — potential flooding' : 'Water balance nominal',
          primarySignal: waterDeficit
            ? `Deficit: 14d precip ${precip14d.toFixed(1)} mm, soil moisture ${(soilMoisture * 100).toFixed(0)}%`
            : waterSurplus
              ? `Surplus: 7d precip ${precip7d.toFixed(1)} mm, soil saturation ${(soilMoisture * 100).toFixed(0)}%`
              : `Balance: soil moisture ${(soilMoisture * 100).toFixed(0)}%, 14d precip ${precip14d.toFixed(1)} mm`,
          riskLevel: riskFromScore(waterRiskScore),
          confidenceScore: 0.78,
          captureDate, source: 'Open-Meteo ECMWF',
          message: `Water balance assessment. 3-day precipitation: ${precip3d.toFixed(1)} mm. 7-day: ${precip7d.toFixed(1)} mm. 14-day: ${precip14d.toFixed(1)} mm. Surface soil moisture: ${(soilMoisture * 100).toFixed(0)}%. Subsurface (3 cm): ${(soilMoisture3 * 100).toFixed(0)}%. ET0: ${et07d.toFixed(1)} mm/day. SWOT and Sentinel-1 SAR products needed for confirmed surface water extent.`,
          metrics: {
            '3-day precipitation (mm)':     parseFloat(precip3d.toFixed(1)),
            '7-day precipitation (mm)':     parseFloat(precip7d.toFixed(1)),
            '14-day precipitation (mm)':    parseFloat(precip14d.toFixed(1)),
            'Soil moisture surface (%)':    parseFloat((soilMoisture  * 100).toFixed(1)),
            'Soil moisture 3 cm (%)':       parseFloat((soilMoisture3 * 100).toFixed(1)),
            'ET0 ref (mm/day)':             parseFloat(et07d.toFixed(2)),
          },
        };
        break;
      }

      case 'heat': {
        const heatRisk = recentMaxTemp > 38 ? 0.9 : recentMaxTemp > 32 ? 0.65 : recentMaxTemp > 26 ? 0.35 : 0.1;
        const heatIndex = recentMaxTemp + (soilMoisture < 0.1 ? 2 : 0); // dry surface amplifies felt heat
        result = {
          dataAvailable: true, observationType: type,
          signalStatus: recentMaxTemp > 38 ? 'Extreme heat event' : recentMaxTemp > 32 ? 'High heat conditions' : recentMaxTemp > 26 ? 'Warm — elevated daytime heat' : 'Moderate temperatures',
          primarySignal: `Max ${recentMaxTemp.toFixed(1)}°C · Min ${recentMinTemp.toFixed(1)}°C · Heat index proxy ${heatIndex.toFixed(1)}°C`,
          riskLevel: riskFromScore(heatRisk),
          confidenceScore: 0.85,
          captureDate, source: 'Open-Meteo ECMWF',
          message: `Max temperature 7d avg: ${recentMaxTemp.toFixed(1)}°C. Min: ${recentMinTemp.toFixed(1)}°C. Diurnal swing: ${(recentMaxTemp - recentMinTemp).toFixed(1)}°C. Heat index proxy: ${heatIndex.toFixed(1)}°C (adjusts for dry surface). Sunshine: ${(avgSun / 3600).toFixed(1)} h/day. CAPE: ${cape.toFixed(0)} J/kg. Landsat TIRS or MODIS/ECOSTRESS LST needed for urban heat island surface temperature mapping.`,
          metrics: {
            'Max temperature 7d avg (°C)':  parseFloat(recentMaxTemp.toFixed(1)),
            'Min temperature 7d avg (°C)':  parseFloat(recentMinTemp.toFixed(1)),
            'Diurnal range (°C)':           parseFloat((recentMaxTemp - recentMinTemp).toFixed(1)),
            'Heat index proxy (°C)':        parseFloat(heatIndex.toFixed(1)),
            'Sunshine h/day (7d avg)':      parseFloat((avgSun / 3600).toFixed(1)),
            'Surface soil moisture (%)':    parseFloat((soilMoisture * 100).toFixed(1)),
            'CAPE J/kg':                    parseFloat(cape.toFixed(0)),
          },
        };
        break;
      }

      default: {
        return res.status(400).json({ error: `Unknown observation type: ${type}` });
      }
    }

    console.log(`🛰️  Earth-obs scan [${type}] (${lat},${lng}) riskLevel=${result.riskLevel} conf=${result.confidenceScore}`);
    return res.json(result);

  } catch (err: any) {
    console.error('❌ Earth-observation scan error:', err?.message || err);
    return res.status(500).json({
      dataAvailable: false,
      observationType: type,
      signalStatus: 'Backend error',
      primarySignal: null,
      riskLevel: 'unknown',
      confidenceScore: null,
      captureDate: new Date().toISOString(),
      source: 'Open-Meteo ECMWF',
      message: 'Open-Meteo weather or air-quality endpoint returned an error. Try again in a few seconds.',
      metrics: {},
    });
  }
});

export default router;
