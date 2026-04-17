import mongoose, { Schema, Document } from "mongoose";

export interface IDirective extends Document {
  directiveId: string;
  title: string;
  category: string;
  status: "available" | "in_progress" | "completed";
  auditHash?: string;
  notes: string;
  checkedSteps: number[];
  proofImageUrls: string[];
  heroLocation: string;
  completedAt?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DirectiveSchema = new Schema<IDirective>(
  {
    directiveId: { type: String, required: true },
    title: { type: String, required: true },
    category: { type: String, default: "" },
    status: { type: String, enum: ["available", "in_progress", "completed"], default: "available" },
    auditHash: { type: String },
    notes: { type: String, default: "" },
    checkedSteps: { type: [Number], default: [] },
    proofImageUrls: { type: [String], default: [] },
    heroLocation: { type: String, default: "" },
    completedAt: { type: Number },
  },
  { timestamps: true }
);

DirectiveSchema.index({ directiveId: 1 });
DirectiveSchema.index({ status: 1, createdAt: -1 });

export const Directive =
  mongoose.models.Directive ||
  mongoose.model<IDirective>("Directive", DirectiveSchema);
