import mongoose, { Schema, Document } from "mongoose";

export interface IValidatorReview extends Document {
  reviewId: string;
  projectId: string;
  reportId: string;
  validatorId: string;
  validatorName: string;
  decision: "pending" | "approved" | "rejected" | "needs_more_info";
  trustScore: number;       // 0–1 validator's confidence
  notes: string;
  proofUrls: string[];
  reviewedAt: number;
  createdAt: Date;
  updatedAt: Date;
}

const ValidatorReviewSchema = new Schema<IValidatorReview>(
  {
    reviewId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    reportId: { type: String, required: true },
    validatorId: { type: String, required: true },
    validatorName: { type: String, default: "Anonymous" },
    decision: {
      type: String,
      enum: ["pending", "approved", "rejected", "needs_more_info"],
      default: "pending",
    },
    trustScore: { type: Number, default: 0.5, min: 0, max: 1 },
    notes: { type: String, default: "" },
    proofUrls: { type: [String], default: [] },
    reviewedAt: { type: Number, required: true },
  },
  { timestamps: true }
);

ValidatorReviewSchema.index({ reportId: 1 });
ValidatorReviewSchema.index({ validatorId: 1, decision: 1 });

export const ValidatorReview =
  mongoose.models.ValidatorReview ||
  mongoose.model<IValidatorReview>("ValidatorReview", ValidatorReviewSchema);
