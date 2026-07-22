import assert from "node:assert/strict";
import {
  buildReedyRiverCitizenObservation,
  capturePayloadForHash,
  computeReedyRiverCapturePayloadHash,
  type ReedyRiverCitizenCapturePayload,
} from "./reedyRiver.capture.js";

const base: ReedyRiverCitizenCapturePayload = {
  dataMode: "live",
  stationId: "S-319",
  capturedAt: new Date().toISOString(),
  gps: { lat: 34.84, lng: -82.4, accuracyM: 12 },
  sampleType: "field_screening",
  condition: "dry",
  methodName: "Calibrated handheld meter protocol",
  measurements: { turbidityNtu: 4.2, conductivityUsPerCm: 310 },
  evidence: [{ sha256: "a".repeat(64), mimeType: "image/jpeg" }],
  clientHash: "0".repeat(64),
};
base.clientHash = computeReedyRiverCapturePayloadHash(base);
const built = buildReedyRiverCitizenObservation({ payload: base, account: { userId: "user-1", role: "standard" } });
assert.equal(built.observation.sourceType, "other");
assert.equal(built.observation.data.sourceClass, "citizen_science_sample");
assert.equal(built.observation.reviewStatus, "qa_pending");
assert.equal(built.observation.siteId, "S-319");
assert.equal((built.observation.data.integrity as Record<string, unknown>).hashVerified, true);
assert.equal((built.observation.data.integrity as Record<string, unknown>).anchored, false);
assert.equal(capturePayloadForHash(base).dataMode, "live");
assert.throws(() => buildReedyRiverCitizenObservation({ payload: { ...base, clientHash: "f".repeat(64) }, account: { userId: "user-1", role: "standard" } }), /hash_mismatch/);
const fieldEcoli = { ...base, measurements: { ecoliMpnPer100mL: 400 } };
fieldEcoli.clientHash = computeReedyRiverCapturePayloadHash(fieldEcoli);
assert.throws(() => buildReedyRiverCitizenObservation({ payload: fieldEcoli, account: { userId: "user-1", role: "standard" } }), /ecoli_requires_laboratory_result/);
const lab: ReedyRiverCitizenCapturePayload = {
  ...base,
  sampleType: "laboratory_result",
  laboratoryName: "Example lab name for test only",
  measurements: { ecoliMpnPer100mL: 400 },
};
lab.clientHash = computeReedyRiverCapturePayloadHash(lab);
const labBuilt = buildReedyRiverCitizenObservation({ payload: lab, account: { userId: "user-1", role: "standard" } });
assert.equal(labBuilt.observation.kind, "citizen_laboratory_result");
assert.equal(labBuilt.observation.reviewStatus, "qa_pending");
console.log("✅ reedyRiver.capture.selftest passed");
