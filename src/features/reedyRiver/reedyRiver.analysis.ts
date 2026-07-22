import {
  REEDY_RIVER_PROJECT_ID,
  type ReedyRiverReportDraft,
} from "./reedyRiver.types.js";
import {
  DEFAULT_EXPECTED_SOURCES,
  SEVERITY_RANK,
  alignToThreeHourWindow,
  buildSourceStatus,
  lastCompletedThreeHourWindow,
  safeDate,
  unique,
  type AnalyzeReedyRiverInput,
} from "./reedyRiver.analysis.shared.js";
import { analyzeInvasivePlants } from "./reedyRiver.analysis.plants.js";
import { analyzeBioacoustics } from "./reedyRiver.analysis.bioacoustics.js";
import { analyzeWater } from "./reedyRiver.analysis.water.js";
import { analyzeActivities } from "./reedyRiver.analysis.activities.js";
import { buildDataGapActions } from "./reedyRiver.analysis.gaps.js";

export { alignToThreeHourWindow, lastCompletedThreeHourWindow };
export type { AnalyzeReedyRiverInput };

export function analyzeReedyRiverWindow(input: AnalyzeReedyRiverInput): ReedyRiverReportDraft {
  const now = input.now ?? new Date();
  const expectedSources = input.expectedSources?.length
    ? unique(input.expectedSources)
    : DEFAULT_EXPECTED_SOURCES;
  const unavailableSources = input.unavailableSources ?? {};
  const staleAfterMinutes = Math.max(15, input.staleAfterMinutes ?? 240);
  const observations = input.observations
    .filter((observation) => observation.dataMode === "live")
    .filter((observation) => {
      const observedAt = safeDate(observation.observedAt);
      return (
        observedAt !== null &&
        observedAt.getTime() >= input.windowStart.getTime() &&
        observedAt.getTime() < input.windowEnd.getTime()
      );
    });

  const sourceStatus = buildSourceStatus(
    observations,
    expectedSources,
    unavailableSources,
    now,
    staleAfterMinutes,
  );
  const plants = analyzeInvasivePlants(observations, input.windowEnd);
  const acoustics = analyzeBioacoustics(observations, input.windowEnd);
  const water = analyzeWater(observations, input.windowEnd);
  const activities = analyzeActivities(observations, input.windowEnd);
  const gaps = buildDataGapActions(sourceStatus, input.windowEnd);

  const findings = [
    ...plants.findings,
    ...acoustics.findings,
    ...water.findings,
    ...activities.findings,
    ...gaps.findings,
  ].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  const actionDrafts = [
    ...plants.actions,
    ...acoustics.actions,
    ...water.actions,
    ...activities.actions,
    ...gaps.actions,
  ].sort((a, b) => SEVERITY_RANK[b.priority] - SEVERITY_RANK[a.priority]);

  const projectRecommendations = [
    ...plants.recommendations,
    ...acoustics.recommendations,
    ...water.recommendations,
    ...activities.recommendations,
  ];

  const invasivePlantObservations = observations.filter(
    (observation) =>
      observation.sourceType === "invasive_plant_survey" ||
      observation.kind === "invasive_plant_observation",
  ).length;
  const bioacousticDetections = observations.filter(
    (observation) =>
      observation.sourceType === "bioacoustic_sensor" ||
      observation.kind === "bioacoustic_detection",
  ).length;
  const waterMeasurements = observations.filter((observation) =>
    ["water_quality_sensor", "hydrology_public_api"].includes(observation.sourceType),
  ).length;
  const fieldActivities = observations.filter(
    (observation) => observation.sourceType === "field_activity" || observation.kind === "field_activity",
  ).length;
  const expertConfirmedRecords = observations.filter(
    (observation) => observation.reviewStatus === "expert_confirmed",
  ).length;
  const candidateRecords = observations.filter((observation) =>
    ["machine_candidate", "qa_pending"].includes(observation.reviewStatus),
  ).length;
  const activeSites = unique(observations.map((observation) => observation.siteId)).length;

  const sourceProblems = sourceStatus.filter((source) => source.state !== "live").length;
  const status: ReedyRiverReportDraft["status"] = observations.length === 0
    ? "insufficient_data"
    : sourceProblems > 0
      ? "partial"
      : "complete";

  const substantiveFindings = findings.filter((finding) => finding.category !== "data_gap");
  const deterministicSummary = observations.length === 0
    ? "No live observations were available in this three-hour window. DPAL generated monitoring-recovery actions only and made no ecological project recommendation."
    : `${observations.length} live observation(s) from ${activeSites} site(s) produced ${substantiveFindings.length} evidence-based finding(s) and ${actionDrafts.length} workflow action(s). ${expertConfirmedRecords} record(s) are expert-confirmed; machine candidates remain pending review.`;

  return {
    projectId: REEDY_RIVER_PROJECT_ID,
    windowStart: input.windowStart.toISOString(),
    windowEnd: input.windowEnd.toISOString(),
    generatedAt: now.toISOString(),
    status,
    dataPolicy: "live_only",
    metrics: {
      totalObservations: observations.length,
      invasivePlantObservations,
      bioacousticDetections,
      waterMeasurements,
      fieldActivities,
      expertConfirmedRecords,
      candidateRecords,
      activeSites,
    },
    sourceStatus,
    findings,
    actionDrafts,
    projectRecommendations,
    deterministicSummary,
    caveats: [
      "DPAL separates machine candidates, field observations, QA-passed records, and expert-confirmed evidence.",
      "AI narrative cannot add findings, species confirmations, threshold exceedances, or projects that are absent from the deterministic evidence tables.",
      "Exact coordinates and restricted evidence links are not included in public report responses.",
      "Operational recommendations require the approvals stated on each action and do not replace regulatory, landowner, safety, or professional requirements.",
    ],
  };
}
