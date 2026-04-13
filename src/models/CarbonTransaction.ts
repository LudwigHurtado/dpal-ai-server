import mongoose, { Schema, Document } from "mongoose";

export type CarbonTxType = "issue" | "list" | "buy" | "retire" | "transfer" | "reject";

export interface ICarbonTransaction extends Document {
  txId: string;
  creditId: string;
  projectId: string;
  txType: CarbonTxType;
  fromId: string;
  toId: string;
  amountTons: number;
  priceUsd: number;
  blockchainHash: string;
  note: string;
  ts: number;
  createdAt: Date;
  updatedAt: Date;
}

const CarbonTransactionSchema = new Schema<ICarbonTransaction>(
  {
    txId: { type: String, required: true, unique: true, index: true },
    creditId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    txType: {
      type: String,
      enum: ["issue", "list", "buy", "retire", "transfer", "reject"],
      required: true,
    },
    fromId: { type: String, default: "" },
    toId: { type: String, default: "" },
    amountTons: { type: Number, default: 0 },
    priceUsd: { type: Number, default: 0 },
    blockchainHash: { type: String, default: "" },
    note: { type: String, default: "" },
    ts: { type: Number, required: true },
  },
  { timestamps: true }
);

CarbonTransactionSchema.index({ creditId: 1, ts: -1 });
CarbonTransactionSchema.index({ projectId: 1, txType: 1 });

export const CarbonTransaction =
  mongoose.models.CarbonTransaction ||
  mongoose.model<ICarbonTransaction>("CarbonTransaction", CarbonTransactionSchema);
