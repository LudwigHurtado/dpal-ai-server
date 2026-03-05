import mongoose, { Schema } from "mongoose";

const LedgerEntrySchema = new Schema(
  {
    heroId: { type: String, required: true, index: true },

    type: { type: String, required: true },     // EARN | SPEND | TRANSFER_IN | TRANSFER_OUT | ...
    amount: { type: Number, required: true },   // positive
    memo: { type: String, default: "" },

    refId: { type: String, default: "" },
    counterpartyHeroId: { type: String, default: "" }
  },
  { timestamps: true }
);

LedgerEntrySchema.index({ heroId: 1, createdAt: -1 });

export const LedgerEntry =
  mongoose.models.LedgerEntry || mongoose.model("LedgerEntry", LedgerEntrySchema);
