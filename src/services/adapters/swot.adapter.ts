// TODO: Replace with NASA SWOT (Surface Water and Ocean Topography) API

export interface SwotData {
  surfaceWaterLevel: number;  // metres
  confidenceScore: number;    // 0–1
}

/**
 * Fetch SWOT (Surface Water and Ocean Topography) surface water level data for a
 * given polygon and time range. Currently returns mock data pending integration
 * with the NASA SWOT mission data products.
 */
export async function fetchSwotData(
  _polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<SwotData> {
  // Mock: surface water level 0.5–8.0 metres, confidence 0.7–0.95
  const surfaceWaterLevel = parseFloat((0.5 + Math.random() * 7.5).toFixed(2));
  const confidenceScore = parseFloat((0.7 + Math.random() * 0.25).toFixed(3));

  return { surfaceWaterLevel, confidenceScore };
}
