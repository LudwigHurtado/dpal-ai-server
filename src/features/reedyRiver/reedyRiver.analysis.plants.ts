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

export function analyzeInvasivePlants(
  observations: ReedyRiverObservation[],
  windowEnd: Date,
): {
  findings: ReedyRiverFinding[];
  actions: ReedyRiverActionDraft[];
  recommendations: ReedyRiverProjectRecommendation[];
} {
  const candidates = observations.filter(
    (observation) =>
      observation.sourceType === "invasive_plant_survey" ||
      observation.kind === "invasive_plant_observation",
  );
  const byTaxon = new Map<string, ReedyRiverObservation[]>();
  for (const observation of candidates) {
    const key = taxonKey(observation);
    byTaxon.set(key, [...(byTaxon.get(key) ?? []), observation]);
  }

  const findings: ReedyRiverFinding[] = [];
  const actions: ReedyRiverActionDraft[] = [];
  const recommendations: ReedyRiverProjectRecommendation[] = [];

  for (const [key, rows] of byTaxon.entries()) {
    const usableRows = rows.filter((row) => row.reviewStatus !== "rejected");
    if (!usableRows.length) continue;

    const expertRows = usableRows.filter((row) => row.reviewStatus === "expert_confirmed");
    const fieldRows = usableRows.filter((row) =>
      ["field_observed", "qa_passed", "expert_confirmed"].includes(row.reviewStatus),
    );
    const evidenceRows = fieldRows.filter((row) => evidenceCount(row) > 0);
    const corroborated =
      expertRows.length === 0 &&
      evidenceRows.length >= 2 &&
      distinctEvidenceObservers(evidenceRows) >= 2;
    const state: ReedyRiverFinding["state"] = expertRows.length
      ? "expert_confirmed"
      : corroborated
        ? "corroborated"
        : "candidate";
    const representative = expertRows[0] ?? fieldRows[0] ?? usableRows[0];
    if (!representative) continue;
    const sites = unique(usableRows.map((row) => row.siteId));
    const evidenceIds = usableRows.map((row) => row.observationId);
    const confidence = expertRows.length
      ? 0.98
      : corroborated
        ? clamp(0.65 + Math.min(0.25, evidenceRows.length * 0.05))
        : clamp(Math.max(...usableRows.map((row) => row.confidence ?? 0.45)) * 0.75);
    const regulated = usableRows.some((row) => row.taxon?.invasiveStatus === "regulated");
    const severity: ReedyRiverSeverity = regulated
      ? "high"
      : state === "expert_confirmed"
        ? "high"
        : state === "corroborated"
          ? "moderate"
          : "low";
    const label = taxonLabel(representative);

    findings.push({
      findingId: findingId("plant", `${key}:${state}`),
      category: "invasive_plant",
      state,
      severity,
      title:
        state === "expert_confirmed"
          ? `Expert-confirmed invasive plant record: ${label}`
          : state === "corroborated"
            ? `Corroborated invasive plant observations: ${label}`
            : `Invasive plant candidate awaiting botanical review: ${label}`,
      summary: `${usableRows.length} live observation(s) across ${sites.length} site(s). ${
        expertRows.length
          ? "An expert-confirmed record is present."
          : corroborated
            ? "Independent field evidence supports containment planning, but treatment still requires expert approval."
            : "The evidence is a candidate only and cannot authorize treatment."
      }`,
      confidence,
      siteIds: sites,
      evidenceObservationIds: evidenceIds,
      taxon: representative.taxon,
      limitations:
        state === "expert_confirmed"
          ? ["Treatment method and permitting remain separate operational decisions."]
          : [
              "Species identification is not expert-confirmed.",
              "Do not disturb or treat a suspected regulated plant before qualified review.",
            ],
    });

    const dueHours = severity === "high" ? 24 : state === "corroborated" ? 48 : 72;
    actions.push({
      fingerprint: actionFingerprint("invasive_plant", `${key}:${state}`, sites),
      category: "invasive_plant",
      priority: severity,
      title:
        state === "expert_confirmed"
          ? `Map boundary and prepare approved containment plan for ${label}`
          : `Obtain botanical verification for ${label}`,
      rationale:
        state === "expert_confirmed"
          ? "A confirmed record supports operational planning, but treatment must follow site approval, label requirements, and qualified supervision."
          : "DPAL will not convert a machine or field candidate into a removal project without qualified identification and mapped extent.",
      steps:
        state === "expert_confirmed"
          ? [
              "Confirm landowner/site authorization and any regulatory reporting duty.",
              "Map the infestation boundary and photograph fixed monitoring points.",
              "Select an approved control method with a qualified invasive-plant professional.",
              "Record treatment, disposal, and follow-up monitoring evidence in DPAL.",
            ]
          : [
              "Assign a qualified botanist or trained invasive-species reviewer.",
              "Review photographs, diagnostic features, season, and location context.",
              "Return to the site for voucher-quality evidence when identification is uncertain.",
              "Mark the record expert_confirmed or rejected before any treatment workflow begins.",
            ],
      ownerRole: state === "expert_confirmed" ? "Riparian restoration lead" : "Botanical reviewer",
      dueAt: new Date(windowEnd.getTime() + dueHours * 60 * 60 * 1000).toISOString(),
      evidenceObservationIds: evidenceIds,
      dependsOn: [],
      approvalRequired: true,
      safeToExecute: state === "expert_confirmed",
      recommendedInitialStatus: state === "expert_confirmed" ? "triaged" : "awaiting_expert",
      nextStep:
        state === "expert_confirmed"
          ? "Assign a restoration lead and secure site/treatment approval."
          : "Assign a botanical reviewer; do not remove or spray the plant yet.",
    });

    recommendations.push({
      recommendationId: recommendationId("invasive", key),
      title:
        state === "expert_confirmed"
          ? `${label} containment and follow-up monitoring project`
          : `${label} verification survey`,
      recommendationType: state === "expert_confirmed" ? "containment_planning" : "verification_survey",
      evidenceGate: state,
      rationale:
        state === "expert_confirmed"
          ? "The expert-confirmed record and live evidence make this location eligible for a scoped containment plan."
          : state === "corroborated"
            ? "Independent observations justify a focused verification survey and boundary mapping, but not treatment."
            : "A candidate record supports only a verification visit.",
      evidenceObservationIds: evidenceIds,
      requiresExpertApproval: true,
      implementationStatus:
        state === "expert_confirmed"
          ? "eligible_for_planning"
          : state === "corroborated"
            ? "verification_required"
            : "not_enough_evidence",
      nextDecision:
        state === "expert_confirmed"
          ? "Approve scope, land access, method, and follow-up schedule."
          : "Complete botanical review and update the evidence state.",
    });
  }

  return { findings, actions, recommendations };
}
