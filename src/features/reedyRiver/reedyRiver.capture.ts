import crypto from "crypto";
import { REEDY_RIVER_PROJECT_ID, type ReedyRiverObservationInput } from "./reedyRiver.types.js";
import { findReedyRiverTmdlStation } from "./reedyRiver.regulatory.js";

export type ReedyRiverCaptureSampleType = "field_screening" | "laboratory_result";
export type ReedyRiverCaptureCondition = "dry" | "rain" | "post_rain" | "unknown";

export interface ReedyRiverCitizenCapturePayload {
  dataMode: "live";
  stationId: string;
  capturedAt: string;
  gps: { lat: number; lng: number; accuracyM: number };
  sampleType: ReedyRiverCaptureSampleType;
  condition: ReedyRiverCaptureCondition;
  methodName: string;
  laboratoryName?: string;
  laboratoryCertificationId?: string;
  measurements: {
    ecoliMpnPer100mL?: number;
    turbidityNtu?: number;
    conductivityUsPerCm?: number;
    waterTemperatureC?: number;
  };
  note?: string;
  evidence: Array<{ sha256: string; mimeType?: string; capturedAt?: string }>;
  clientHash: string;
}

export interface ReedyRiverCaptureAccount {
  userId: string;
  role: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).filter((key) => row[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(row[key])}`).join(",")}}`;
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function capturePayloadForHash(payload: ReedyRiverCitizenCapturePayload): Omit<ReedyRiverCitizenCapturePayload, "clientHash"> {
  const { clientHash: _clientHash, ...hashable } = payload;
  return hashable;
}

export function computeReedyRiverCapturePayloadHash(payload: ReedyRiverCitizenCapturePayload): string {
  return sha256Hex(stableStringify(capturePayloadForHash(payload)));
}

export function assertReedyRiverCaptureHash(payload: ReedyRiverCitizenCapturePayload): string {
  const payloadHash = computeReedyRiverCapturePayloadHash(payload);
  if (!crypto.timingSafeEqual(Buffer.from(payloadHash, "hex"), Buffer.from(payload.clientHash.toLowerCase(), "hex"))) {
    throw new Error("hash_mismatch");
  }
  return payloadHash;
}

export function buildReedyRiverCitizenObservation(input: {
  payload: ReedyRiverCitizenCapturePayload;
  account: ReedyRiverCaptureAccount;
}): { observation: ReedyRiverObservationInput; payloadHash: string; canonicalHash: string; collectorPseudonym: string } {
  const { payload, account } = input;
  const station = findReedyRiverTmdlStation(payload.stationId);
  if (!station) throw new Error("station_not_in_tmdl_reference");
  const payloadHash = assertReedyRiverCaptureHash(payload);
  const collectorPseudonym = `collector-${sha256Hex(`${REEDY_RIVER_PROJECT_ID}|${account.userId}`).slice(0, 20)}`;
  const canonicalHash = sha256Hex(stableStringify({ payloadHash, collectorPseudonym }));
  const capturedAt = new Date(payload.capturedAt);
  if (!Number.isFinite(capturedAt.getTime())) throw new Error("capturedAt_invalid");
  if (capturedAt.getTime() > Date.now() + 10 * 60 * 1000) throw new Error("capturedAt_in_future");

  const measurements = payload.measurements || {};
  const measurementCount = Object.values(measurements).filter((value) => typeof value === "number" && Number.isFinite(value)).length;
  if (!measurementCount) throw new Error("at_least_one_measurement_required");
  if (measurements.ecoliMpnPer100mL !== undefined) {
    if (payload.sampleType !== "laboratory_result") throw new Error("ecoli_requires_laboratory_result");
    if (!payload.laboratoryName?.trim()) throw new Error("ecoli_requires_laboratory_name");
    if (!payload.evidence.length) throw new Error("ecoli_requires_laboratory_evidence_hash");
  }

  return {
    payloadHash,
    canonicalHash,
    collectorPseudonym,
    observation: {
      projectId: REEDY_RIVER_PROJECT_ID,
      idempotencyKey: `citizen:${canonicalHash}`,
      dataMode: "live",
      sourceType: "other",
      sourceId: `authenticated-citizen:${collectorPseudonym}`,
      siteId: station.entryId,
      observedAt: capturedAt.toISOString(),
      kind: payload.sampleType === "laboratory_result" ? "citizen_laboratory_result" : "citizen_field_screening",
      reviewStatus: "qa_pending",
      data: {
        sourceClass: "citizen_science_sample",
        sampleType: payload.sampleType,
        condition: payload.condition,
        methodName: payload.methodName.trim(),
        laboratoryName: payload.laboratoryName?.trim(),
        laboratoryCertificationId: payload.laboratoryCertificationId?.trim(),
        measurements,
        note: payload.note?.trim(),
        integrity: {
          payloadHash,
          canonicalHash,
          clientHash: payload.clientHash.toLowerCase(),
          hashVerified: true,
          anchored: false,
        },
        regulatoryUse: "not_regulatory_until_method_and_qa_acceptance",
        qappStatus: "not_asserted",
        laboratoryCertificationStatus: payload.laboratoryCertificationId ? "claimed_pending_review" : "not_provided",
        tmdlReferenceEntryId: station.entryId,
        tmdlCalculationPointId: station.calculationPointId,
      },
      evidence: payload.evidence.map((evidence) => ({
        sha256: evidence.sha256.toLowerCase(),
        mimeType: evidence.mimeType,
        capturedAt: evidence.capturedAt || capturedAt.toISOString(),
        restricted: true,
      })),
      location: {
        publicLabel: station.description,
        latitude: payload.gps.lat,
        longitude: payload.gps.lng,
        precisionMeters: payload.gps.accuracyM,
      },
      provenance: {
        provider: "DPAL authenticated citizen-science capture",
        method: payload.methodName.trim(),
        collectedBy: collectorPseudonym,
      },
    },
  };
}
