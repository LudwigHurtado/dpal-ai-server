import mongoose, { Schema, type Document } from "mongoose";
import type {
  ReedyRiverEvidenceRef,
  ReedyRiverLocation,
  ReedyRiverProvenance,
  ReedyRiverReviewStatus,
  ReedyRiverSourceType,
  ReedyRiverTaxon,
} from "../features/reedyRiver/reedyRiver.types.js";

export interface IReedyRiverObservation extends Document {
  observationId: string;
  projectId: string;
  idempotencyKey: string;
  dataMode: "live";
  sourceType: ReedyRiverSourceType;
  sourceId: string;
  siteId: string;
  observedAt: Date;
  receivedAt: Date;
  kind: string;
  reviewStatus: ReedyRiverReviewStatus;
  confidence?: number;
  taxon?: ReedyRiverTaxon;
  data: Record<string, unknown>;
  evidence: ReedyRiverEvidenceRef[];
  location: ReedyRiverLocation;
  provenance: ReedyRiverProvenance;
  reviewHistory: Array<{
    at: Date;
    actorId: string;
    actorLabel: string;
    fromStatus: ReedyRiverReviewStatus;
    toStatus: ReedyRiverReviewStatus;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const SOURCE_TYPES: ReedyRiverSourceType[] = [
  "bioacoustic_sensor",
  "invasive_plant_survey",
  "water_quality_sensor",
  "hydrology_public_api",
  "camera_trap",
  "field_activity",
  "sensor_heartbeat",
  "weather_public_api",
  "other",
];

const REVIEW_STATUSES: ReedyRiverReviewStatus[] = [
  "machine_candidate",
  "field_observed",
  "qa_pending",
  "qa_passed",
  "expert_confirmed",
  "rejected",
];

const ReedyRiverObservationSchema = new Schema<IReedyRiverObservation>(
  {
    observationId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true },
    dataMode: { type: String, enum: ["live"], required: true, default: "live" },
    sourceType: { type: String, enum: SOURCE_TYPES, required: true, index: true },
    sourceId: { type: String, required: true, index: true },
    siteId: { type: String, required: true, index: true },
    observedAt: { type: Date, required: true, index: true },
    receivedAt: { type: Date, required: true, default: Date.now },
    kind: { type: String, required: true, index: true },
    reviewStatus: { type: String, enum: REVIEW_STATUSES, required: true, index: true },
    confidence: { type: Number, min: 0, max: 1 },
    taxon: { type: Schema.Types.Mixed },
    data: { type: Schema.Types.Mixed, required: true, default: {} },
    evidence: { type: [Schema.Types.Mixed] as any, required: true, default: [] },
    location: { type: Schema.Types.Mixed, required: true },
    provenance: { type: Schema.Types.Mixed, required: true },
    reviewHistory: { type: [Schema.Types.Mixed] as any, required: true, default: [] },
  },
  { timestamps: true, minimize: false },
);

ReedyRiverObservationSchema.index(
  { projectId: 1, sourceId: 1, idempotencyKey: 1 },
  { unique: true, name: "reedy_observation_idempotency" },
);
ReedyRiverObservationSchema.index({ projectId: 1, observedAt: -1 });
ReedyRiverObservationSchema.index({ projectId: 1, sourceType: 1, observedAt: -1 });
ReedyRiverObservationSchema.index({ projectId: 1, reviewStatus: 1, observedAt: -1 });

export const ReedyRiverObservationModel =
  mongoose.models.ReedyRiverObservation || mongoose.model<IReedyRiverObservation>("ReedyRiverObservation", ReedyRiverObservationSchema);
