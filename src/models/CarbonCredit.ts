import mongoose, { Schema, Document } from "mongoose";

export interface ICarbonCredit extends Document {
  creditId: string;
  projectId: string;
  projectName: string;
  reportId: string;
  issuedTo: string;         // ownerId
  issuedToName: string;
  creditAmountTons: number;
  verificationStatus: "pending" | "verified" | "rejected";
  validatorId: string;
  blockchainHash: string;
  marketplaceStatus: "not_listed" | "listed" | "sold" | "retired";
  pricePerTon: number;
  buyerId: string;
  buyerName: string;
  retiredAt?: number;
  retiredBy?: string;
  retirementCertHash?: string;
  issuedAt: number;
  listedAt?: number;
  soldAt?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CarbonCreditSchema = new Schema<ICarbonCredit>(
  {
    creditId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    projectName: { type: String, default: "" },
    reportId: { type: String, default: "" },
    issuedTo: { type: String, required: true, index: true },
    issuedToName: { type: String, default: "Anonymous" },
    creditAmountTons: { type: Number, required: true },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    validatorId: { type: String, default: "" },
    blockchainHash: { type: String, default: "" },
    marketplaceStatus: {
      type: String,
      enum: ["not_listed", "listed", "sold", "retired"],
      default: "not_listed",
    },
    pricePerTon: { type: Number, default: 0 },
    buyerId: { type: String, default: "" },
    buyerName: { type: String, default: "" },
    retiredAt: { type: Number },
    retiredBy: { type: String },
    retirementCertHash: { type: String },
    issuedAt: { type: Number, required: true },
    listedAt: { type: Number },
    soldAt: { type: Number },
  },
  { timestamps: true }
);

CarbonCreditSchema.index({ marketplaceStatus: 1, verificationStatus: 1 });
CarbonCreditSchema.index({ issuedTo: 1, marketplaceStatus: 1 });

export const CarbonCredit =
  mongoose.models.CarbonCredit ||
  mongoose.model<ICarbonCredit>("CarbonCredit", CarbonCreditSchema);
