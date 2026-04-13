import mongoose, { Schema, Document } from "mongoose";

/**
 * DPAL Carbon Score Formula:
 *   carbonScore =
 *     ndviImprovement    * 40  (vegetation growth vs baseline)
 *   + protectedAreaScore * 25  (no deforestation alerts)
 *   + noDeforestationScore * 20
 *   + validatorTrustScore * 15
 *
 * Range: 0–100
 */
export interface IMRVReport extends Document {
  reportId: string;
  projectId: string;
  snapshotId: string;          // satellite snapshot used
  reportDate: string;          // ISO date
  // DPAL Carbon Score components
  ndviImprovement: number;     // 0–1 → weighted to 40pts
  protectedAreaScore: number;  // 0–1 → weighted to 25pts
  noDeforestationScore: number;// 0–1 → weighted to 20pts
  validatorTrustScore: number; // 0–1 → weighted to 15pts
  carbonScore: number;         // 0–100 final
  creditEstimateTons: number;  // estimated carbon credits based on score + acres
  riskLevel: "low" | "medium" | "high";
  aiSummary: string;
  status: "draft" | "submitted" | "validated" | "rejected";
  validatorId: string;
  validatorNotes: string;
  validatedAt?: number;
  createdAt: Date;
  updatedAt: Date;
}

const MRVReportSchema = new Schema<IMRVReport>(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    snapshotId: { type: String, default: "" },
    reportDate: { type: String, required: true },
    ndviImprovement: { type: Number, default: 0 },
    protectedAreaScore: { type: Number, default: 0 },
    noDeforestationScore: { type: Number, default: 0 },
    validatorTrustScore: { type: Number, default: 0 },
    carbonScore: { type: Number, default: 0 },
    creditEstimateTons: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    aiSummary: { type: String, default: "" },
    status: { type: String, enum: ["draft", "submitted", "validated", "rejected"], default: "draft" },
    validatorId: { type: String, default: "" },
    validatorNotes: { type: String, default: "" },
    validatedAt: { type: Number },
  },
  { timestamps: true }
);

MRVReportSchema.index({ projectId: 1, reportDate: -1 });
MRVReportSchema.index({ status: 1 });

export const MRVReport =
  mongoose.models.MRVReport ||
  mongoose.model<IMRVReport>("MRVReport", MRVReportSchema);
