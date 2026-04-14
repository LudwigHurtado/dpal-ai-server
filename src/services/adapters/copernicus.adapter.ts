// TODO: Replace with Copernicus Open Access Hub Sentinel-2 API (https://scihub.copernicus.eu)

export interface CopernicusData {
  soilMoistureIndex: number;       // 0–1
  surfaceWaterLevel: number;       // metres
  waterStorageTrend: number;       // mm/month
  vegetationStress: number;        // 0–1
  droughtRisk: number;             // 0–1
  usageReductionEstimate: number;  // 0–1
  confidenceScore: number;         // 0–1 (higher quality — Sentinel-2)
}

/**
 * Fetch Copernicus Sentinel-2 combined multi-spectral data for a given polygon and
 * time range. Sentinel-2 offers higher resolution imagery than passive microwave
 * sensors, resulting in higher confidence scores. Currently returns mock data pending
 * integration with the Copernicus Open Access Hub API.
 */
export async function fetchCopernicusData(
  _polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<CopernicusData> {
  // Mock: all metrics combined, Sentinel-2 quality → higher confidence (0.82–0.99)
  const soilMoistureIndex = parseFloat((0.3 + Math.random() * 0.5).toFixed(3));
  const surfaceWaterLevel = parseFloat((0.5 + Math.random() * 7.5).toFixed(2));
  const waterStorageTrend = parseFloat((-5 + Math.random() * 15).toFixed(2));
  const vegetationStress = parseFloat((Math.random()).toFixed(3));
  const droughtRisk = parseFloat((Math.random()).toFixed(3));
  const usageReductionEstimate = parseFloat((Math.random()).toFixed(3));
  const confidenceScore = parseFloat((0.82 + Math.random() * 0.17).toFixed(3));

  return {
    soilMoistureIndex,
    surfaceWaterLevel,
    waterStorageTrend,
    vegetationStress,
    droughtRisk,
    usageReductionEstimate,
    confidenceScore,
  };
}
