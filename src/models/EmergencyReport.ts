import mongoose, { Schema, Document } from "mongoose";

export interface IEmergencyReport extends Document {
  emergencyId: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  status: "active" | "acknowledged" | "responding" | "resolved" | "false_alarm";
  reportedBy: string;
  reportedByType: "human" | "system" | "sensor";
  location: string;
  lat?: number;
  lng?: number;
  city: string;
  country: string;
  assignedTo: string;
  respondedAt?: Date;
  resolvedAt?: Date;
  evidenceUrls: string[];
  notes: string;
  nexusClientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyReportSchema = new Schema<IEmergencyReport>(
  {
    emergencyId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    severity: { type: String, enum: ["critical", "high", "medium", "low"], required: true, index: true },
    category: { type: String, required: true, default: "other" },
    status: { type: String, enum: ["active", "acknowledged", "responding", "resolved", "false_alarm"], default: "active", index: true },
    reportedBy: { type: String, required: true },
    reportedByType: { type: String, enum: ["human", "system", "sensor"], default: "human" },
    location: { type: String, default: "" },
    lat: { type: Number },
    lng: { type: Number },
    city: { type: String, default: "" },
    country: { type: String, default: "" },
    assignedTo: { type: String, default: "" },
    respondedAt: { type: Date },
    resolvedAt: { type: Date },
    evidenceUrls: { type: [String], default: [] },
    notes: { type: String, default: "" },
    nexusClientId: { type: String, index: true },
  },
  { timestamps: true }
);

EmergencyReportSchema.index({ severity: 1, status: 1 });
EmergencyReportSchema.index({ createdAt: -1 });

export const EmergencyReport =
  mongoose.models.EmergencyReport ||
  mongoose.model<IEmergencyReport>("EmergencyReport", EmergencyReportSchema);
