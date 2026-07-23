export const REEDY_RIVER_PROJECT_ID = "reedy-river-sc";
export const REEDY_RIVER_REPORT_INTERVAL_MS = 3 * 60 * 60 * 1000;

export type ReedyRiverSourceType =
  | "bioacoustic_sensor"
  | "invasive_plant_survey"
  | "water_quality_sensor"
  | "hydrology_public_api"
  | "camera_trap"
  | "field_activity"
  | "sensor_heartbeat"
  | "weather_public_api"
  | "other";

export type ReedyRiverReviewStatus =
  | "machine_candidate"
  | "field_observed"
  | "qa_pending"
  | "qa_passed"
  | "expert_confirmed"
  | "rejected";

export type ReedyRiverSourceState = "live" | "stale" | "unavailable" | "not_connected";
export type ReedyRiverSeverity = "info" | "low" | "moderate" | "high" | "critical";
export type ReedyRiverFindingState = "candidate" | "corroborated" | "expert_confirmed" | "data_gap";

export type ReedyRiverActionStatus =
  | "proposed"
  | "triaged"
  | "assigned"
  | "in_progress"
  | "awaiting_expert"
  | "blocked"
  | "completed"
  | "dismissed";

export type ReedyRiverExecutionApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "invalidated";

export type ReedyRiverCompletionGate =
  | "none"
  | "evidence_review_resolved"
  | "expert_confirmation_or_rejection";

export interface ReedyRiverTaxon {
  commonName?: string;
  scientificName?: string;
  taxonId?: string;
  invasiveStatus?: "watchlist" | "regulated" | "suspected" | "not_applicable";
}

export interface ReedyRiverEvidenceRef {
  uri?: string;
  sha256?: string;
  mimeType?: string;
  capturedAt?: string;
  restricted?: boolean;
}

export interface ReedyRiverLocation {
  publicLabel: string;
  latitude?: number;
  longitude?: number;
  precisionMeters?: number;
}

export interface ReedyRiverProvenance {
  provider: string;
  method: string;
  collectedBy?: string;
  deviceModel?: string;
  modelName?: string;
  modelVersion?: string;
  sourceUrl?: string;
  license?: string;
  retrievedAt?: string;
}

export interface ReedyRiverObservationInput {
  observationId?: string;
  projectId?: string;
  idempotencyKey: string;
  dataMode: "live";
  sourceType: ReedyRiverSourceType;
  sourceId: string;
  siteId: string;
  observedAt: string;
  kind: string;
  reviewStatus: ReedyRiverReviewStatus;
  confidence?: number;
  taxon?: ReedyRiverTaxon;
  data: Record<string, unknown>;
  evidence?: ReedyRiverEvidenceRef[];
  location: ReedyRiverLocation;
  provenance: ReedyRiverProvenance;
}

export interface ReedyRiverObservation extends ReedyRiverObservationInput {
  observationId: string;
  projectId: string;
  receivedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReedyRiverSourceStatus {
  sourceType: ReedyRiverSourceType;
  label: string;
  state: ReedyRiverSourceState;
  recordCount: number;
  latestObservedAt?: string;
  freshnessMinutes?: number;
  message: string;
  provider?: string;
  sourceUrl?: string;
}

export interface ReedyRiverFinding {
  findingId: string;
  category: "invasive_plant" | "bioacoustic" | "water" | "activity" | "sensor_health" | "data_gap";
  state: ReedyRiverFindingState;
  severity: ReedyRiverSeverity;
  title: string;
  summary: string;
  confidence: number;
  siteIds: string[];
  evidenceObservationIds: string[];
  taxon?: ReedyRiverTaxon;
  limitations: string[];
}

export interface ReedyRiverActionDraft {
  fingerprint: string;
  category: ReedyRiverFinding["category"];
  priority: ReedyRiverSeverity;
  title: string;
  rationale: string;
  steps: string[];
  ownerRole: string;
  dueAt: string;
  evidenceObservationIds: string[];
  dependsOn: string[];
  approvalRequired: boolean;
  safeToExecute: boolean;
  completionGate?: ReedyRiverCompletionGate;
  recommendedInitialStatus: ReedyRiverActionStatus;
  nextStep: string;
}

export interface ReedyRiverProjectRecommendation {
  recommendationId: string;
  title: string;
  recommendationType:
    | "verification_survey"
    | "containment_planning"
    | "riparian_restoration"
    | "sensor_repair"
    | "water_quality_investigation"
    | "disturbance_inspection";
  evidenceGate: ReedyRiverFindingState;
  rationale: string;
  evidenceObservationIds: string[];
  requiresExpertApproval: boolean;
  implementationStatus: "eligible_for_planning" | "verification_required" | "not_enough_evidence";
  nextDecision: string;
}

export interface ReedyRiverReportDraft {
  projectId: string;
  windowStart: string;
  windowEnd: string;
  generatedAt: string;
  status: "complete" | "partial" | "insufficient_data";
  dataPolicy: "live_only";
  metrics: {
    totalObservations: number;
    invasivePlantObservations: number;
    bioacousticDetections: number;
    waterMeasurements: number;
    fieldActivities: number;
    expertConfirmedRecords: number;
    candidateRecords: number;
    activeSites: number;
  };
  sourceStatus: ReedyRiverSourceStatus[];
  findings: ReedyRiverFinding[];
  actionDrafts: ReedyRiverActionDraft[];
  projectRecommendations: ReedyRiverProjectRecommendation[];
  deterministicSummary: string;
  caveats: string[];
}

export interface ReedyRiverAiNarrative {
  used: boolean;
  provider: "gemini" | "deterministic";
  model?: string;
  generatedAt: string;
  executiveSummary: string;
  operatingNotes: string[];
  promptHash?: string;
  error?: string;
}

export interface ReedyRiverReportRecord extends ReedyRiverReportDraft {
  reportId: string;
  actionIds: string[];
  aiNarrative: ReedyRiverAiNarrative;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReedyRiverActionHistoryEntry {
  at: string;
  actorId: string;
  actorLabel: string;
  eventType?: "transition" | "execution_approval";
  fromStatus?: ReedyRiverActionStatus;
  toStatus: ReedyRiverActionStatus;
  approvalDecision?: "approved" | "rejected" | "invalidated";
  approvalBasisHash?: string;
  note?: string;
}

export interface ReedyRiverActionRecord extends ReedyRiverActionDraft {
  actionId: string;
  projectId: string;
  status: ReedyRiverActionStatus;
  assignedTo?: string;
  assignedToLabel?: string;
  completionGate: ReedyRiverCompletionGate;
  executionApprovalStatus: ReedyRiverExecutionApprovalStatus;
  executionApprovalBasisHash?: string;
  executionApprovedAt?: string;
  executionApprovedBy?: string;
  executionApprovedByLabel?: string;
  executionApprovalNote?: string;
  sourceReportIds: string[];
  history: ReedyRiverActionHistoryEntry[];
  resolutionNote?: string;
  createdAt?: string;
  updatedAt?: string;
}
