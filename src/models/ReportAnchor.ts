import mongoose, { Schema, Document } from "mongoose";
import { REPORT_LIFECYCLE_STATES, type ReportLifecycleState } from "../domain/reportLifecycle.js";

export interface IReportAnchor extends Document {
  reportId: string;
  reportHash: string;
  txHash: string;
  blockNumber: number;
  chain: string;
  anchoredAt: Date;
  payload: Record<string, any>;
  lifecycleState: ReportLifecycleState;
  submittedAt?: Date;
  verifiedAt?: Date;
  certifiedAt?: Date;
  certificateId?: string;
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
    lifecycleState: { type: String, enum: REPORT_LIFECYCLE_STATES, default: "anchored", index: true },
    submittedAt: { type: Date },
    verifiedAt: { type: Date },
    certifiedAt: { type: Date },
    certificateId: { type: String, index: true },
  },
  { timestamps: true }
);

export const ReportAnchor =
  mongoose.models.ReportAnchor ||
  mongoose.model<IReportAnchor>("ReportAnchor", ReportAnchorSchema);
