import mongoose, { Schema, Document } from "mongoose";

export interface INexusClient extends Document {
  clientId: string;
  orgName: string;
  entityType: string;
  plan: "trial" | "basic" | "professional" | "enterprise";
  status: "active" | "trial" | "suspended" | "churned";
  contactName: string;
  contactEmail: string;
  city: string;
  country: string;
  reportsCount: number;
  lastActivityAt: Date;
  joinedAt: Date;
  slaTarget: number;
  slaActual: number;
  monthlyReportLimit: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const NexusClientSchema = new Schema<INexusClient>(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    orgName: { type: String, required: true },
    entityType: { type: String, required: true, default: "other" },
    plan: { type: String, enum: ["trial", "basic", "professional", "enterprise"], default: "trial" },
    status: { type: String, enum: ["active", "trial", "suspended", "churned"], default: "trial", index: true },
    contactName: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "" },
    reportsCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now },
    joinedAt: { type: Date, default: Date.now },
    slaTarget: { type: Number, default: 95 },
    slaActual: { type: Number, default: 0 },
    monthlyReportLimit: { type: Number, default: 100 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

NexusClientSchema.index({ status: 1, createdAt: -1 });

export const NexusClient =
  mongoose.models.NexusClient || mongoose.model<INexusClient>("NexusClient", NexusClientSchema);
