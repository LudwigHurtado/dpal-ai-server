import mongoose from "mongoose";

const { Schema } = mongoose;

/** Refresh sessions — store only hashed refresh tokens */
const SessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refreshTokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

SessionSchema.index({ userId: 1, refreshTokenHash: 1 });

export const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);
