import mongoose, { Schema } from "mongoose";

export interface ICreditLedger extends mongoose.Document {
  userId: string;
  type: "CREDIT_LOCK" | "CREDIT_SPEND" | "CREDIT_UNLOCK" | "DEPOSIT";
  amount: number;
  direction: "CREDIT" | "DEBIT";
  referenceId: string;
  idempotencyKey: string;
  meta?: any;
  createdAt: Date;
}

const CreditLedgerSchema = new Schema<ICreditLedger>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ["CREDIT_LOCK", "CREDIT_SPEND", "CREDIT_UNLOCK", "DEPOSIT"] },
    amount: { type: Number, required: true },
    direction: { type: String, required: true, enum: ["CREDIT", "DEBIT"] },
    referenceId: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    meta: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CreditLedgerSchema.index({ userId: 1, createdAt: -1 });

// Prevent model overwrite in dev / nodemon reloads
export const CreditLedger =
  mongoose.models.CreditLedger || mongoose.model<ICreditLedger>("CreditLedger", CreditLedgerSchema);
