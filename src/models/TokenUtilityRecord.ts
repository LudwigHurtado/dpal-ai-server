import mongoose, { Schema, Document } from "mongoose";

export type TokenUtilityAction =
  | "STAKE_VERIFY"
  | "UNLOCK_TOOL"
  | "SPONSOR_MISSION"
  | "REWARD_WHISTLEBLOWER"
  | "GOVERNANCE_VOTE";

export interface ITokenUtilityRecord extends Document {
  actor: string;
  action: TokenUtilityAction;
  amount: number;
  referenceId?: string;
  notes?: string;
  txHash: string;
  blockNumber: number;
  chain: string;
  createdAt: Date;
  updatedAt: Date;
}

const TokenUtilityRecordSchema = new Schema<ITokenUtilityRecord>(
  {
    actor: { type: String, required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: [
        "STAKE_VERIFY",
        "UNLOCK_TOOL",
        "SPONSOR_MISSION",
        "REWARD_WHISTLEBLOWER",
        "GOVERNANCE_VOTE",
      ],
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    referenceId: { type: String, index: true },
    notes: { type: String },
    txHash: { type: String, required: true, unique: true, index: true },
    blockNumber: { type: Number, required: true, index: true },
    chain: { type: String, required: true, default: "DPAL_INTERNAL" },
  },
  { timestamps: true }
);

TokenUtilityRecordSchema.index({ createdAt: -1 });

export const TokenUtilityRecord =
  mongoose.models.TokenUtilityRecord ||
  mongoose.model<ITokenUtilityRecord>("TokenUtilityRecord", TokenUtilityRecordSchema);
