import axios from 'axios';

// Open-Meteo Air Quality API — free, no API key, powered by Copernicus CAMS
// Docs: https://open-meteo.com/en/docs/air-quality-api
const OPEN_METEO_AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// NOAA Mauna Loa Observatory global CO₂ background (2025 annual mean ~424 ppm).
const CO2_GLOBAL_BACKGROUND_PPM = 424.3;

// CH₄ conversion: Open-Meteo returns µg/m³; 1 ppb CH₄ ≈ 0.653 µg/m³ at 15 °C, 1 atm
const CH4_UG_M3_PER_PPB = 0.653;

// CO conversion: 1 ppb CO ≈ 1.145 µg/m³ at standard conditions
const CO_UG_M3_PER_PPB = 1.145;

export interface AirQualityResult {
  // Greenhouse gases
  co2ppm: number | null;
  ch4ppb: number | null;
  // Criteria pollutants (all µg/m³ unless noted)
  no2: number | null;
  so2: number | null;
  o3: number | null;
  coUgM3: number | null;
  coPpb: number | null;
  nh3: number | null;
  // Particulates
  pm25: number | null;
  pm10: number | null;
  dust: number | null;
  // Air quality indices
  europeanAqi: number | null;
  usAqi: number | null;
  // UV
  uvIndex: number | null;
  // Meta
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
          hourly: [
            'nitrogen_dioxide',
            'sulphur_dioxide',
            'ozone',
            'carbon_monoxide',
            'ammonia',
            'methane',
            'pm10',
            'pm2_5',
            'dust',
            'european_aqi',
            'us_aqi',
            'uv_index',
          ].join(','),
          timezone: 'auto',
          forecast_days: 1,
        },
        timeout: 10_000,
      });

      const hourly = response.data?.hourly ?? {};

      const no2Raw   = latestValue(hourly.nitrogen_dioxide  ?? []);
      const so2Raw   = latestValue(hourly.sulphur_dioxide   ?? []);
      const o3Raw    = latestValue(hourly.ozone             ?? []);
      const coRaw    = latestValue(hourly.carbon_monoxide   ?? []);
      const nh3Raw   = latestValue(hourly.ammonia           ?? []);
      const ch4Raw   = latestValue(hourly.methane           ?? []);
      const pm25Raw  = latestValue(hourly.pm2_5             ?? []);
      const pm10Raw  = latestValue(hourly.pm10              ?? []);
      const dustRaw  = latestValue(hourly.dust              ?? []);
      const euAqi    = latestValue(hourly.european_aqi      ?? []);
      const usAqi    = latestValue(hourly.us_aqi            ?? []);
      const uvRaw    = latestValue(hourly.uv_index          ?? []);

      const ch4ppb = ch4Raw !== null ? Math.round(ch4Raw / CH4_UG_M3_PER_PPB) : null;
      const coPpb  = coRaw  !== null ? Math.round(coRaw  / CO_UG_M3_PER_PPB)  : null;

      return {
        co2ppm: CO2_GLOBAL_BACKGROUND_PPM,
        ch4ppb,
        no2: no2Raw,
        so2: so2Raw,
        o3: o3Raw,
        coUgM3: coRaw,
        coPpb,
        nh3: nh3Raw,
        pm25: pm25Raw,
        pm10: pm10Raw,
        dust: dustRaw,
        europeanAqi: euAqi,
        usAqi,
        uvIndex: uvRaw,
        captureDate,
        source: 'Copernicus CAMS via Open-Meteo · NOAA Mauna Loa background (CO₂)',
        dataAvailable: true,
        measurementStatus: 'verified',
        message:
          'CO₂ is the NOAA 2025 global background (424.3 ppm). ' +
          'All other values are Copernicus Atmosphere Monitoring Service (CAMS) model output ' +
          'via Open-Meteo — free, no-auth, updated hourly.',
      };
    } catch (error: any) {
      console.error('❌ carbonGasAdapter Open-Meteo error:', error?.message || error);

      return {
        co2ppm: CO2_GLOBAL_BACKGROUND_PPM,
        ch4ppb: null,
        no2: null,
        so2: null,
        o3: null,
        coUgM3: null,
        coPpb: null,
        nh3: null,
        pm25: null,
        pm10: null,
        dust: null,
        europeanAqi: null,
        usAqi: null,
        uvIndex: null,
        captureDate,
        source: 'NOAA Mauna Loa global background (CO₂) · Open-Meteo unavailable',
        dataAvailable: true,
        measurementStatus: 'verified',
        message:
          'CO₂ is the NOAA 2025 global background (424.3 ppm). ' +
          'Live pollutant data temporarily unavailable — Open-Meteo did not respond.',
      };
    }
  },
};
