/**
 * Admin-only user management and activity audit.
 */
import { Router, type Response } from "express";
import mongoose from "mongoose";
import { User, type UserRole } from "../models/User.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { Session } from "../models/Session.js";
import { connectDb } from "../config/db.js";
import { authMiddleware, type AuthedRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { adminPatchUserSchema } from "../validation/auth.schemas.js";
import { logActivity } from "../services/activityLog.service.js";

const router = Router();

router.use(authMiddleware);
router.use(requireRole("admin"));

router.get("/users", async (req: AuthedRequest, res: Response) => {
  await connectDb();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    User.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-passwordHash")
      .lean(),
    User.countDocuments({}),
  ]);

  return res.json({
    ok: true,
    page,
    limit,
    total,
    items: items.map((u: any) => ({
      id: u._id.toString(),
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      emailVerified: u.emailVerified,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
  });
});

router.patch("/users/:id", async (req: AuthedRequest, res: Response) => {
  const parsed = adminPatchUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }
  await connectDb();
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "invalid_id" });
  }

  const target = await User.findById(id);
  if (!target) return res.status(404).json({ error: "not_found" });

  const patch = parsed.data;
  if (patch.role) target.role = patch.role as UserRole;
  if (patch.status) target.status = patch.status;
  await target.save();

  if (patch.status === "suspended") {
    await Session.updateMany({ userId: target._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  }

  await logActivity({
    userId: req.auth!.sub,
    action: "ADMIN_USER_UPDATE",
    resourceType: "user",
    resourceId: id,
    metadata: { patch },
  });

  return res.json({
    ok: true,
    user: {
      id: target._id.toString(),
      email: target.email,
      username: target.username,
      role: target.role,
      status: target.status,
    },
  });
});

router.get("/activity", async (req: AuthedRequest, res: Response) => {
  await connectDb();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;
  const userId = req.query.userId as string | undefined;

  const q =
    userId && mongoose.Types.ObjectId.isValid(userId)
      ? { userId: new mongoose.Types.ObjectId(userId) }
      : {};
  const [rows, total] = await Promise.all([
    ActivityLog.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ActivityLog.countDocuments(q),
  ]);

  return res.json({
    ok: true,
    page,
    limit,
    total,
    items: rows,
  });
});

export default router;
