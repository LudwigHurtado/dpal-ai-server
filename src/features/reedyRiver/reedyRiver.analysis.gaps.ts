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

export function buildDataGapActions(
  sourceStatus: ReedyRiverSourceStatus[],
  windowEnd: Date,
): { findings: ReedyRiverFinding[]; actions: ReedyRiverActionDraft[] } {
  const missing = sourceStatus.filter((source) =>
    ["unavailable", "not_connected", "stale"].includes(source.state),
  );
  if (!missing.length) return { findings: [], actions: [] };

  const evidenceIds: string[] = [];
  const sourceNames = missing.map((source) => source.label);
  const severity: ReedyRiverSeverity = missing.some((source) => source.state === "unavailable")
    ? "moderate"
    : "low";
  return {
    findings: [
      {
        findingId: findingId("data-gap", sourceNames.join(",")),
        category: "data_gap",
        state: "data_gap",
        severity,
        title: "Monitoring coverage gap",
        summary: `The following live sources are not current for this window: ${sourceNames.join(", ")}. DPAL will not create ecological project claims from missing data.`,
        confidence: 1,
        siteIds: [],
        evidenceObservationIds: evidenceIds,
        limitations: ["Absence of incoming data is not evidence of ecological absence or normal conditions."],
      },
    ],
    actions: missing.map((source) => ({
      fingerprint: actionFingerprint("source_gap", source.sourceType, []),
      category: "data_gap",
      priority: source.state === "unavailable" ? "moderate" : "low",
      title: `Restore or connect ${source.label}`,
      rationale: source.message,
      steps: [
        "Confirm the expected device, partner feed, or field protocol is active.",
        "Check credentials, network path, clock synchronization, and last successful record.",
        "Submit one live validation record and verify it appears in the DPAL source ledger.",
      ],
      ownerRole: source.sourceType === "hydrology_public_api" ? "Data integration engineer" : "Monitoring coordinator",
      dueAt: new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      evidenceObservationIds: [],
      dependsOn: [],
      approvalRequired: false,
      safeToExecute: true,
      recommendedInitialStatus: "proposed",
      nextStep: `Assign a monitoring owner and validate one live ${source.label.toLowerCase()} record.`,
    })),
  };
}
