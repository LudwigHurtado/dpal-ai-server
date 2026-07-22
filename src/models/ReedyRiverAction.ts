import mongoose, { Schema, type Document } from "mongoose";
import type {
  ReedyRiverActionHistoryEntry,
  ReedyRiverActionStatus,
  ReedyRiverFinding,
  ReedyRiverSeverity,
} from "../features/reedyRiver/reedyRiver.types.js";

export interface IReedyRiverAction extends Document {
  actionId: string;
  projectId: string;
  fingerprint: string;
  category: ReedyRiverFinding["category"];
  priority: ReedyRiverSeverity;
  title: string;
  rationale: string;
  steps: string[];
  ownerRole: string;
  assignedTo?: string;
  assignedToLabel?: string;
  dueAt: Date;
  evidenceObservationIds: string[];
  dependsOn: string[];
  approvalRequired: boolean;
  safeToExecute: boolean;
  status: ReedyRiverActionStatus;
  nextStep: string;
  sourceReportIds: string[];
  history: ReedyRiverActionHistoryEntry[];
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ACTION_STATUSES: ReedyRiverActionStatus[] = [
  "proposed",
  "triaged",
  "assigned",
  "in_progress",
  "awaiting_expert",
  "blocked",
  "completed",
  "dismissed",
];

const ReedyRiverActionSchema = new Schema<IReedyRiverAction>(
  {
    actionId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    fingerprint: { type: String, required: true },
    category: { type: String, required: true, index: true },
    priority: {
      type: String,
      enum: ["info", "low", "moderate", "high", "critical"],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    rationale: { type: String, required: true },
    steps: { type: [String], required: true, default: [] },
    ownerRole: { type: String, required: true },
    assignedTo: { type: String },
    assignedToLabel: { type: String },
    dueAt: { type: Date, required: true, index: true },
    evidenceObservationIds: { type: [String], required: true, default: [] },
    dependsOn: { type: [String], required: true, default: [] },
    approvalRequired: { type: Boolean, required: true, default: false },
    safeToExecute: { type: Boolean, required: true, default: false },
    status: { type: String, enum: ACTION_STATUSES, required: true, index: true },
    nextStep: { type: String, required: true },
    sourceReportIds: { type: [String], required: true, default: [] },
    history: { type: [Schema.Types.Mixed], required: true, default: [] },
    resolutionNote: { type: String },
  },
  { timestamps: true, minimize: false },
);

ReedyRiverActionSchema.index(
  { projectId: 1, fingerprint: 1 },
  { unique: true, name: "reedy_action_fingerprint" },
);
ReedyRiverActionSchema.index({ projectId: 1, status: 1, priority: -1, dueAt: 1 });

export const ReedyRiverActionModel =
  mongoose.models.ReedyRiverAction || mongoose.model<IReedyRiverAction>("ReedyRiverAction", ReedyRiverActionSchema);
