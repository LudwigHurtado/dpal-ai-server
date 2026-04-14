// TODO: Replace with NASA GRACE-FO Terrestrial Water Storage API

export interface GraceData {
  waterStorageTrend: number;  // mm/month (negative = declining)
  confidenceScore: number;    // 0–1
}

/**
 * Fetch GRACE-FO (Gravity Recovery and Climate Experiment Follow-On) terrestrial
 * water storage trend data for a given polygon and time range. Currently returns
 * mock data pending integration with the NASA GRACE-FO Terrestrial Water Storage API.
 */
export async function fetchGraceData(
  _polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<GraceData> {
  // Mock: water storage trend -5 to +10 mm/month, confidence 0.7–0.95
  const waterStorageTrend = parseFloat((-5 + Math.random() * 15).toFixed(2));
  const confidenceScore = parseFloat((0.7 + Math.random() * 0.25).toFixed(3));

  return { waterStorageTrend, confidenceScore };
}
