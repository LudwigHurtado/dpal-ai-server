import type {
  ReedyRiverActionDraft,
  ReedyRiverFinding,
  ReedyRiverObservation,
  ReedyRiverProjectRecommendation,
} from "./reedyRiver.types.js";
import {
  actionFingerprint,
  findingId,
  numeric,
  recommendationId,
  safeDate,
  text,
  unique,
} from "./reedyRiver.analysis.shared.js";

function isWaterEvidence(observation: ReedyRiverObservation): boolean {
  return (
    ["water_quality_sensor", "hydrology_public_api"].includes(observation.sourceType) ||
    observation.kind === "citizen_field_screening" ||
    observation.kind === "citizen_laboratory_result"
  );
}

export function analyzeWater(
  observations: ReedyRiverObservation[],
  windowEnd: Date,
): {
  findings: ReedyRiverFinding[];
  actions: ReedyRiverActionDraft[];
  recommendations: ReedyRiverProjectRecommendation[];
} {
  const rows = observations.filter(isWaterEvidence);
  const findings: ReedyRiverFinding[] = [];
  const actions: ReedyRiverActionDraft[] = [];
  const recommendations: ReedyRiverProjectRecommendation[] = [];

  const thresholdRows = rows.filter(
    (row) => row.data.exceedsThreshold === true || row.data.thresholdExceeded === true,
  );
  if (thresholdRows.length) {
    const sites = unique(thresholdRows.map((row) => row.siteId));
    const evidenceIds = thresholdRows.map((row) => row.observationId);
    const parameters = unique(
      thresholdRows.map((row) => text(row.data.parameterName) || text(row.data.parameterCode) || row.kind),
    );
    findings.push({
      findingId: findingId("water", `threshold:${parameters.join(",")}:${sites.join(",")}`),
      category: "water",
      state: thresholdRows.some((row) => row.reviewStatus === "expert_confirmed")
        ? "expert_confirmed"
        : "corroborated",
      severity: "high",
      title: `Configured water threshold exceeded: ${parameters.join(", ")}`,
      summary: `${thresholdRows.length} live measurement(s) were explicitly flagged against a configured site threshold. DPAL does not infer regulatory noncompliance from the flag alone.`,
      confidence: 0.86,
      siteIds: sites,
      evidenceObservationIds: evidenceIds,
      limitations: [
        "Confirm calibration, sample method, units, and quality-control status.",
        "A configured operational threshold is not automatically a regulatory standard.",
      ],
    });
    actions.push({
      fingerprint: actionFingerprint("water_threshold", parameters.join(","), sites),
      category: "water",
      priority: "high",
      title: `Validate and investigate ${parameters.join(", ")} exceedance`,
      rationale: "A live source explicitly reported a configured threshold exceedance; confirmation sampling and QA are required before escalation.",
      steps: [
        "Check sensor calibration, units, timestamp, and quality flags.",
        "Collect a confirmation sample using the approved field protocol.",
        "Compare upstream/downstream or reference-site conditions when available.",
        "Escalate to the responsible water-quality lead if the result is confirmed.",
      ],
      ownerRole: "Water-quality lead",
      dueAt: new Date(windowEnd.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      evidenceObservationIds: evidenceIds,
      dependsOn: [],
      approvalRequired: true,
      safeToExecute: true,
      recommendedInitialStatus: "triaged",
      nextStep: "Assign a water-quality lead and schedule confirmation sampling.",
    });
    recommendations.push({
      recommendationId: recommendationId("water", `${parameters.join(",")}:${sites.join(",")}`),
      title: `${parameters.join(", ")} confirmation and source investigation`,
      recommendationType: "water_quality_investigation",
      evidenceGate: "corroborated",
      rationale: "The configured threshold flag supports confirmation and source investigation, not a final compliance finding.",
      evidenceObservationIds: evidenceIds,
      requiresExpertApproval: true,
      implementationStatus: "verification_required",
      nextDecision: "Confirm the measurement and identify whether a source investigation is warranted.",
    });
  }

  const citizenRows = rows.filter((row) => row.kind.startsWith("citizen_"));
  if (citizenRows.length) {
    const pending = citizenRows.filter((row) => row.reviewStatus === "qa_pending");
    if (pending.length) {
      const sites = unique(pending.map((row) => row.siteId));
      const evidenceIds = pending.map((row) => row.observationId);
      findings.push({
        findingId: findingId("water", `citizen-qa:${sites.join(",")}`),
        category: "water",
        state: "candidate",
        severity: "info",
        title: "Authenticated citizen-science water records await QA",
        summary: `${pending.length} server-hash-verified capture(s) were recorded. They remain QA-pending and are not regulatory compliance results.`,
        confidence: 1,
        siteIds: sites,
        evidenceObservationIds: evidenceIds,
        limitations: [
          "Hash verification establishes record integrity, not measurement accuracy.",
          "Regulatory use requires accepted methods, quality assurance, and applicable laboratory or authority requirements.",
        ],
      });
      actions.push({
        fingerprint: actionFingerprint("citizen_water_qa", "pending", sites),
        category: "water",
        priority: "moderate",
        title: "Review authenticated citizen-science water captures",
        rationale: "The capture payloads passed account and hash checks, but method, evidence, calibration, and laboratory claims still require review.",
        steps: [
          "Check station reference, timestamp, exact private location, and GPS accuracy.",
          "Review method, units, evidence hashes, and any laboratory documentation.",
          "Confirm whether the record is suitable for operational use, outside-data use, or rejection.",
          "Record the review decision and limitations in the DPAL evidence history.",
        ],
        ownerRole: "Water-quality QA reviewer",
        dueAt: new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        evidenceObservationIds: evidenceIds,
        dependsOn: [],
        approvalRequired: true,
        safeToExecute: true,
        recommendedInitialStatus: "awaiting_expert",
        nextStep: "Assign a qualified water-quality reviewer and inspect the original evidence package.",
      });
    }
  }

  const flowRows = rows
    .filter((row) => text(row.data.parameterCode) === "00060")
    .map((row) => ({ row, value: numeric(row.data.value), date: safeDate(row.observedAt) }))
    .filter(
      (item): item is { row: ReedyRiverObservation; value: number; date: Date } =>
        item.value !== null && item.date !== null,
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (flowRows.length >= 2) {
    const first = flowRows[0];
    const last = flowRows[flowRows.length - 1];
    if (first && last) {
      const base = Math.max(Math.abs(first.value), 1);
      const relativeChange = Math.abs(last.value - first.value) / base;
      if (relativeChange >= 0.5 && Math.abs(last.value - first.value) >= 5) {
        const sites = unique(flowRows.map((item) => item.row.siteId));
        const evidenceIds = flowRows.map((item) => item.row.observationId);
        findings.push({
          findingId: findingId("flow", `${first.value}:${last.value}:${sites.join(",")}`),
          category: "water",
          state: "corroborated",
          severity: "moderate",
          title: "Material streamflow change during the reporting window",
          summary: `USGS/live hydrology changed from ${first.value.toFixed(1)} to ${last.value.toFixed(1)} ${text(last.row.data.unit) || "ft³/s"} during the window (${Math.round(relativeChange * 100)}% absolute change).`,
          confidence: 0.9,
          siteIds: sites,
          evidenceObservationIds: evidenceIds,
          limitations: [
            "Streamflow change alone does not identify pollution, habitat damage, E. coli concentration, or a causal source.",
            "Field safety decisions should also consider weather, stage, local warnings, and site conditions.",
          ],
        });
        actions.push({
          fingerprint: actionFingerprint("flow_change", "usgs-00060", sites),
          category: "water",
          priority: "moderate",
          title: "Review field access and sampling safety after streamflow change",
          rationale: "A material change in live streamflow can affect safe access and comparability of field samples.",
          steps: [
            "Review the latest stage/flow and local weather before dispatch.",
            "Confirm that planned sampling points remain safely accessible.",
            "Annotate flow conditions on all field samples and observations.",
          ],
          ownerRole: "Field operations coordinator",
          dueAt: new Date(windowEnd.getTime() + 6 * 60 * 60 * 1000).toISOString(),
          evidenceObservationIds: evidenceIds,
          dependsOn: [],
          approvalRequired: false,
          safeToExecute: true,
          recommendedInitialStatus: "triaged",
          nextStep: "Confirm field safety and annotate flow conditions before the next visit.",
        });
      }
    }
  }

  return { findings, actions, recommendations };
}
