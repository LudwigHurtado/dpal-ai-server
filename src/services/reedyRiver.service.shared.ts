import crypto from "crypto";
import {
  REEDY_RIVER_PROJECT_ID,
  type ReedyRiverActionRecord,
  type ReedyRiverActionStatus,
  type ReedyRiverObservation,
  type ReedyRiverReportRecord,
  type ReedyRiverReviewStatus,
  type ReedyRiverSeverity,
  type ReedyRiverSourceState,
  type ReedyRiverSourceType,
} from "../features/reedyRiver/reedyRiver.types.js";

export const SOURCE_STATES = new Map<
  ReedyRiverSourceType,
  { state: ReedyRiverSourceState; message: string; checkedAt: string }
>();
export const TERMINAL_ACTION_STATUSES = new Set<ReedyRiverActionStatus>(["completed", "dismissed"]);
export const SEVERITY_RANK: Record<ReedyRiverSeverity, number> = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

export const REEDY_RIVER_RUNTIME = { schedulerStarted: false };

export function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export function intEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

export function expectedSources(): ReedyRiverSourceType[] {
  const allowed = new Set<ReedyRiverSourceType>([
    "bioacoustic_sensor",
    "invasive_plant_survey",
    "water_quality_sensor",
    "hydrology_public_api",
    "camera_trap",
    "field_activity",
    "sensor_heartbeat",
    "weather_public_api",
    "other",
  ]);
  const configured = String(process.env.REEDY_RIVER_EXPECTED_SOURCES || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is ReedyRiverSourceType => allowed.has(value as ReedyRiverSourceType));
  return configured.length
    ? [...new Set(configured)]
    : [
        "hydrology_public_api",
        "bioacoustic_sensor",
        "invasive_plant_survey",
        "water_quality_sensor",
        "field_activity",
      ];
}

export function stableId(prefix: string, value: string): string {
  return `${prefix}-${crypto.createHash("sha256").update(value, "utf8").digest("hex").slice(0, 24)}`;
}

export function dateIso(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
  }
  return undefined;
}

export function asPlain(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object") return {};
  const maybe = value as { toObject?: () => Record<string, any> };
  return typeof maybe.toObject === "function"
    ? maybe.toObject()
    : { ...(value as Record<string, any>) };
}

export function mapObservation(value: unknown): ReedyRiverObservation {
  const row = asPlain(value);
  return {
    observationId: String(row.observationId),
    projectId: String(row.projectId),
    idempotencyKey: String(row.idempotencyKey),
    dataMode: "live",
    sourceType: row.sourceType as ReedyRiverSourceType,
    sourceId: String(row.sourceId),
    siteId: String(row.siteId),
    observedAt: dateIso(row.observedAt) || new Date(0).toISOString(),
    receivedAt: dateIso(row.receivedAt) || dateIso(row.createdAt) || new Date(0).toISOString(),
    kind: String(row.kind),
    reviewStatus: row.reviewStatus as ReedyRiverReviewStatus,
    confidence: typeof row.confidence === "number" ? row.confidence : undefined,
    taxon: row.taxon || undefined,
    data: row.data || {},
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    location: row.location || { publicLabel: "Restricted Reedy River monitoring zone" },
    provenance: row.provenance || { provider: "Unknown", method: "Unknown" },
    createdAt: dateIso(row.createdAt),
    updatedAt: dateIso(row.updatedAt),
  };
}

export function publicAlias(prefix: string, value: unknown): string {
  const raw = String(value || "unknown");
  return stableId(prefix, `${REEDY_RIVER_PROJECT_ID}|${raw}`).slice(0, prefix.length + 1 + 12);
}

export function mapReport(value: unknown, publicSafe = true): ReedyRiverReportRecord {
  const row = asPlain(value);
  return {
    reportId: String(row.reportId),
    projectId: String(row.projectId),
    windowStart: dateIso(row.windowStart) || new Date(0).toISOString(),
    windowEnd: dateIso(row.windowEnd) || new Date(0).toISOString(),
    generatedAt: dateIso(row.generatedAt) || new Date(0).toISOString(),
    status: row.status,
    dataPolicy: "live_only",
    metrics: row.metrics || {},
    sourceStatus: Array.isArray(row.sourceStatus)
      ? row.sourceStatus.map((source: any) => ({
          ...source,
          sourceUrl: publicSafe ? undefined : source.sourceUrl,
        }))
      : [],
    findings: Array.isArray(row.findings)
      ? row.findings.map((finding: any) => ({
          ...finding,
          siteIds: publicSafe && Array.isArray(finding.siteIds)
            ? finding.siteIds.map((siteId: unknown) => publicAlias("zone", siteId))
            : finding.siteIds || [],
        }))
      : [],
    actionDrafts: [],
    actionIds: Array.isArray(row.actionIds) ? row.actionIds.map(String) : [],
    projectRecommendations: Array.isArray(row.projectRecommendations) ? row.projectRecommendations : [],
    deterministicSummary: String(row.deterministicSummary || ""),
    aiNarrative: row.aiNarrative,
    caveats: Array.isArray(row.caveats) ? row.caveats.map(String) : [],
    createdAt: dateIso(row.createdAt),
    updatedAt: dateIso(row.updatedAt),
  };
}

export function mapAction(value: unknown, publicSafe = true): ReedyRiverActionRecord {
  const row = asPlain(value);
  return {
    actionId: String(row.actionId),
    projectId: String(row.projectId),
    fingerprint: String(row.fingerprint),
    category: row.category,
    priority: row.priority,
    title: String(row.title),
    rationale: String(row.rationale),
    steps: Array.isArray(row.steps) ? row.steps.map(String) : [],
    ownerRole: String(row.ownerRole),
    assignedTo: publicSafe ? undefined : row.assignedTo ? String(row.assignedTo) : undefined,
    assignedToLabel: publicSafe ? undefined : row.assignedToLabel ? String(row.assignedToLabel) : undefined,
    dueAt: dateIso(row.dueAt) || new Date(0).toISOString(),
    evidenceObservationIds: Array.isArray(row.evidenceObservationIds)
      ? row.evidenceObservationIds.map(String)
      : [],
    dependsOn: Array.isArray(row.dependsOn) ? row.dependsOn.map(String) : [],
    approvalRequired: Boolean(row.approvalRequired),
    safeToExecute: Boolean(row.safeToExecute),
    recommendedInitialStatus: row.status,
    status: row.status,
    nextStep: String(row.nextStep || ""),
    sourceReportIds: Array.isArray(row.sourceReportIds) ? row.sourceReportIds.map(String) : [],
    history: publicSafe
      ? []
      : Array.isArray(row.history)
        ? row.history.map((item: any) => ({
            ...item,
            at: dateIso(item.at) || new Date(0).toISOString(),
          }))
        : [],
    resolutionNote: row.resolutionNote ? String(row.resolutionNote) : undefined,
    createdAt: dateIso(row.createdAt),
    updatedAt: dateIso(row.updatedAt),
  };
}

export function publicData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicData);
  if (!value || typeof value !== "object") return value;
  const blocked = /(^|_)(lat|latitude|lon|lng|longitude|gps|coordinate|coordinates|uri|url|path|token|secret|email|phone|observer|collectedby)($|_)/i;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (blocked.test(key)) continue;
    out[key] = publicData(child);
  }
  return out;
}

export function sanitizePublicReedyRiverObservation(observation: ReedyRiverObservation): ReedyRiverObservation {
  return {
    ...observation,
    idempotencyKey: "redacted",
    sourceId: publicAlias("source", observation.sourceId),
    siteId: publicAlias("zone", observation.siteId),
    evidence: (observation.evidence || []).map((item) => ({
      sha256: item.sha256,
      mimeType: item.mimeType,
      capturedAt: item.capturedAt,
      restricted: item.restricted !== false,
      uri: item.restricted === false ? item.uri : undefined,
    })),
    location: {
      publicLabel: observation.location.publicLabel,
      precisionMeters: observation.location.precisionMeters,
    },
    provenance: {
      provider: observation.provenance.provider,
      method: observation.provenance.method,
      deviceModel: observation.provenance.deviceModel,
      modelName: observation.provenance.modelName,
      modelVersion: observation.provenance.modelVersion,
      sourceUrl: undefined,
      license: observation.provenance.license,
      retrievedAt: observation.provenance.retrievedAt,
    },
    data: publicData(observation.data) as Record<string, unknown>,
  };
}
