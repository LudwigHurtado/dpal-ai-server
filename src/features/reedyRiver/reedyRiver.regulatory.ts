/**
 * Regulatory reference extracted from SCDES Technical Document 011-2023.
 *
 * This module deliberately contains no live status and no deployment coordinates.
 * Historic TMDL values are regulatory reference data, not current compliance results.
 */

export type ReedyRiverFlowClass = "high" | "moist" | "mid_range" | "dry" | "low";

export interface ReedyRiverTmdlStationEntry {
  order: number;
  entryId: string;
  stationIds: string[];
  description: string;
  calculationPointId: "S-319" | "S-072" | "RS-19501/RS-20501" | "S-021";
  role: "calculation_point" | "associated_monitoring_station" | "in_pond_reference";
  coordinateStatus: "official_metadata_not_connected";
}

export interface ReedyRiverTmdlCalculationPoint {
  calculationPointId: ReedyRiverTmdlStationEntry["calculationPointId"];
  stationIds: string[];
  drainageAreaSquareMiles: number;
  developedLandPercent: number;
  imperviousCoverPercent: number;
  historicalSamplePeriod: string;
  historicalSamples: number;
  historicalExceedances: number;
  historicalExceedancePercent: number;
  rainfallEcoliPearsonR: number;
  existingLoadCfuPerDay: string;
  tmdlCfuPerDay: string;
  marginOfSafetyCfuPerDay: string;
  continuousWasteloadAllocations: Array<{ permittee: string; npdesId?: string; cfuPerDay: string }>;
  ms4AndScdotPercentReduction: number;
  loadAllocationCfuPerDay: string;
  overallPercentReduction: number;
  flowCategoryPercentReduction: Record<ReedyRiverFlowClass, number | "NRN">;
}

export const REEDY_RIVER_TMDL_REFERENCE = {
  projectId: "reedy-river-sc",
  dataClass: "regulatory_reference" as const,
  currentComplianceStatus: "not_computed" as const,
  document: {
    agency: "South Carolina Department of Health and Environmental Control (now SCDES)",
    title: "Total Maximum Daily Load for Escherichia coli for Reedy River and Tributaries",
    technicalDocument: "011-2023",
    approvalDate: "2023-12-26",
    officialApprovedTmdlPage:
      "https://des.sc.gov/programs/bureau-water/south-carolina-303d-list-impaired-waters-tmdls/approved-tmdls",
  },
  waterQualityStandard: {
    organism: "Escherichia coli",
    unit: "CFU/100 mL",
    geometricMean: {
      value: 126,
      samplingBasis: "At least four samples collected over a 30-day period",
    },
    singleSample: {
      value: 349,
      exceedanceRule: "No more than 10 percent of samples may exceed this value",
    },
    tmdlCalculationBasis:
      "The TMDL used the single-sample maximum because the available monitoring record was not sufficient to calculate a 30-day geometric mean at the calculation points.",
  },
  stationCountMethod:
    "Nineteen monitoring entries are listed upstream to downstream. The co-located RS-19501 and RS-20501 calculation point is one monitoring entry with two station identifiers.",
  coordinatePolicy:
    "No latitude or longitude is published by this API until official SCDES station metadata is connected. Location descriptions are regulatory reference text and must not be used as deployment coordinates.",
  monitoringEntries: [
    { order: 1, entryId: "S-073", stationIds: ["S-073"], description: "Reedy River at unnamed road off US 276, 0.75 mile west of Travelers Rest", calculationPointId: "S-319", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 2, entryId: "S-264", stationIds: ["S-264"], description: "Langston Creek at SC 253", calculationPointId: "S-319", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 3, entryId: "S-319", stationIds: ["S-319"], description: "Reedy River at Rivers Street in Greenville", calculationPointId: "S-319", role: "calculation_point", coordinateStatus: "official_metadata_not_connected" },
    { order: 4, entryId: "RS-14189", stationIds: ["RS-14189"], description: "Richland Creek at Spartanburg Street", calculationPointId: "S-072", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 5, entryId: "S-013", stationIds: ["S-013"], description: "Reedy River at S-23-30, 3.9 miles southeast of Greenville", calculationPointId: "S-072", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 6, entryId: "S-067", stationIds: ["S-067"], description: "Brushy Creek on Green Street", calculationPointId: "S-072", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 7, entryId: "S-018", stationIds: ["S-018"], description: "Reedy River at S-23-448, 1.75 miles southeast of Conestee", calculationPointId: "S-072", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 8, entryId: "RS-06167", stationIds: ["RS-06167"], description: "Unnamed tributary to the Reedy River in The Preserve at Planters Row", calculationPointId: "S-072", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 9, entryId: "S-323", stationIds: ["S-323"], description: "Reedy River at S-23-316, 3.5 miles south-southwest of Mauldin", calculationPointId: "S-072", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 10, entryId: "RS-15285", stationIds: ["RS-15285"], description: "Rocky Creek at Alder Drive", calculationPointId: "S-072", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 11, entryId: "S-091", stationIds: ["S-091"], description: "Rocky Creek at S-23-453, 3.5 miles southwest of Simpsonville", calculationPointId: "S-072", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 12, entryId: "S-072", stationIds: ["S-072"], description: "Reedy River on SC Highway 418 at Fork Shoals", calculationPointId: "S-072", role: "calculation_point", coordinateStatus: "official_metadata_not_connected" },
    { order: 13, entryId: "RS-17381/S-863", stationIds: ["RS-17381", "S-863"], description: "Huff Creek at State Road 459", calculationPointId: "RS-19501/RS-20501", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 14, entryId: "S-178", stationIds: ["S-178"], description: "Huff Creek at SC 418, 1.6 miles northwest of Fork Shoals", calculationPointId: "RS-19501/RS-20501", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 15, entryId: "RS-19501/RS-20501", stationIds: ["RS-19501", "RS-20501"], description: "Reedy River at Hillside Church Road; co-located stations", calculationPointId: "RS-19501/RS-20501", role: "calculation_point", coordinateStatus: "official_metadata_not_connected" },
    { order: 16, entryId: "RS-17370/S-778", stationIds: ["RS-17370", "S-778"], description: "Reedy River at Secondary Road 68", calculationPointId: "S-021", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 17, entryId: "S-070", stationIds: ["S-070"], description: "Reedy River at US 76", calculationPointId: "S-021", role: "associated_monitoring_station", coordinateStatus: "official_metadata_not_connected" },
    { order: 18, entryId: "S-311", stationIds: ["S-311"], description: "Boyd Mill Pond", calculationPointId: "S-021", role: "in_pond_reference", coordinateStatus: "official_metadata_not_connected" },
    { order: 19, entryId: "S-021", stationIds: ["S-021"], description: "Reedy River at S-30-06 east of Ware Shoals", calculationPointId: "S-021", role: "calculation_point", coordinateStatus: "official_metadata_not_connected" },
  ] satisfies ReedyRiverTmdlStationEntry[],
  calculationPoints: [
    {
      calculationPointId: "S-319",
      stationIds: ["S-319"],
      drainageAreaSquareMiles: 32.15,
      developedLandPercent: 62.23,
      imperviousCoverPercent: 21,
      historicalSamplePeriod: "2013-2022",
      historicalSamples: 93,
      historicalExceedances: 55,
      historicalExceedancePercent: 59.8,
      rainfallEcoliPearsonR: 0.5,
      existingLoadCfuPerDay: "2.84E+12",
      tmdlCfuPerDay: "4.89E+11",
      marginOfSafetyCfuPerDay: "2.38E+10",
      continuousWasteloadAllocations: [
        { permittee: "Altamont Mobile Home Park", npdesId: "SC0028533", cfuPerDay: "1.79E+08" },
      ],
      ms4AndScdotPercentReduction: 84,
      loadAllocationCfuPerDay: "4.65E+11",
      overallPercentReduction: 84,
      flowCategoryPercentReduction: { high: 84, moist: 84, mid_range: 48, dry: 65, low: 51 },
    },
    {
      calculationPointId: "S-072",
      stationIds: ["S-072"],
      drainageAreaSquareMiles: 77.66,
      developedLandPercent: 68.36,
      imperviousCoverPercent: 27,
      historicalSamplePeriod: "2013-2022",
      historicalSamples: 96,
      historicalExceedances: 25,
      historicalExceedancePercent: 26.3,
      rainfallEcoliPearsonR: 0.76,
      existingLoadCfuPerDay: "9.65E+12",
      tmdlCfuPerDay: "1.96E+12",
      marginOfSafetyCfuPerDay: "9.82E+10",
      continuousWasteloadAllocations: [
        { permittee: "ReWa Lower Reedy", npdesId: "SC0024261", cfuPerDay: "1.52E+11" },
        { permittee: "ReWa Mauldin Road", npdesId: "SC0041211", cfuPerDay: "3.84E+11" },
      ],
      ms4AndScdotPercentReduction: 81,
      loadAllocationCfuPerDay: "1.33E+12",
      overallPercentReduction: 81,
      flowCategoryPercentReduction: { high: 93, moist: 81, mid_range: 25, dry: 23, low: "NRN" },
    },
    {
      calculationPointId: "RS-19501/RS-20501",
      stationIds: ["RS-19501", "RS-20501"],
      drainageAreaSquareMiles: 53.12,
      developedLandPercent: 20.54,
      imperviousCoverPercent: 6,
      historicalSamplePeriod: "2019-2020",
      historicalSamples: 24,
      historicalExceedances: 8,
      historicalExceedancePercent: 33.3,
      rainfallEcoliPearsonR: 0.72,
      existingLoadCfuPerDay: "9.12E+12",
      tmdlCfuPerDay: "1.40E+12",
      marginOfSafetyCfuPerDay: "7.01E+10",
      continuousWasteloadAllocations: [
        { permittee: "United Utilities Canterbury Subdivision", npdesId: "SC0028941", cfuPerDay: "1.06E+09" },
        { permittee: "United Utilities Trollingwood Subdivision", npdesId: "SC0026611", cfuPerDay: "1.32E+09" },
      ],
      ms4AndScdotPercentReduction: 85,
      loadAllocationCfuPerDay: "1.33E+12",
      overallPercentReduction: 85,
      flowCategoryPercentReduction: { high: 94, moist: 37, mid_range: 85, dry: 33, low: 84 },
    },
    {
      calculationPointId: "S-021",
      stationIds: ["S-021"],
      drainageAreaSquareMiles: 88.25,
      developedLandPercent: 7.68,
      imperviousCoverPercent: 1,
      historicalSamplePeriod: "2013-2022",
      historicalSamples: 86,
      historicalExceedances: 14,
      historicalExceedancePercent: 16.3,
      rainfallEcoliPearsonR: 0.38,
      existingLoadCfuPerDay: "4.08E+12",
      tmdlCfuPerDay: "3.30E+12",
      marginOfSafetyCfuPerDay: "1.65E+11",
      continuousWasteloadAllocations: [],
      ms4AndScdotPercentReduction: 23,
      loadAllocationCfuPerDay: "3.13E+12",
      overallPercentReduction: 23,
      flowCategoryPercentReduction: { high: 84, moist: 23, mid_range: "NRN", dry: "NRN", low: 19 },
    },
  ] satisfies ReedyRiverTmdlCalculationPoint[],
  interpretationRules: [
    "Historic exceedance percentages and TMDL reductions are not a current safe-to-swim or compliance status.",
    "USGS discharge and gage height are hydrology context and do not measure E. coli.",
    "Dry-weather and wet-weather patterns support investigation planning; they do not identify a source by themselves.",
    "Volunteer or sensor records become regulatory-use evidence only after method, calibration, QA/QAPP, laboratory, and authority requirements are met.",
  ],
} as const;

const STATION_LOOKUP = new Map<string, ReedyRiverTmdlStationEntry>();
for (const entry of REEDY_RIVER_TMDL_REFERENCE.monitoringEntries) {
  STATION_LOOKUP.set(entry.entryId.toUpperCase(), entry);
  for (const stationId of entry.stationIds) STATION_LOOKUP.set(stationId.toUpperCase(), entry);
}

export function findReedyRiverTmdlStation(value: string): ReedyRiverTmdlStationEntry | undefined {
  return STATION_LOOKUP.get(String(value || "").trim().toUpperCase());
}
