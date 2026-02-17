import mongoose, { Schema, Document } from "mongoose";

export interface ISituationMessage extends Document {
  roomId: string;
  sender: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  isSystem?: boolean;
  ledgerProof: string;
  timestamp: number;
  createdAt: Date;
  updatedAt: Date;
}

const SituationMessageSchema = new Schema<ISituationMessage>(
  {
    roomId: { type: String, required: true, index: true },
    sender: { type: String, required: true },
    text: { type: String, default: "" },
    imageUrl: { type: String },
    audioUrl: { type: String },
    isSystem: { type: Boolean, default: false },
    ledgerProof: { type: String, required: true, index: true },
    timestamp: { type: Number, required: true, index: true },
  },
  { timestamps: true }
);

SituationMessageSchema.index({ roomId: 1, timestamp: -1 });

export const SituationMessage =
  mongoose.models.SituationMessage ||
  mongoose.model<ISituationMessage>("SituationMessage", SituationMessageSchema);
