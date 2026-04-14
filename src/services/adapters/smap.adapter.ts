// TODO: Replace with NASA Earthdata SMAP API (https://earthdata.nasa.gov/esds/competitive-programs/access/smap)

export interface SmapData {
  soilMoistureIndex: number;  // 0–1
  confidenceScore: number;    // 0–1
}

/**
 * Fetch SMAP (Soil Moisture Active Passive) soil moisture data for a given polygon
 * and time range. Currently returns mock data pending integration with NASA Earthdata.
 */
export async function fetchSmapData(
  _polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<SmapData> {
  // Mock: soil moisture index 0.3–0.8, confidence 0.7–0.95
  const soilMoistureIndex = parseFloat((0.3 + Math.random() * 0.5).toFixed(3));
  const confidenceScore = parseFloat((0.7 + Math.random() * 0.25).toFixed(3));

  return { soilMoistureIndex, confidenceScore };
}
