import crypto from "crypto";
import {
  REEDY_RIVER_PROJECT_ID,
  type ReedyRiverObservationInput,
  type ReedyRiverReviewStatus,
  type ReedyRiverSourceType,
} from "./reedyRiver.types.js";
import { assertLiveOnlyPayload } from "./reedyRiver.security.js";

const FUTURE_CLOCK_SKEW_MS = 10 * 60 * 1000;

function hash(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function iso(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be an ISO-8601 string`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${field} is not a valid date`);
  if (date.getTime() > Date.now() + FUTURE_CLOCK_SKEW_MS) {
    throw new Error(`${field} is too far in the future`);
  }
  return date.toISOString();
}

function bounded(value: unknown, min: number, max: number, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return number;
}

function nonEmpty(value: unknown, field: string, max = 300): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim().slice(0, max);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function normalizeSourceType(value: unknown): ReedyRiverSourceType {
  const allowed: ReedyRiverSourceType[] = [
    "bioacoustic_sensor",
    "invasive_plant_survey",
    "water_quality_sensor",
    "hydrology_public_api",
    "camera_trap",
    "field_activity",
    "sensor_heartbeat",
    "weather_public_api",
    "other",
  ];
  if (typeof value === "string" && allowed.includes(value as ReedyRiverSourceType)) {
    return value as ReedyRiverSourceType;
  }
  throw new Error("sourceType is not supported");
}

function normalizeReviewStatus(value: unknown): ReedyRiverReviewStatus {
  const allowed: ReedyRiverReviewStatus[] = [
    "machine_candidate",
    "field_observed",
    "qa_pending",
    "qa_passed",
    "expert_confirmed",
    "rejected",
  ];
  if (typeof value === "string" && allowed.includes(value as ReedyRiverReviewStatus)) {
    return value as ReedyRiverReviewStatus;
  }
  throw new Error("reviewStatus is not supported");
}

function normalizeEvidence(value: unknown): ReedyRiverObservationInput["evidence"] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 25).map((raw, index) => {
    const row = object(raw);
    const sha256 = typeof row.sha256 === "string" ? row.sha256.trim().toLowerCase() : undefined;
    if (sha256 && !/^[a-f0-9]{64}$/.test(sha256)) {
      throw new Error(`evidence[${index}].sha256 must be a 64-character SHA-256 hex digest`);
    }
    return {
      uri: typeof row.uri === "string" ? row.uri.trim().slice(0, 2000) : undefined,
      sha256,
      mimeType: typeof row.mimeType === "string" ? row.mimeType.trim().slice(0, 200) : undefined,
      capturedAt: row.capturedAt ? iso(row.capturedAt, `evidence[${index}].capturedAt`) : undefined,
      restricted: row.restricted !== false,
    };
  });
}

export function normalizeNativeReedyRiverObservation(
  raw: Record<string, unknown>,
  principalSourceId: string,
): ReedyRiverObservationInput {
  const provenance = object(raw.provenance);
  assertLiveOnlyPayload({
    dataMode: raw.dataMode,
    sourceId: raw.sourceId,
    provenance,
    flags: object(raw.flags),
  });
  const sourceId = nonEmpty(raw.sourceId, "sourceId", 160);
  if (sourceId !== principalSourceId) {
    throw new Error("Payload sourceId must match X-DPAL-Source-Id");
  }
  const location = object(raw.location);
  const taxon = object(raw.taxon);
  const confidence = bounded(raw.confidence, 0, 1, "confidence");
  const latitude = bounded(location.latitude, -90, 90, "location.latitude");
  const longitude = bounded(location.longitude, -180, 180, "location.longitude");
  const precisionMeters = bounded(location.precisionMeters, 0, 1_000_000, "location.precisionMeters");

  return {
    observationId: typeof raw.observationId === "string" ? raw.observationId.trim().slice(0, 200) : undefined,
    projectId: REEDY_RIVER_PROJECT_ID,
    idempotencyKey: nonEmpty(raw.idempotencyKey, "idempotencyKey", 300),
    dataMode: "live",
    sourceType: normalizeSourceType(raw.sourceType),
    sourceId,
    siteId: nonEmpty(raw.siteId, "siteId", 200),
    observedAt: iso(raw.observedAt, "observedAt"),
    kind: nonEmpty(raw.kind, "kind", 200),
    reviewStatus: normalizeReviewStatus(raw.reviewStatus),
    confidence,
    taxon: Object.keys(taxon).length
      ? {
          commonName: typeof taxon.commonName === "string" ? taxon.commonName.trim().slice(0, 240) : undefined,
          scientificName: typeof taxon.scientificName === "string" ? taxon.scientificName.trim().slice(0, 240) : undefined,
          taxonId: typeof taxon.taxonId === "string" ? taxon.taxonId.trim().slice(0, 240) : undefined,
          invasiveStatus:
            typeof taxon.invasiveStatus === "string" &&
            ["watchlist", "regulated", "suspected", "not_applicable"].includes(taxon.invasiveStatus)
              ? (taxon.invasiveStatus as "watchlist" | "regulated" | "suspected" | "not_applicable")
              : undefined,
        }
      : undefined,
    data: object(raw.data),
    evidence: normalizeEvidence(raw.evidence),
    location: {
      publicLabel: nonEmpty(location.publicLabel, "location.publicLabel", 300),
      latitude,
      longitude,
      precisionMeters,
    },
    provenance: {
      provider: nonEmpty(provenance.provider, "provenance.provider", 300),
      method: nonEmpty(provenance.method, "provenance.method", 500),
      collectedBy: typeof provenance.collectedBy === "string" ? provenance.collectedBy.trim().slice(0, 300) : undefined,
      deviceModel: typeof provenance.deviceModel === "string" ? provenance.deviceModel.trim().slice(0, 300) : undefined,
      modelName: typeof provenance.modelName === "string" ? provenance.modelName.trim().slice(0, 300) : undefined,
      modelVersion: typeof provenance.modelVersion === "string" ? provenance.modelVersion.trim().slice(0, 300) : undefined,
      sourceUrl: typeof provenance.sourceUrl === "string" ? provenance.sourceUrl.trim().slice(0, 2000) : undefined,
      license: typeof provenance.license === "string" ? provenance.license.trim().slice(0, 300) : undefined,
      retrievedAt: provenance.retrievedAt ? iso(provenance.retrievedAt, "provenance.retrievedAt") : undefined,
    },
  };
}

export interface BirdNetDetectionInput {
  detectionId?: string;
  observedAt: string;
  confidence: number;
  commonName?: string;
  scientificName?: string;
  taxonId?: string;
  startSeconds?: number;
  endSeconds?: number;
  frequencyHz?: number;
  audioUri?: string;
  audioSha256?: string;
  notes?: string;
}

export interface BirdNetBatchInput {
  dataMode: "live";
  sourceId: string;
  siteId: string;
  location: {
    publicLabel: string;
    latitude?: number;
    longitude?: number;
    precisionMeters?: number;
  };
  provenance: {
    provider?: string;
    method?: string;
    deviceModel?: string;
    modelName?: string;
    modelVersion?: string;
    sourceUrl?: string;
    license?: string;
  };
  detections: BirdNetDetectionInput[];
}

export function mapBirdNetBatch(
  batch: BirdNetBatchInput,
  principalSourceId: string,
): ReedyRiverObservationInput[] {
  assertLiveOnlyPayload({ dataMode: batch.dataMode, sourceId: batch.sourceId, provenance: batch.provenance });
  if (batch.sourceId !== principalSourceId) throw new Error("Payload sourceId must match X-DPAL-Source-Id");
  if (!Array.isArray(batch.detections) || batch.detections.length === 0) {
    throw new Error("detections must contain at least one BirdNET result");
  }
  if (batch.detections.length > 500) throw new Error("A BirdNET batch may contain at most 500 detections");

  return batch.detections.map((detection, index) => {
    const observedAt = iso(detection.observedAt, `detections[${index}].observedAt`);
    const confidence = bounded(detection.confidence, 0, 1, `detections[${index}].confidence`);
    if (confidence === undefined) throw new Error(`detections[${index}].confidence is required`);
    const scientificName = detection.scientificName?.trim().slice(0, 240);
    const commonName = detection.commonName?.trim().slice(0, 240);
    const key =
      detection.detectionId?.trim() ||
      hash(`${batch.sourceId}|${batch.siteId}|${observedAt}|${scientificName || commonName || "unknown"}|${detection.startSeconds ?? ""}`);
    const evidence = detection.audioUri || detection.audioSha256
      ? [
          {
            uri: detection.audioUri?.trim().slice(0, 2000),
            sha256: detection.audioSha256?.trim().toLowerCase(),
            mimeType: "audio/*",
            capturedAt: observedAt,
            restricted: true,
          },
        ]
      : [];
    if (evidence[0]?.sha256 && !/^[a-f0-9]{64}$/.test(evidence[0].sha256)) {
      throw new Error(`detections[${index}].audioSha256 must be a SHA-256 hex digest`);
    }

    return normalizeNativeReedyRiverObservation(
      {
        idempotencyKey: `birdnet:${key}`,
        dataMode: "live",
        sourceType: "bioacoustic_sensor",
        sourceId: batch.sourceId,
        siteId: batch.siteId,
        observedAt,
        kind: "bioacoustic_detection",
        reviewStatus: "machine_candidate",
        confidence,
        taxon: { commonName, scientificName, taxonId: detection.taxonId, invasiveStatus: "not_applicable" },
        data: {
          startSeconds: detection.startSeconds,
          endSeconds: detection.endSeconds,
          frequencyHz: detection.frequencyHz,
          notes: detection.notes,
          detectorOutput: true,
        },
        evidence,
        location: batch.location,
        provenance: {
          provider: batch.provenance.provider || "BirdNET",
          method: batch.provenance.method || "BirdNET acoustic classification",
          deviceModel: batch.provenance.deviceModel,
          modelName: batch.provenance.modelName || "BirdNET",
          modelVersion: batch.provenance.modelVersion,
          sourceUrl: batch.provenance.sourceUrl,
          license: batch.provenance.license,
        },
      },
      principalSourceId,
    );
  });
}

export interface SensorThingsObservationInput {
  "@iot.id"?: string | number;
  phenomenonTime?: string;
  resultTime?: string;
  result: unknown;
  kind?: string;
  reviewStatus?: ReedyRiverReviewStatus;
  Datastream?: Record<string, unknown>;
  ObservedProperty?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

export interface SensorThingsBatchInput {
  dataMode: "live";
  sourceId: string;
  siteId: string;
  location: {
    publicLabel: string;
    latitude?: number;
    longitude?: number;
    precisionMeters?: number;
  };
  provenance?: {
    provider?: string;
    method?: string;
    deviceModel?: string;
    sourceUrl?: string;
    license?: string;
  };
  observations: SensorThingsObservationInput[];
}

function sensorThingsName(row: SensorThingsObservationInput): string {
  const datastream = object(row.Datastream);
  const direct = object(row.ObservedProperty);
  const nested = object(datastream.ObservedProperty);
  return String(row.kind || direct.name || nested.name || datastream.name || "sensor_observation").trim();
}

function sensorThingsSourceType(name: string, result: Record<string, unknown>): ReedyRiverSourceType {
  const value = `${name} ${String(result.activityType || "")}`.toLowerCase();
  if (/acoustic|sound|bird|call|audio/.test(value)) return "bioacoustic_sensor";
  if (/invasive|plant|vegetation|flora/.test(value)) return "invasive_plant_survey";
  if (/activity|dump|erosion|construction|discharge event|disturbance/.test(value)) return "field_activity";
  if (/heartbeat|battery|signal strength|uptime|health/.test(value)) return "sensor_heartbeat";
  if (/water|flow|discharge|stage|turbidity|conductivity|temperature|oxygen|\bph\b|nitrate|phosphate/.test(value)) {
    return "water_quality_sensor";
  }
  return "other";
}

export function mapSensorThingsBatch(
  batch: SensorThingsBatchInput,
  principalSourceId: string,
): ReedyRiverObservationInput[] {
  assertLiveOnlyPayload({ dataMode: batch.dataMode, sourceId: batch.sourceId, provenance: batch.provenance });
  if (batch.sourceId !== principalSourceId) throw new Error("Payload sourceId must match X-DPAL-Source-Id");
  if (!Array.isArray(batch.observations) || batch.observations.length === 0) {
    throw new Error("observations must contain at least one SensorThings Observation");
  }
  if (batch.observations.length > 500) throw new Error("A SensorThings batch may contain at most 500 observations");

  return batch.observations.map((row, index) => {
    const observedAt = iso(row.phenomenonTime || row.resultTime, `observations[${index}].phenomenonTime`);
    const name = sensorThingsName(row);
    const result = object(row.result);
    const scalar = Object.keys(result).length ? result : { value: row.result };
    const datastream = object(row.Datastream);
    const unit = object(datastream.unitOfMeasurement);
    const parameters = object(row.parameters);
    const sourceType = sensorThingsSourceType(name, scalar);
    const iotId = row["@iot.id"];
    const idempotencyKey = `sensorthings:${String(iotId ?? hash(`${batch.sourceId}|${batch.siteId}|${observedAt}|${name}|${JSON.stringify(row.result)}`))}`;
    const reviewStatus = row.reviewStatus || (sourceType === "bioacoustic_sensor" ? "machine_candidate" : "qa_pending");

    return normalizeNativeReedyRiverObservation(
      {
        idempotencyKey,
        dataMode: "live",
        sourceType,
        sourceId: batch.sourceId,
        siteId: batch.siteId,
        observedAt,
        kind: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "sensor_observation",
        reviewStatus,
        confidence: scalar.confidence,
        taxon: {
          commonName: scalar.commonName,
          scientificName: scalar.scientificName,
          taxonId: scalar.taxonId,
          invasiveStatus: scalar.invasiveStatus,
        },
        data: {
          ...scalar,
          ...parameters,
          parameterName: scalar.parameterName || name,
          parameterCode: scalar.parameterCode,
          unit: scalar.unit || unit.symbol || unit.name,
          datastreamId: datastream["@iot.id"],
          datastreamName: datastream.name,
          sensorThingsObservationId: iotId,
        },
        evidence: scalar.evidence,
        location: batch.location,
        provenance: {
          provider: batch.provenance?.provider || "University OGC SensorThings feed",
          method: batch.provenance?.method || "OGC SensorThings Observation ingest",
          deviceModel: batch.provenance?.deviceModel,
          sourceUrl: batch.provenance?.sourceUrl,
          license: batch.provenance?.license,
        },
      },
      principalSourceId,
    );
  });
}
