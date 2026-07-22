import assert from "node:assert/strict";
import {
  alignToThreeHourWindow,
  analyzeReedyRiverWindow,
  lastCompletedThreeHourWindow,
} from "./reedyRiver.analysis.js";
import type { ReedyRiverObservation } from "./reedyRiver.types.js";

function observation(overrides: Partial<ReedyRiverObservation>): ReedyRiverObservation {
  return {
    observationId: "obs-default",
    projectId: "reedy-river-sc",
    idempotencyKey: "key-default",
    dataMode: "live",
    sourceType: "invasive_plant_survey",
    sourceId: "field-team-1",
    siteId: "site-a",
    observedAt: "2026-07-22T01:00:00.000Z",
    receivedAt: "2026-07-22T01:01:00.000Z",
    kind: "invasive_plant_observation",
    reviewStatus: "field_observed",
    confidence: 0.8,
    taxon: { scientificName: "Ficaria verna", invasiveStatus: "regulated" },
    data: {},
    evidence: [{ sha256: "a".repeat(64), mimeType: "image/jpeg" }],
    location: { publicLabel: "Reedy River monitoring zone A" },
    provenance: { provider: "DPAL Field", method: "SC Adopt-a-Stream field visit", collectedBy: "observer-a" },
    ...overrides,
  };
}

const aligned = alignToThreeHourWindow(new Date("2026-07-22T04:59:59.000Z"));
assert.equal(aligned.toISOString(), "2026-07-22T03:00:00.000Z");

const completed = lastCompletedThreeHourWindow(new Date("2026-07-22T04:00:00.000Z"));
assert.equal(completed.windowStart.toISOString(), "2026-07-22T00:00:00.000Z");
assert.equal(completed.windowEnd.toISOString(), "2026-07-22T03:00:00.000Z");

const candidateReport = analyzeReedyRiverWindow({
  observations: [observation({ observationId: "plant-1", idempotencyKey: "plant-1" })],
  windowStart: new Date("2026-07-22T00:00:00.000Z"),
  windowEnd: new Date("2026-07-22T03:00:00.000Z"),
  now: new Date("2026-07-22T03:05:00.000Z"),
});
const candidatePlant = candidateReport.findings.find((finding) => finding.category === "invasive_plant");
assert.equal(candidatePlant?.state, "candidate");
assert.equal(
  candidateReport.projectRecommendations.find((item) => item.recommendationType === "verification_survey")
    ?.implementationStatus,
  "not_enough_evidence",
);
assert.equal(candidateReport.dataPolicy, "live_only");

const corroboratedReport = analyzeReedyRiverWindow({
  observations: [
    observation({ observationId: "plant-1", idempotencyKey: "plant-1", provenance: { provider: "DPAL Field", method: "survey", collectedBy: "observer-a" } }),
    observation({ observationId: "plant-2", idempotencyKey: "plant-2", sourceId: "field-team-2", provenance: { provider: "University Lab", method: "survey", collectedBy: "observer-b" } }),
  ],
  windowStart: new Date("2026-07-22T00:00:00.000Z"),
  windowEnd: new Date("2026-07-22T03:00:00.000Z"),
  now: new Date("2026-07-22T03:05:00.000Z"),
});
assert.equal(
  corroboratedReport.findings.find((finding) => finding.category === "invasive_plant")?.state,
  "corroborated",
);
assert.equal(
  corroboratedReport.actionDrafts.find((action) => action.category === "invasive_plant")?.safeToExecute,
  false,
);

const confirmedReport = analyzeReedyRiverWindow({
  observations: [
    observation({
      observationId: "plant-confirmed",
      idempotencyKey: "plant-confirmed",
      reviewStatus: "expert_confirmed",
      provenance: { provider: "University Herbarium", method: "expert botanical review", collectedBy: "botanist-1" },
    }),
  ],
  windowStart: new Date("2026-07-22T00:00:00.000Z"),
  windowEnd: new Date("2026-07-22T03:00:00.000Z"),
  now: new Date("2026-07-22T03:05:00.000Z"),
});
assert.equal(
  confirmedReport.projectRecommendations.find((item) => item.recommendationType === "containment_planning")
    ?.implementationStatus,
  "eligible_for_planning",
);

const acousticReport = analyzeReedyRiverWindow({
  observations: [
    observation({
      observationId: "audio-1",
      idempotencyKey: "audio-1",
      sourceType: "bioacoustic_sensor",
      sourceId: "birdnet-node-1",
      kind: "bioacoustic_detection",
      reviewStatus: "machine_candidate",
      confidence: 0.99,
      taxon: { scientificName: "Setophaga citrina" },
      provenance: { provider: "BirdNET", method: "edge inference", modelVersion: "2.4" },
    }),
  ],
  windowStart: new Date("2026-07-22T00:00:00.000Z"),
  windowEnd: new Date("2026-07-22T03:00:00.000Z"),
  now: new Date("2026-07-22T03:05:00.000Z"),
});
assert.equal(
  acousticReport.findings.find((finding) => finding.category === "bioacoustic")?.state,
  "candidate",
  "high-confidence BirdNET output must remain a candidate",
);

const noDataReport = analyzeReedyRiverWindow({
  observations: [],
  windowStart: new Date("2026-07-22T00:00:00.000Z"),
  windowEnd: new Date("2026-07-22T03:00:00.000Z"),
  now: new Date("2026-07-22T03:05:00.000Z"),
});
assert.equal(noDataReport.status, "insufficient_data");
assert.equal(noDataReport.projectRecommendations.length, 0);
assert.ok(noDataReport.actionDrafts.some((action) => action.category === "data_gap"));

console.log("reedyRiver.analysis self-test passed");
