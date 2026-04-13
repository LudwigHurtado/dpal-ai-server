import mongoose, { Schema, Document } from "mongoose";

export interface ILocationPoint {
  lat: number;
  lng: number;
}

export interface ICarbonProject extends Document {
  projectId: string;
  ownerId: string;
  ownerName: string;
  projectName: string;
  projectType: "forest" | "reforestation" | "farm" | "wetland" | "methane" | "solar" | "mangrove" | "peatland" | "grassland" | "other";
  description: string;
  location: {
    country: string;
    region: string;
    city: string;
    gpsCenter: ILocationPoint;
    polygon: ILocationPoint[];
  };
  totalAcres: number;
  baselineDate: string;    // ISO date string
  baselineNdvi: number;    // 0–1, set after first satellite pull
  status: "submitted" | "monitoring" | "review" | "approved" | "rejected" | "listed";
  evidenceUrls: string[];
  adminNotes: string;
  createdAt: Date;
  updatedAt: Date;
}

const PointSchema = new Schema<ILocationPoint>(
  { lat: Number, lng: Number },
  { _id: false }
);

const CarbonProjectSchema = new Schema<ICarbonProject>(
  {
    projectId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    ownerName: { type: String, default: "Anonymous" },
    projectName: { type: String, required: true },
    projectType: {
      type: String,
      enum: ["forest", "reforestation", "farm", "wetland", "methane", "solar", "mangrove", "peatland", "grassland", "other"],
      default: "other",
    },
    description: { type: String, default: "" },
    location: {
      country: { type: String, default: "" },
      region: { type: String, default: "" },
      city: { type: String, default: "" },
      gpsCenter: { type: PointSchema, default: () => ({ lat: 0, lng: 0 }) },
      polygon: { type: [PointSchema], default: [] },
    },
    totalAcres: { type: Number, default: 0 },
    baselineDate: { type: String, default: "" },
    baselineNdvi: { type: Number, default: -1 },
    status: {
      type: String,
      enum: ["submitted", "monitoring", "review", "approved", "rejected", "listed"],
      default: "submitted",
    },
    evidenceUrls: { type: [String], default: [] },
    adminNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

CarbonProjectSchema.index({ status: 1, createdAt: -1 });

export const CarbonProject =
  mongoose.models.CarbonProject ||
  mongoose.model<ICarbonProject>("CarbonProject", CarbonProjectSchema);
