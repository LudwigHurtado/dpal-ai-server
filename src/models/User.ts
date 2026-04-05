import mongoose from "mongoose";

const { Schema } = mongoose;

/** Platform roles — extend in code when adding new roles */
export const USER_ROLES = [
  "admin",
  "moderator",
  "validator",
  "standard",
  "support_agent",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "suspended", "pending_verification"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "standard",
      index: true,
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "pending_verification",
      index: true,
    },
    profilePhotoUrl: { type: String, default: "" },
    emailVerified: { type: Boolean, default: false },
    preferences: { type: Schema.Types.Mixed, default: {} },
    lastLoginAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
