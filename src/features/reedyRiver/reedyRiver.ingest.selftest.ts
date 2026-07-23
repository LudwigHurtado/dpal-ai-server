import assert from "node:assert/strict";
import { assertLiveOnlyPayload, parseReedyRiverIngestKeys } from "./reedyRiver.security.js";
import {
  mapBirdNetBatch,
  mapSensorThingsBatch,
  normalizeNativeReedyRiverObservation,
} from "./reedyRiver.ingest.js";

assert.deepEqual(
  Object.fromEntries(parseReedyRiverIngestKeys('{"furman-gateway":"secret-a","field-team":"secret-b"}')),
  { "furman-gateway": "secret-a", "field-team": "secret-b" },
);
assert.throws(
  () => assertLiveOnlyPayload({ dataMode: "live", sourceId: "demo-sensor", provenance: { provider: "demo" } }),
  /Synthetic\/demo provenance/,
);

const birdNet = mapBirdNetBatch(
  {
    dataMode: "live",
    sourceId: "furman-birdnet-01",
    siteId: "university-site-a",
    location: { publicLabel: "Reedy River university monitoring zone" },
    provenance: { provider: "BirdNET", modelVersion: "2.4" },
    detections: [
      {
        detectionId: "clip-1",
        observedAt: "2026-07-22T12:15:00.000Z",
        confidence: 0.99,
        scientificName: "Setophaga citrina",
        audioSha256: "a".repeat(64),
      },
    ],
  },
  "furman-birdnet-01",
);
assert.equal(birdNet.length, 1);
assert.equal(birdNet[0]?.reviewStatus, "machine_candidate");
assert.equal(birdNet[0]?.sourceType, "bioacoustic_sensor");
assert.equal(birdNet[0]?.evidence?.[0]?.restricted, true);

const sensorThings = mapSensorThingsBatch(
  {
    dataMode: "live",
    sourceId: "university-sensorthings",
    siteId: "university-site-b",
    location: { publicLabel: "Reedy River university monitoring zone B" },
    observations: [
      {
        "@iot.id": 42,
        phenomenonTime: "2026-07-22T12:30:00.000Z",
        result: { value: 7.1, parameterName: "dissolved oxygen", unit: "mg/L" },
        ObservedProperty: { name: "Dissolved oxygen" },
      },
    ],
  },
  "university-sensorthings",
);
assert.equal(sensorThings[0]?.sourceType, "water_quality_sensor");
assert.equal(sensorThings[0]?.reviewStatus, "qa_pending");
assert.throws(
  () => mapSensorThingsBatch(
    {
      dataMode: "live",
      sourceId: "wrong-source",
      siteId: "x",
      location: { publicLabel: "x" },
      observations: [{ phenomenonTime: "2026-07-22T12:30:00.000Z", result: 1 }],
    },
    "configured-source",
  ),
  /must match/,
);

const nativeBase = {
  idempotencyKey: "native-1",
  dataMode: "live",
  sourceType: "invasive_plant_survey",
  sourceId: "field-team",
  siteId: "zone-a",
  observedAt: "2026-07-22T12:45:00.000Z",
  kind: "invasive_plant_observation",
  reviewStatus: "field_observed",
  data: {},
  location: { publicLabel: "Reedy River field zone" },
  provenance: { provider: "Field team", method: "Documented field survey" },
};
assert.equal(normalizeNativeReedyRiverObservation(nativeBase, "field-team").reviewStatus, "field_observed");
for (const privileged of ["qa_passed", "expert_confirmed", "rejected"] as const) {
  assert.throws(
    () => normalizeNativeReedyRiverObservation({ ...nativeBase, idempotencyKey: `native-${privileged}`, reviewStatus: privileged }, "field-team"),
    /protected_review_endpoint/,
    `native source must not self-submit ${privileged}`,
  );
  assert.throws(
    () => mapSensorThingsBatch(
      {
        dataMode: "live",
        sourceId: "university-sensorthings",
        siteId: "university-site-b",
        location: { publicLabel: "Reedy River university monitoring zone B" },
        observations: [{ phenomenonTime: "2026-07-22T12:30:00.000Z", result: 1, reviewStatus: privileged }],
      },
      "university-sensorthings",
    ),
    /protected_review_endpoint/,
    `SensorThings source must not self-submit ${privileged}`,
  );
}

console.log("reedyRiver.ingest self-test passed");
