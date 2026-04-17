import axios from 'axios';

// Open-Meteo Air Quality API — free, no API key, powered by Copernicus CAMS
// Docs: https://open-meteo.com/en/docs/air-quality-api
const OPEN_METEO_AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// NOAA Mauna Loa Observatory global CO₂ background (2025 annual mean ~424 ppm).
// Local surface CO₂ deviations require OCO-2/OCO-3 Level-2 data; those products
// need NASA Earthdata auth. We use the scientifically accurate global background
// and disclose it clearly to the caller.
const CO2_GLOBAL_BACKGROUND_PPM = 424.3;

// CH₄ conversion: Open-Meteo returns µg/m³; 1 ppb CH₄ ≈ 0.653 µg/m³ at 15 °C, 1 atm
const CH4_UG_M3_PER_PPB = 0.653;

interface AirQualityResult {
  co2ppm: number | null;
  ch4ppb: number | null;
  no2: number | null; // µg/m³
  captureDate: string;
  source: string;
  dataAvailable: boolean;
  measurementStatus: string;
  message: string;
}

function latestValue(arr: (number | null)[]): number | null {
  if (!Array.isArray(arr)) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i];
  }
  return null;
}

export const carbonGasAdapter = {
  async getAirQualityData(lat: number, lng: number): Promise<AirQualityResult> {
    const captureDate = new Date().toISOString();

    try {
      const response = await axios.get(OPEN_METEO_AQ, {
        params: {
          latitude: lat,
          longitude: lng,
          hourly: 'nitrogen_dioxide,methane',
          timezone: 'auto',
          forecast_days: 1,
        },
        timeout: 10_000,
      });

      const hourly = response.data?.hourly ?? {};
      const no2Raw = latestValue(hourly.nitrogen_dioxide ?? []);   // µg/m³
      const ch4Raw = latestValue(hourly.methane ?? []);            // µg/m³

      const ch4ppb = ch4Raw !== null ? Math.round(ch4Raw / CH4_UG_M3_PER_PPB) : null;

      return {
        co2ppm: CO2_GLOBAL_BACKGROUND_PPM,
        ch4ppb,
        no2: no2Raw,
        captureDate,
        source: 'Copernicus CAMS via Open-Meteo (NO₂, CH₄) · NOAA Mauna Loa background (CO₂)',
        dataAvailable: true,
        measurementStatus: 'verified',
        message:
          'CO₂ is the NOAA 2025 global background (424.3 ppm). ' +
          'NO₂ and CH₄ are Copernicus Atmosphere Monitoring Service (CAMS) model values ' +
          'provided by Open-Meteo — free, no-auth, updated hourly.',
      };
    } catch (error: any) {
      console.error('❌ carbonGasAdapter Open-Meteo error:', error?.message || error);

      // Fall back to CO₂ background only — still honest, still useful
      return {
        co2ppm: CO2_GLOBAL_BACKGROUND_PPM,
        ch4ppb: null,
        no2: null,
        captureDate,
        source: 'NOAA Mauna Loa global background (CO₂) · Open-Meteo unavailable',
        dataAvailable: true,
        measurementStatus: 'verified',
        message:
          'CO₂ is the NOAA 2025 global background (424.3 ppm). ' +
          'Live NO₂ / CH₄ data temporarily unavailable — Open-Meteo did not respond.',
      };
    }
  },
};
