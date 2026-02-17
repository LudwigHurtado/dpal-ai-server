import mongoose, { Schema, Document } from "mongoose";

export interface ISituationRoom extends Document {
  roomId: string;
  title: string;
  city?: string;
  createdBy?: string;
  memberCount: number;
  lastActivityAt: number;
  createdAt: Date;
  updatedAt: Date;
}

const SituationRoomSchema = new Schema<ISituationRoom>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    city: { type: String },
    createdBy: { type: String },
    memberCount: { type: Number, default: 0 },
    lastActivityAt: { type: Number, default: () => Date.now(), index: true },
  },
  { timestamps: true }
);

export const SituationRoom =
  mongoose.models.SituationRoom ||
  mongoose.model<ISituationRoom>("SituationRoom", SituationRoomSchema);
