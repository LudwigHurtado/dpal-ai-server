import mongoose, { Schema, Document } from "mongoose";

export interface ISatelliteSnapshot extends Document {
  snapshotId: string;
  projectId: string;
  provider: "NASA" | "Copernicus" | "GoogleEarthEngine" | "Simulated";
  imageUrl: string;
  thumbnailUrl: string;
  captureDate: string;       // ISO date
  ndviScore: number;         // Normalized Difference Vegetation Index 0–1
  ndviPrevious: number;      // prior snapshot NDVI (for delta calc)
  ndviChange: number;        // ndviScore - ndviPrevious
  landCoverType: string;
  vegetationChangePercent: number;
  deforestationAlert: boolean;
  cloudCoverPercent: number;
  rawMetadata: Record<string, unknown>;
  isBaseline: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SatelliteSnapshotSchema = new Schema<ISatelliteSnapshot>(
  {
    snapshotId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    provider: {
      type: String,
      enum: ["NASA", "Copernicus", "GoogleEarthEngine", "Simulated"],
      default: "Simulated",
    },
    imageUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    captureDate: { type: String, required: true },
    ndviScore: { type: Number, default: 0 },
    ndviPrevious: { type: Number, default: -1 },
    ndviChange: { type: Number, default: 0 },
    landCoverType: { type: String, default: "unknown" },
    vegetationChangePercent: { type: Number, default: 0 },
    deforestationAlert: { type: Boolean, default: false },
    cloudCoverPercent: { type: Number, default: 0 },
    rawMetadata: { type: Schema.Types.Mixed, default: {} },
    isBaseline: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SatelliteSnapshotSchema.index({ projectId: 1, captureDate: -1 });

export const SatelliteSnapshot =
  mongoose.models.SatelliteSnapshot ||
  mongoose.model<ISatelliteSnapshot>("SatelliteSnapshot", SatelliteSnapshotSchema);
