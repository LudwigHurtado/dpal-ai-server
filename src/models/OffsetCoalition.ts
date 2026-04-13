import mongoose, { Schema, Document } from "mongoose";

export interface IOffsetCoalition extends Document {
  projectId: string;
  userId: string;
  userName: string;
  role: "steward" | "verifier" | "donor" | "member";
  joinedAt: number;
  createdAt: Date;
  updatedAt: Date;
}

const OffsetCoalitionSchema = new Schema<IOffsetCoalition>(
  {
    projectId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, default: "Anonymous" },
    role: { type: String, enum: ["steward", "verifier", "donor", "member"], default: "member" },
    joinedAt: { type: Number, required: true },
  },
  { timestamps: true }
);

OffsetCoalitionSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const OffsetCoalition =
  mongoose.models.OffsetCoalition ||
  mongoose.model<IOffsetCoalition>("OffsetCoalition", OffsetCoalitionSchema);
