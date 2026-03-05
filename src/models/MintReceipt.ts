import mongoose, { Schema } from "mongoose";

export interface IMintReceipt extends mongoose.Document {
  mintRequestId: mongoose.Types.ObjectId;
  userId: string;
  tokenId: string;
  txHash: string;
  chain: string;
  metadataUri: string;
  priceCredits: number;
  ledgerEntryId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const MintReceiptSchema = new Schema<IMintReceipt>(
  {
    mintRequestId: { type: Schema.Types.ObjectId, ref: "MintRequest", required: true, index: true },
    userId: { type: String, required: true, index: true },
    tokenId: { type: String, required: true, unique: true, index: true },
    txHash: { type: String, required: true, index: true },
    chain: { type: String, required: true },
    metadataUri: { type: String, required: true },
    priceCredits: { type: Number, required: true },
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: "CreditLedger", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MintReceiptSchema.index({ userId: 1, createdAt: -1 });

// Prevent model overwrite in dev / nodemon reloads
export const MintReceipt =
  mongoose.models.MintReceipt || mongoose.model<IMintReceipt>("MintReceipt", MintReceiptSchema);
