import type {
  ReedyRiverActionDraft,
  ReedyRiverFinding,
  ReedyRiverObservation,
  ReedyRiverProjectRecommendation,
  ReedyRiverSeverity,
  ReedyRiverSourceStatus,
} from "./reedyRiver.types.js";
import {
  SEVERITY_RANK,
  actionFingerprint,
  clamp,
  distinctEvidenceObservers,
  evidenceCount,
  findingId,
  highestSeverity,
  numeric,
  recommendationId,
  safeDate,
  taxonKey,
  taxonLabel,
  text,
  unique,
} from "./reedyRiver.analysis.shared.js";

export function analyzeBioacoustics(
  observations: ReedyRiverObservation[],
  windowEnd: Date,
): {
  findings: ReedyRiverFinding[];
  actions: ReedyRiverActionDraft[];
  recommendations: ReedyRiverProjectRecommendation[];
} {
  const rows = observations.filter(
    (observation) =>
      observation.sourceType === "bioacoustic_sensor" ||
      observation.kind === "bioacoustic_detection",
  );
  const byTaxon = new Map<string, ReedyRiverObservation[]>();
  for (const observation of rows) {
    if (observation.reviewStatus === "rejected") continue;
    const key = taxonKey(observation);
    byTaxon.set(key, [...(byTaxon.get(key) ?? []), observation]);
  }

  const findings: ReedyRiverFinding[] = [];
  const actions: ReedyRiverActionDraft[] = [];
  const recommendations: ReedyRiverProjectRecommendation[] = [];

  for (const [key, detections] of byTaxon.entries()) {
    const expertRows = detections.filter((row) => row.reviewStatus === "expert_confirmed");
    const highConfidenceRows = detections.filter((row) => (row.confidence ?? 0) >= 0.7);
    const sites = unique(detections.map((row) => row.siteId));
    const sources = unique(detections.map((row) => row.sourceId));
    const representative = expertRows[0] ?? highConfidenceRows[0] ?? detections[0];
    if (!representative) continue;
    const label = taxonLabel(representative);
    const state: ReedyRiverFinding["state"] = expertRows.length ? "expert_confirmed" : "candidate";
    const severity: ReedyRiverSeverity = expertRows.length ? "moderate" : "info";
    const confidence = expertRows.length
      ? 0.97
      : clamp(
          (highConfidenceRows.reduce((sum, row) => sum + (row.confidence ?? 0), 0) /
            Math.max(1, highConfidenceRows.length)) * 0.75,
        );
    const evidenceIds = detections.map((row) => row.observationId);

    findings.push({
      findingId: findingId("acoustic", `${key}:${state}`),
      category: "bioacoustic",
      state,
      severity,
      title:
        state === "expert_confirmed"
          ? `Expert-reviewed acoustic record: ${label}`
          : `Bioacoustic candidate: ${label}`,
      summary: `${detections.length} live detection(s) from ${sources.length} sensor(s) across ${sites.length} site(s). ${
        state === "expert_confirmed"
          ? "At least one clip has expert confirmation."
          : "Detector output remains an AI candidate regardless of confidence or repetition."
      }`,
      confidence,
      siteIds: sites,
      evidenceObservationIds: evidenceIds,
      taxon: representative.taxon,
      limitations:
        state === "expert_confirmed"
          ? ["An acoustic identification does not by itself establish abundance, breeding, or habitat condition."]
          : [
              "Automated acoustic classification is not a confirmed species-presence record.",
              "Original audio and model/version metadata must remain available for review.",
            ],
    });

    actions.push({
      fingerprint: actionFingerprint("bioacoustic", `${key}:${state}`, sites),
      category: "bioacoustic",
      priority: expertRows.length ? "moderate" : "low",
      title:
        expertRows.length
          ? `Plan repeat survey for ${label}`
          : `Review representative audio clips for ${label}`,
      rationale: expertRows.length
        ? "Repeat sampling can test persistence and seasonal pattern without overstating a single confirmed clip."
        : "Human review of original audio is required before DPAL treats a detector label as ecological evidence.",
      steps: expertRows.length
        ? [
            "Select repeat recording periods that match the original detection window.",
            "Keep sensor placement, gain, model version, and weather metadata comparable.",
            "Have a qualified reviewer assess representative clips.",
            "Compare detections across sites and dates before proposing habitat work.",
          ]
        : [
            "Select the highest-confidence and lowest-confidence representative clips.",
            "Verify the original audio hash, timestamp, sensor, and model version.",
            "Assign an ecologist or qualified acoustic reviewer.",
            "Confirm or reject the candidate and record the reviewer rationale.",
          ],
      ownerRole: expertRows.length ? "Field ecology lead" : "Bioacoustic reviewer",
      dueAt: new Date(windowEnd.getTime() + (expertRows.length ? 72 : 48) * 60 * 60 * 1000).toISOString(),
      evidenceObservationIds: evidenceIds,
      dependsOn: [],
      approvalRequired: true,
      safeToExecute: true,
      recommendedInitialStatus: expertRows.length ? "triaged" : "awaiting_expert",
      nextStep: expertRows.length
        ? "Assign a field ecology lead and schedule repeat sampling."
        : "Open the audio-review queue and assign a qualified reviewer.",
    });

    recommendations.push({
      recommendationId: recommendationId("bioacoustic", key),
      title: expertRows.length ? `${label} repeat-survey project` : `${label} acoustic verification queue`,
      recommendationType: "verification_survey",
      evidenceGate: state,
      rationale: expertRows.length
        ? "An expert-reviewed acoustic record supports a repeat survey, not an abundance or restoration claim."
        : "Machine detections support review only.",
      evidenceObservationIds: evidenceIds,
      requiresExpertApproval: true,
      implementationStatus: expertRows.length ? "eligible_for_planning" : "not_enough_evidence",
      nextDecision: expertRows.length
        ? "Approve the repeat-survey design and sampling window."
        : "Complete expert clip review.",
    });
  }

  return { findings, actions, recommendations };
}
