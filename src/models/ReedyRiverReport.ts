import mongoose, { Schema, type Document } from "mongoose";
import type {
  ReedyRiverAiNarrative,
  ReedyRiverFinding,
  ReedyRiverProjectRecommendation,
  ReedyRiverSourceStatus,
} from "../features/reedyRiver/reedyRiver.types.js";

export interface IReedyRiverReport extends Document {
  reportId: string;
  projectId: string;
  windowStart: Date;
  windowEnd: Date;
  generatedAt: Date;
  status: "complete" | "partial" | "insufficient_data";
  dataPolicy: "live_only";
  metrics: Record<string, number>;
  sourceStatus: ReedyRiverSourceStatus[];
  findings: ReedyRiverFinding[];
  actionIds: string[];
  projectRecommendations: ReedyRiverProjectRecommendation[];
  deterministicSummary: string;
  aiNarrative: ReedyRiverAiNarrative;
  caveats: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReedyRiverReportSchema = new Schema<IReedyRiverReport>(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    windowStart: { type: Date, required: true, index: true },
    windowEnd: { type: Date, required: true, index: true },
    generatedAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ["complete", "partial", "insufficient_data"],
      required: true,
    },
    dataPolicy: { type: String, enum: ["live_only"], required: true, default: "live_only" },
    metrics: { type: Schema.Types.Mixed, required: true },
    sourceStatus: { type: [Schema.Types.Mixed] as any, required: true, default: [] },
    findings: { type: [Schema.Types.Mixed] as any, required: true, default: [] },
    actionIds: { type: [String], required: true, default: [] },
    projectRecommendations: { type: [Schema.Types.Mixed] as any, required: true, default: [] },
    deterministicSummary: { type: String, required: true },
    aiNarrative: { type: Schema.Types.Mixed, required: true },
    caveats: { type: [String], required: true, default: [] },
  },
  { timestamps: true, minimize: false },
);

ReedyRiverReportSchema.index(
  { projectId: 1, windowStart: 1, windowEnd: 1 },
  { unique: true, name: "reedy_report_window" },
);
ReedyRiverReportSchema.index({ projectId: 1, windowEnd: -1 });

export const ReedyRiverReportModel =
  mongoose.models.ReedyRiverReport || mongoose.model<IReedyRiverReport>("ReedyRiverReport", ReedyRiverReportSchema);
