import mongoose, { Schema, Document } from "mongoose";

export type ServiceName = "openai" | "anthropic" | "gemini" | "cursor" | "vercel" | "railway" | "mongodb" | "storage" | "other";

export interface IServiceCost extends Document {
  service: ServiceName;
  label: string;
  category: "ai_api" | "hosting" | "database" | "storage" | "dev_tool" | "other";
  periodYear: number;
  periodMonth: number;
  amountUsd: number;
  budgetUsd: number;
  usageDetails: Record<string, any>;
  invoiceUrl: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceCostSchema = new Schema<IServiceCost>(
  {
    service: { type: String, required: true, enum: ["openai", "anthropic", "gemini", "cursor", "vercel", "railway", "mongodb", "storage", "other"], index: true },
    label: { type: String, required: true },
    category: { type: String, enum: ["ai_api", "hosting", "database", "storage", "dev_tool", "other"], required: true },
    periodYear: { type: Number, required: true },
    periodMonth: { type: Number, required: true, min: 1, max: 12 },
    amountUsd: { type: Number, required: true, default: 0 },
    budgetUsd: { type: Number, default: 0 },
    usageDetails: { type: Schema.Types.Mixed, default: {} },
    invoiceUrl: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

ServiceCostSchema.index({ service: 1, periodYear: 1, periodMonth: 1 }, { unique: true });
ServiceCostSchema.index({ periodYear: 1, periodMonth: 1 });

export const ServiceCost =
  mongoose.models.ServiceCost || mongoose.model<IServiceCost>("ServiceCost", ServiceCostSchema);
