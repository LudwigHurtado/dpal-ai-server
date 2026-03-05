import mongoose, { Schema } from "mongoose";

const WalletSchema = new Schema(
  {
    heroId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    locked: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

WalletSchema.index({ heroId: 1 });

// Prevent model overwrite in dev / nodemon reloads
export const Wallet =
  mongoose.models.Wallet || mongoose.model("Wallet", WalletSchema);