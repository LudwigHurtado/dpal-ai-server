import { ActivityLog } from "../models/ActivityLog.js";
import type { Types } from "mongoose";

export async function logActivity(input: {
  userId?: Types.ObjectId | string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  try {
    await ActivityLog.create({
      userId: input.userId || null,
      action: input.action,
      resourceType: input.resourceType || "",
      resourceId: input.resourceId || "",
      metadata: input.metadata || {},
      ip: input.ip || "",
      userAgent: input.userAgent || "",
    });
  } catch (e) {
    console.error("[activityLog]", e);
  }
}
