import mongoose, { Schema, Document } from "mongoose";

export interface IReportAnchor extends Document {
  reportId: string;
  reportHash: string;
  txHash: string;
  blockNumber: number;
  chain: string;
  anchoredAt: Date;
  payload: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ReportAnchorSchema = new Schema<IReportAnchor>(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    reportHash: { type: String, required: true, index: true },
    txHash: { type: String, required: true, unique: true, index: true },
    blockNumber: { type: Number, required: true, index: true },
    chain: { type: String, required: true, default: "DPAL_INTERNAL" },
    anchoredAt: { type: Date, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const ReportAnchor =
  mongoose.models.ReportAnchor ||
  mongoose.model<IReportAnchor>("ReportAnchor", ReportAnchorSchema);
