import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },

    ai: {
      summary: String,
      tags: [String],
      severity: String,
      routedTo: String,
      analyzedAt: Date,
    },
  },
  { timestamps: true }
);

export const Report = mongoose.model("Report", ReportSchema);
