import mongoose, { Schema } from "mongoose";

export interface ICreditWallet extends mongoose.Document {
  userId: string;
  balance: number;
  lockedBalance: number;
  updatedAt: Date;
  version: number;
}

const CreditWalletSchema = new Schema<ICreditWallet>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    balance: { type: Number, default: 0, min: 0 },
    lockedBalance: { type: Number, default: 0, min: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: "version" }
);

CreditWalletSchema.index({ userId: 1 });

// Prevent model overwrite in dev / nodemon reloads
export const CreditWallet =
  mongoose.models.CreditWallet || mongoose.model<ICreditWallet>("CreditWallet", CreditWalletSchema);
