import mongoose, { Schema } from "mongoose";

export interface IMintRequest extends mongoose.Document {
  userId: string;
  assetDraftId: string;
  collectionId: string;
  priceCredits: number;
  chain: string;
  idempotencyKey: string;
  nonce: string;
  timestamp: number;
  signature?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MintRequestSchema = new Schema<IMintRequest>(
  {
    userId: { type: String, required: true, index: true },
    assetDraftId: { type: String, required: true },
    collectionId: { type: String, required: true },
    priceCredits: { type: Number, required: true },
    chain: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    nonce: { type: String, required: true },
    timestamp: { type: Number, required: true },
    signature: { type: String, required: false },
    status: { type: String, default: "PENDING", enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] },
    error: String,
  },
  { timestamps: true }
);

// Prevent replay by unique (userId, nonce)
MintRequestSchema.index({ userId: 1, nonce: 1 }, { unique: true });
MintRequestSchema.index({ status: 1, createdAt: -1 });

// Prevent model overwrite in dev / nodemon reloads
export const MintRequest =
  mongoose.models.MintRequest || mongoose.model<IMintRequest>("MintRequest", MintRequestSchema);
