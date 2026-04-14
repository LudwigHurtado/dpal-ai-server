import mongoose, { Schema, Document } from "mongoose";

export type SignalCategory =
  | "environmental_hazard"
  | "fire_smoke"
  | "climate_risk"
  | "public_safety"
  | "infrastructure_failure"
  | "pollution"
  | "carbon_project"
  | "community_verification";

export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type SignalStatus =
  | "new"
  | "reviewed"
  | "mission_created"
  | "sent_to_verification"
  | "verified"
  | "closed"
  | "logged";

export interface IGlobalSignal extends Document {
  signalId: string;
  title: string;
  description: string;
  category: SignalCategory;
  sourceName: string;
  sourceUrl?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  riskLevel: RiskLevel;
  confidenceScore: number;
  status: SignalStatus;
  aiSummary?: string;
  suggestedMissionTitle?: string;
  suggestedMissionDescription?: string;
  missionId?: string;
  sourceSignalId?: string;
  rawData?: Record<string, unknown>;
  ledgerHash?: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GlobalSignalSchema = new Schema<IGlobalSignal>(
  {
    signalId:                  { type: String, required: true, unique: true, index: true },
    title:                     { type: String, required: true },
    description:               { type: String, default: "" },
    category:                  { type: String, required: true, enum: ["environmental_hazard","fire_smoke","climate_risk","public_safety","infrastructure_failure","pollution","carbon_project","community_verification"] },
    sourceName:                { type: String, required: true },
    sourceUrl:                 { type: String },
    latitude:                  { type: Number },
    longitude:                 { type: Number },
    city:                      { type: String },
    country:                   { type: String },
    riskLevel:                 { type: String, required: true, enum: ["low","moderate","high","critical"], default: "low" },
    confidenceScore:           { type: Number, default: 0.7 },
    status:                    { type: String, required: true, enum: ["new","reviewed","mission_created","sent_to_verification","verified","closed","logged"], default: "new" },
    aiSummary:                 { type: String },
    suggestedMissionTitle:     { type: String },
    suggestedMissionDescription:{ type: String },
    missionId:                 { type: String },
    sourceSignalId:            { type: String },
    rawData:                   { type: Schema.Types.Mixed },
    ledgerHash:                { type: String },
    reviewedBy:                { type: String },
    reviewNote:                { type: String },
  },
  { timestamps: true }
);

GlobalSignalSchema.index({ category: 1, status: 1 });
GlobalSignalSchema.index({ riskLevel: 1, createdAt: -1 });
GlobalSignalSchema.index({ country: 1 });

export const GlobalSignal = mongoose.model<IGlobalSignal>("GlobalSignal", GlobalSignalSchema);
