// TODO: Replace with NASA GIBS (Global Imagery Browse Services) WMS/WMTS API

export interface GibsData {
  vegetationStress: number;  // 0–1
  droughtRisk: number;       // 0–1
  imageUrl: string;
  confidenceScore: number;   // 0–1
}

/**
 * Fetch NASA GIBS (Global Imagery Browse Services) vegetation stress and drought risk
 * data for a given polygon and time range. Currently returns mock data pending
 * integration with the NASA GIBS WMS/WMTS API.
 */
export async function fetchGibsData(
  _polygon: { lat: number; lng: number }[],
  _baselineDate: string,
  _targetDate: string
): Promise<GibsData> {
  // Mock: vegetationStress 0–1, droughtRisk 0–1, confidence 0.7–0.95
  const vegetationStress = parseFloat((Math.random()).toFixed(3));
  const droughtRisk = parseFloat((Math.random()).toFixed(3));
  const confidenceScore = parseFloat((0.7 + Math.random() * 0.25).toFixed(3));
  const imageUrl = "https://gibs.earthdata.nasa.gov/placeholder-imagery.png";

  return { vegetationStress, droughtRisk, imageUrl, confidenceScore };
}
