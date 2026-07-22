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

export function analyzeActivities(
  observations: ReedyRiverObservation[],
  windowEnd: Date,
): {
  findings: ReedyRiverFinding[];
  actions: ReedyRiverActionDraft[];
  recommendations: ReedyRiverProjectRecommendation[];
} {
  const rows = observations.filter(
    (observation) => observation.sourceType === "field_activity" || observation.kind === "field_activity",
  );
  const actionable = rows.filter((row) => row.reviewStatus !== "rejected");
  if (!actionable.length) return { findings: [], actions: [], recommendations: [] };

  const byActivity = new Map<string, ReedyRiverObservation[]>();
  for (const observation of actionable) {
    const key = text(observation.data.activityType).toLowerCase() || "field_activity";
    byActivity.set(key, [...(byActivity.get(key) ?? []), observation]);
  }

  const findings: ReedyRiverFinding[] = [];
  const actions: ReedyRiverActionDraft[] = [];
  const recommendations: ReedyRiverProjectRecommendation[] = [];

  for (const [activityType, activityRows] of byActivity.entries()) {
    const sites = unique(activityRows.map((row) => row.siteId));
    const evidenceIds = activityRows.map((row) => row.observationId);
    const reportedSeverities = activityRows.map((row) => {
      const value = text(row.data.severity).toLowerCase();
      return (["info", "low", "moderate", "high", "critical"].includes(value)
        ? value
        : "moderate") as ReedyRiverSeverity;
    });
    const severity = highestSeverity(reportedSeverities);
    const expertConfirmed = activityRows.some((row) => row.reviewStatus === "expert_confirmed");
    const titleLabel = activityType.replace(/_/g, " ");

    findings.push({
      findingId: findingId("activity", `${activityType}:${sites.join(",")}`),
      category: "activity",
      state: expertConfirmed ? "expert_confirmed" : "corroborated",
      severity,
      title: `Field activity reported: ${titleLabel}`,
      summary: `${activityRows.length} live report(s) across ${sites.length} site(s). The report documents an observed activity; ecological impact and responsibility require investigation.`,
      confidence: expertConfirmed ? 0.95 : 0.78,
      siteIds: sites,
      evidenceObservationIds: evidenceIds,
      limitations: [
        "Observed activity does not by itself establish causation, violation, or ecological impact.",
        "Preserve original evidence and avoid public attribution before review.",
      ],
    });

    actions.push({
      fingerprint: actionFingerprint("activity", activityType, sites),
      category: "activity",
      priority: severity,
      title: `Inspect and document ${titleLabel}`,
      rationale: "A live field report warrants site verification, evidence preservation, and assignment to the appropriate owner.",
      steps: [
        "Review the original media, timestamp, location, and observer notes.",
        "Check whether immediate safety or environmental protection measures are needed.",
        "Assign the responsible field, stormwater, land-management, or enforcement contact.",
        "Record the disposition and follow-up evidence in DPAL.",
      ],
      ownerRole: "Field operations coordinator",
      dueAt: new Date(
        windowEnd.getTime() + (SEVERITY_RANK[severity] >= SEVERITY_RANK.high ? 6 : 24) * 60 * 60 * 1000,
      ).toISOString(),
      evidenceObservationIds: evidenceIds,
      dependsOn: [],
      approvalRequired: severity === "critical",
      safeToExecute: true,
      recommendedInitialStatus: "triaged",
      nextStep: "Assign an owner and verify the site report before escalation or attribution.",
    });

    recommendations.push({
      recommendationId: recommendationId("activity", `${activityType}:${sites.join(",")}`),
      title: `${titleLabel} site inspection`,
      recommendationType: "disturbance_inspection",
      evidenceGate: expertConfirmed ? "expert_confirmed" : "corroborated",
      rationale: "Live field evidence supports an inspection and disposition workflow, not an automatic violation finding.",
      evidenceObservationIds: evidenceIds,
      requiresExpertApproval: severity === "critical",
      implementationStatus: expertConfirmed ? "eligible_for_planning" : "verification_required",
      nextDecision: "Verify the activity and select the accountable operational owner.",
    });
  }

  return { findings, actions, recommendations };
}
