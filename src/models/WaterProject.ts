import mongoose, { Schema, Document } from "mongoose";

export interface ILocationPoint {
  lat: number;
  lng: number;
}

export interface IWaterProject extends Document {
  projectId: string;
  ownerId: string;
  ownerName: string;
  projectName: string;
  projectType:
    | "farm_irrigation"
    | "reservoir_monitoring"
    | "wetland_restoration"
    | "leak_reduction"
    | "community_conservation"
    | "drought_response"
    | "school_or_facility_savings"
    | "other";
  description: string;
  location: {
    country: string;
    region: string;
    city: string;
    gpsCenter: ILocationPoint;
    polygon: ILocationPoint[];
  };
  totalAcres: number;
  baselineDate: string;
  improvementGoal: string;
  status:
    | "draft"
    | "submitted"
    | "monitoring"
    | "under_review"
    | "approved"
    | "rejected"
    | "credited";
  baselineWaterIndex: number;
  evidenceUrls: string[];
  adminNotes: string;
  createdAt: Date;
  updatedAt: Date;
}

const PointSchema = new Schema<ILocationPoint>(
  { lat: Number, lng: Number },
  { _id: false }
);

const WaterProjectSchema = new Schema<IWaterProject>(
  {
    projectId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true, default: "demo-user-001" },
    ownerName: { type: String, default: "Anonymous" },
    projectName: { type: String, required: true },
    projectType: {
      type: String,
      enum: [
        "farm_irrigation",
        "reservoir_monitoring",
        "wetland_restoration",
        "leak_reduction",
        "community_conservation",
        "drought_response",
        "school_or_facility_savings",
        "other",
      ],
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
    improvementGoal: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "monitoring",
        "under_review",
        "approved",
        "rejected",
        "credited",
      ],
      default: "submitted",
    },
    baselineWaterIndex: { type: Number, default: 0 },
    evidenceUrls: { type: [String], default: [] },
    adminNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

WaterProjectSchema.index({ status: 1, createdAt: -1 });

export const WaterProject =
  mongoose.models.WaterProject ||
  mongoose.model<IWaterProject>("WaterProject", WaterProjectSchema);
