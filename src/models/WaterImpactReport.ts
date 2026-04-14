import mongoose, { Schema, Document } from "mongoose";

export interface IWaterComponentScores {
  baselineImprovement: number;
  moistureStability: number;
  droughtRiskReduction: number;
  proofCompleteness: number;
  validatorConfidence: number;
}

export interface IWaterImpactReport extends Document {
  reportId: string;
  projectId: string;
  periodStart: string;
  periodEnd: string;
  waterImpactScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  findings: string[];
  recommendation: string;
  componentScores: IWaterComponentScores;
  eligibleForCredits: boolean;
  validatorStatus: "pending" | "approved" | "rejected" | "needs_evidence";
  validatorNotes: string;
  createdAt: Date;
}

const ComponentScoresSchema = new Schema<IWaterComponentScores>(
  {
    baselineImprovement: { type: Number, default: 0 },
    moistureStability: { type: Number, default: 0 },
    droughtRiskReduction: { type: Number, default: 0 },
    proofCompleteness: { type: Number, default: 0 },
    validatorConfidence: { type: Number, default: 0 },
  },
  { _id: false }
);

const WaterImpactReportSchema = new Schema<IWaterImpactReport>(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    waterImpactScore: { type: Number, default: 0, min: 0, max: 100 },
    grade: {
      type: String,
      enum: ["A", "B", "C", "D", "F"],
      default: "F",
    },
    summary: { type: String, default: "" },
    findings: { type: [String], default: [] },
    recommendation: { type: String, default: "" },
    componentScores: {
      type: ComponentScoresSchema,
      default: () => ({
        baselineImprovement: 0,
        moistureStability: 0,
        droughtRiskReduction: 0,
        proofCompleteness: 0,
        validatorConfidence: 0,
      }),
    },
    eligibleForCredits: { type: Boolean, default: false },
    validatorStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "needs_evidence"],
      default: "pending",
    },
    validatorNotes: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

WaterImpactReportSchema.index({ projectId: 1, createdAt: -1 });
WaterImpactReportSchema.index({ validatorStatus: 1 });

export const WaterImpactReport =
  mongoose.models.WaterImpactReport ||
  mongoose.model<IWaterImpactReport>("WaterImpactReport", WaterImpactReportSchema);
