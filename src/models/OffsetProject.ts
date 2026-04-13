import mongoose, { Schema, Document } from "mongoose";

export interface IPricePoint {
  date: number;
  priceUsd: number;
}

export interface IOffsetProject extends Document {
  projectId: string;
  name: string;
  location: string;
  address: string;
  siteUrl: string;
  imageUrl: string;
  totalUnits: number;       // total tCO2e available
  availableUnits: number;   // remaining for sale
  retiredUnits: number;     // permanently cancelled
  pricePerTonne: number;    // USD
  status: "Verified" | "In Progress" | "Needs Review";
  mission: string;
  description: string;
  credibilityScore: number; // 0-100, AI-generated
  credibilityNote: string;
  groupTarget: number;      // tCO2e target for group buy
  groupFunded: number;      // tCO2e funded so far by community
  coalitionCount: number;   // members who joined
  priceHistory: IPricePoint[];
  createdAt: Date;
  updatedAt: Date;
}

const PricePointSchema = new Schema<IPricePoint>(
  { date: { type: Number, required: true }, priceUsd: { type: Number, required: true } },
  { _id: false }
);

const OffsetProjectSchema = new Schema<IOffsetProject>(
  {
    projectId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    location: { type: String, default: "" },
    address: { type: String, default: "" },
    siteUrl: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    totalUnits: { type: Number, default: 0 },
    availableUnits: { type: Number, default: 0 },
    retiredUnits: { type: Number, default: 0 },
    pricePerTonne: { type: Number, default: 12 },
    status: { type: String, enum: ["Verified", "In Progress", "Needs Review"], default: "In Progress" },
    mission: { type: String, default: "" },
    description: { type: String, default: "" },
    credibilityScore: { type: Number, default: 0 },
    credibilityNote: { type: String, default: "" },
    groupTarget: { type: Number, default: 0 },
    groupFunded: { type: Number, default: 0 },
    coalitionCount: { type: Number, default: 0 },
    priceHistory: { type: [PricePointSchema], default: [] },
  },
  { timestamps: true }
);

export const OffsetProject =
  mongoose.models.OffsetProject ||
  mongoose.model<IOffsetProject>("OffsetProject", OffsetProjectSchema);
