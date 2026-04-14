import mongoose, { Schema, Document } from "mongoose";

export interface IWaterTransaction extends Document {
  txId: string;
  txType: "issue" | "list" | "buy" | "retire";
  projectId: string;
  creditId: string;
  amountKiloLitres: number;
  priceUsd: number;
  blockchainHash: string;
  note: string;
  ts: number;
}

const WaterTransactionSchema = new Schema<IWaterTransaction>(
  {
    txId: { type: String, required: true, unique: true, index: true },
    txType: {
      type: String,
      enum: ["issue", "list", "buy", "retire"],
      required: true,
    },
    projectId: { type: String, required: true, index: true },
    creditId: { type: String, default: "" },
    amountKiloLitres: { type: Number, default: 0 },
    priceUsd: { type: Number, default: 0 },
    blockchainHash: { type: String, default: "" },
    note: { type: String, default: "" },
    ts: { type: Number, required: true, default: () => Date.now() },
  },
  {}
);

WaterTransactionSchema.index({ projectId: 1, ts: -1 });
WaterTransactionSchema.index({ ts: -1 });

export const WaterTransaction =
  mongoose.models.WaterTransaction ||
  mongoose.model<IWaterTransaction>("WaterTransaction", WaterTransactionSchema);
