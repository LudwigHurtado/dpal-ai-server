import mongoose, { Schema, Document } from "mongoose";

export interface IGreenParcel extends Document {
  parcelId: string;
  ownerName: string;
  ownerEmail: string;
  heroId?: string;
  country: string;
  region: string;
  totalAcres: number;
  ecosystemType: string;
  lat: number;
  lng: number;
  description: string;
  sectorSizeAcres: number;
  sectorCount: number;
  creditEstimatePerYear: number; // tCO2e/year total
  status: "pending" | "under_review" | "approved" | "active" | "suspended";
  proofDocUrl: string;
  adminNotes: string;
  submittedAt: number;
  approvedAt?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Sequestration rates tCO2e / acre / year by ecosystem
export const SEQ_RATES: Record<string, number> = {
  tropical_forest: 3.5,
  boreal_forest: 1.8,
  temperate_forest: 2.2,
  mangrove: 5.5,
  peatland: 4.0,
  savanna: 0.8,
  grassland: 0.6,
  cloud_forest: 3.0,
  tidal_marsh: 4.5,
  desert: 0.3,
  wetland: 3.8,
};

const GreenParcelSchema = new Schema<IGreenParcel>(
  {
    parcelId: { type: String, required: true, unique: true, index: true },
    ownerName: { type: String, required: true },
    ownerEmail: { type: String, default: "" },
    heroId: { type: String, default: "" },
    country: { type: String, required: true },
    region: { type: String, default: "" },
    totalAcres: { type: Number, required: true, min: 1 },
    ecosystemType: { type: String, required: true, enum: Object.keys(SEQ_RATES) },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    description: { type: String, default: "" },
    sectorSizeAcres: { type: Number, default: 100 },
    sectorCount: { type: Number, default: 1 },
    creditEstimatePerYear: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "active", "suspended"],
      default: "pending",
    },
    proofDocUrl: { type: String, default: "" },
    adminNotes: { type: String, default: "" },
    submittedAt: { type: Number, required: true },
    approvedAt: { type: Number },
  },
  { timestamps: true }
);

GreenParcelSchema.index({ status: 1, createdAt: -1 });
GreenParcelSchema.index({ heroId: 1 });

export const GreenParcel =
  mongoose.models.GreenParcel ||
  mongoose.model<IGreenParcel>("GreenParcel", GreenParcelSchema);
