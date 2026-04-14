import mongoose, { Schema, Document } from "mongoose";

export interface IWaterSnapshotMetrics {
  soilMoistureIndex?: number;      // 0–1
  surfaceWaterLevel?: number;      // metres
  waterStorageTrend?: number;      // mm/month
  vegetationStress?: number;       // 0–1
  droughtRisk?: number;            // 0–1
  usageReductionEstimate?: number; // 0–1
  confidenceScore: number;         // 0–1
}

export interface IWaterSnapshot extends Document {
  snapshotId: string;
  projectId: string;
  source:
    | "SMAP_SOIL_MOISTURE"
    | "SWOT_SURFACE_WATER"
    | "GRACE_WATER_STORAGE"
    | "NASA_GIBS"
    | "COPERNICUS_SENTINEL"
    | "MANUAL_UPLOAD";
  captureDate: string;
  metrics: IWaterSnapshotMetrics;
  anomalyFlags: string[];
  imageUrl?: string;
  notes: string;
  isBaseline: boolean;
}

const MetricsSchema = new Schema<IWaterSnapshotMetrics>(
  {
    soilMoistureIndex: { type: Number },
    surfaceWaterLevel: { type: Number },
    waterStorageTrend: { type: Number },
    vegetationStress: { type: Number },
    droughtRisk: { type: Number },
    usageReductionEstimate: { type: Number },
    confidenceScore: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const WaterSnapshotSchema = new Schema<IWaterSnapshot>(
  {
    snapshotId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: [
        "SMAP_SOIL_MOISTURE",
        "SWOT_SURFACE_WATER",
        "GRACE_WATER_STORAGE",
        "NASA_GIBS",
        "COPERNICUS_SENTINEL",
        "MANUAL_UPLOAD",
      ],
      default: "SMAP_SOIL_MOISTURE",
    },
    captureDate: { type: String, required: true },
    metrics: { type: MetricsSchema, default: () => ({ confidenceScore: 0 }) },
    anomalyFlags: { type: [String], default: [] },
    imageUrl: { type: String },
    notes: { type: String, default: "" },
    isBaseline: { type: Boolean, default: false },
  },
  {}
);

WaterSnapshotSchema.index({ projectId: 1, captureDate: -1 });

export const WaterSnapshot =
  mongoose.models.WaterSnapshot ||
  mongoose.model<IWaterSnapshot>("WaterSnapshot", WaterSnapshotSchema);
