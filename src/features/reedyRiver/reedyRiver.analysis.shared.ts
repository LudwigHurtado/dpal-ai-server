import {
  REEDY_RIVER_PROJECT_ID,
  REEDY_RIVER_REPORT_INTERVAL_MS,
  type ReedyRiverActionDraft,
  type ReedyRiverFinding,
  type ReedyRiverObservation,
  type ReedyRiverProjectRecommendation,
  type ReedyRiverReportDraft,
  type ReedyRiverSeverity,
  type ReedyRiverSourceStatus,
  type ReedyRiverSourceType,
} from "./reedyRiver.types.js";

export const SOURCE_LABELS: Record<ReedyRiverSourceType, string> = {
  bioacoustic_sensor: "Bioacoustic sensors",
  invasive_plant_survey: "Invasive plant surveys",
  water_quality_sensor: "Water-quality sensors",
  hydrology_public_api: "USGS hydrology",
  camera_trap: "Camera traps",
  field_activity: "Field activity reports",
  sensor_heartbeat: "Sensor health",
  weather_public_api: "Weather context",
  other: "Other live evidence",
};

export const DEFAULT_EXPECTED_SOURCES: ReedyRiverSourceType[] = [
  "hydrology_public_api",
  "bioacoustic_sensor",
  "invasive_plant_survey",
  "water_quality_sensor",
  "field_activity",
];

export const SEVERITY_RANK: Record<ReedyRiverSeverity, number> = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

export interface AnalyzeReedyRiverInput {
  observations: ReedyRiverObservation[];
  windowStart: Date;
  windowEnd: Date;
  now?: Date;
  expectedSources?: ReedyRiverSourceType[];
  unavailableSources?: Partial<Record<ReedyRiverSourceType, string>>;
  staleAfterMinutes?: number;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function findingId(category: string, key: string): string {
  return `rrf-${category}-${stableHash(`${category}:${key}`)}`;
}

export function actionFingerprint(category: string, key: string, siteIds: string[]): string {
  return `${category}:${stableHash(`${key}:${[...siteIds].sort().join(",")}`)}`;
}

export function recommendationId(type: string, key: string): string {
  return `rrp-${type}-${stableHash(`${type}:${key}`)}`;
}

export function safeDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function taxonKey(observation: ReedyRiverObservation): string {
  return (
    observation.taxon?.scientificName?.trim().toLowerCase() ||
    observation.taxon?.commonName?.trim().toLowerCase() ||
    text(observation.data.species).toLowerCase() ||
    text(observation.data.taxon).toLowerCase() ||
    "unidentified"
  );
}

export function taxonLabel(observation: ReedyRiverObservation): string {
  return (
    observation.taxon?.scientificName?.trim() ||
    observation.taxon?.commonName?.trim() ||
    text(observation.data.species) ||
    text(observation.data.taxon) ||
    "Unidentified taxon"
  );
}

export function evidenceCount(observation: ReedyRiverObservation): number {
  return (observation.evidence ?? []).filter((item) => Boolean(item.sha256 || item.uri)).length;
}

export function distinctEvidenceObservers(observations: ReedyRiverObservation[]): number {
  return new Set(
    observations.map((observation) => observation.provenance.collectedBy || observation.sourceId),
  ).size;
}

export function highestSeverity(values: ReedyRiverSeverity[]): ReedyRiverSeverity {
  return values.reduce<ReedyRiverSeverity>(
    (highest, value) => (SEVERITY_RANK[value] > SEVERITY_RANK[highest] ? value : highest),
    "info",
  );
}

export function alignToThreeHourWindow(date: Date): Date {
  const milliseconds = date.getTime();
  return new Date(Math.floor(milliseconds / REEDY_RIVER_REPORT_INTERVAL_MS) * REEDY_RIVER_REPORT_INTERVAL_MS);
}

export function lastCompletedThreeHourWindow(now = new Date()): { windowStart: Date; windowEnd: Date } {
  const windowEnd = alignToThreeHourWindow(now);
  return {
    windowStart: new Date(windowEnd.getTime() - REEDY_RIVER_REPORT_INTERVAL_MS),
    windowEnd,
  };
}

export function buildSourceStatus(
  observations: ReedyRiverObservation[],
  expectedSources: ReedyRiverSourceType[],
  unavailableSources: Partial<Record<ReedyRiverSourceType, string>>,
  now: Date,
  staleAfterMinutes: number,
): ReedyRiverSourceStatus[] {
  const sourceTypes = unique<ReedyRiverSourceType>([
    ...expectedSources,
    ...observations.map((observation) => observation.sourceType),
    ...(Object.keys(unavailableSources) as ReedyRiverSourceType[]),
  ]);

  return sourceTypes.map((sourceType) => {
    const rows = observations
      .filter((observation) => observation.sourceType === sourceType)
      .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
    const latest = rows[0];
    const latestDate = latest ? safeDate(latest.observedAt) : null;
    const freshnessMinutes = latestDate
      ? Math.max(0, Math.round((now.getTime() - latestDate.getTime()) / 60_000))
      : undefined;
    const unavailableMessage = unavailableSources[sourceType];

    if (unavailableMessage) {
      return {
        sourceType,
        label: SOURCE_LABELS[sourceType],
        state: "unavailable",
        recordCount: rows.length,
        latestObservedAt: latest?.observedAt,
        freshnessMinutes,
        message: unavailableMessage,
        provider: latest?.provenance.provider,
        sourceUrl: latest?.provenance.sourceUrl,
      };
    }

    if (!latest || !latestDate) {
      return {
        sourceType,
        label: SOURCE_LABELS[sourceType],
        state: "not_connected",
        recordCount: 0,
        message: "No live records received for this reporting window.",
      };
    }

    const stale = (freshnessMinutes ?? Number.POSITIVE_INFINITY) > staleAfterMinutes;
    return {
      sourceType,
      label: SOURCE_LABELS[sourceType],
      state: stale ? "stale" : "live",
      recordCount: rows.length,
      latestObservedAt: latest.observedAt,
      freshnessMinutes,
      message: stale
        ? `Latest record is ${freshnessMinutes} minutes old; verify connectivity before acting.`
        : `Receiving live evidence from ${latest.provenance.provider}.`,
      provider: latest.provenance.provider,
      sourceUrl: latest.provenance.sourceUrl,
    };
  });
}
