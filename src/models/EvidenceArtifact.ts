import mongoose, { Schema, Document } from "mongoose";

export interface IEvidenceArtifact extends Document {
  reportId: string;
  evidenceRefId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  timestampIso: string;
  timestampHash: string;
  chainRefId: string;
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceArtifactSchema = new Schema<IEvidenceArtifact>(
  {
    reportId: { type: String, required: true },
    evidenceRefId: { type: String, required: true, unique: true, index: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    sha256: { type: String, required: true, index: true },
    timestampIso: { type: String, required: true },
    timestampHash: { type: String, required: true, index: true },
    chainRefId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

EvidenceArtifactSchema.index({ reportId: 1, createdAt: -1 });

export const EvidenceArtifact =
  mongoose.models.EvidenceArtifact ||
  mongoose.model<IEvidenceArtifact>("EvidenceArtifact", EvidenceArtifactSchema);
