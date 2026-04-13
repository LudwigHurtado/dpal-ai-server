import mongoose, { Schema, Document } from "mongoose";

export interface IOffsetPurchase extends Document {
  purchaseId: string;
  projectId: string;
  projectName: string;
  userId: string;           // wallet / hero id
  userName: string;
  units: number;            // tCO2e bought
  pricePerTonne: number;
  totalUsd: number;
  coinsSpent: number;
  retired: boolean;
  retiredAt?: number;
  certificateHash?: string;
  isGroupPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OffsetPurchaseSchema = new Schema<IOffsetPurchase>(
  {
    purchaseId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    projectName: { type: String, default: "" },
    userId: { type: String, required: true, index: true },
    userName: { type: String, default: "Anonymous" },
    units: { type: Number, required: true },
    pricePerTonne: { type: Number, required: true },
    totalUsd: { type: Number, required: true },
    coinsSpent: { type: Number, default: 0 },
    retired: { type: Boolean, default: false },
    retiredAt: { type: Number },
    certificateHash: { type: String },
    isGroupPurchase: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const OffsetPurchase =
  mongoose.models.OffsetPurchase ||
  mongoose.model<IOffsetPurchase>("OffsetPurchase", OffsetPurchaseSchema);
