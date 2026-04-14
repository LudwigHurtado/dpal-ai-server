import mongoose, { Schema, Document } from "mongoose";

export interface IWaterCredit extends Document {
  creditId: string;
  projectId: string;
  creditType: "DPAL_VERIFIED_WATER_IMPACT";
  amountKiloLitres: number;
  verificationStatus: "pending" | "verified" | "rejected";
  issuedAt: number;
  blockchainHash: string;
  marketplaceStatus: "not_listed" | "listed" | "retired";
  retiredAt?: number;
  retirementCertHash?: string;
  ownerId: string;
  ownerName: string;
  pricePerKL?: number;
  createdAt: Date;
  updatedAt: Date;
}

const WaterCreditSchema = new Schema<IWaterCredit>(
  {
    creditId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    creditType: {
      type: String,
      enum: ["DPAL_VERIFIED_WATER_IMPACT"],
      default: "DPAL_VERIFIED_WATER_IMPACT",
    },
    amountKiloLitres: { type: Number, required: true },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "verified",
    },
    issuedAt: { type: Number, required: true },
    blockchainHash: { type: String, default: "" },
    marketplaceStatus: {
      type: String,
      enum: ["not_listed", "listed", "retired"],
      default: "not_listed",
    },
    retiredAt: { type: Number },
    retirementCertHash: { type: String },
    ownerId: { type: String, required: true, index: true },
    ownerName: { type: String, default: "Anonymous" },
    pricePerKL: { type: Number },
  },
  { timestamps: true }
);

WaterCreditSchema.index({ marketplaceStatus: 1, verificationStatus: 1 });
WaterCreditSchema.index({ ownerId: 1, marketplaceStatus: 1 });

export const WaterCredit =
  mongoose.models.WaterCredit ||
  mongoose.model<IWaterCredit>("WaterCredit", WaterCreditSchema);
