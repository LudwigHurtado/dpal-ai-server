/**
 * Authentication: register, login, refresh, logout, password flows, /me.
 * Passwords: bcrypt. Tokens: JWT access + opaque refresh (hashed in Session).
 */
import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { User, type UserRole } from "../models/User.js";
import { Session } from "../models/Session.js";
import { PasswordResetToken } from "../models/PasswordResetToken.js";
import { EmailVerificationToken } from "../models/EmailVerificationToken.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  verifyAccessToken,
  REFRESH_TTL_MS,
} from "../auth/tokens.js";
import { connectDb } from "../config/db.js";
import { logActivity } from "../services/activityLog.service.js";
import { authMiddleware, type AuthedRequest } from "../middleware/auth.js";
import { authLoginLimiter, authRegisterLimiter, authForgotLimiter } from "../middleware/authRateLimit.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
} from "../validation/auth.schemas.js";

const router = Router();

const MAX_FAILED = 8;
const LOCK_MS = 30 * 60 * 1000;

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  const raw = typeof xf === "string" ? xf.split(",")[0]?.trim() : "";
  return raw || req.ip || "";
}

function publicUser(u: any) {
  return {
    id: u._id.toString(),
    email: u.email,
    username: u.username,
    fullName: u.fullName,
    phone: u.phone || "",
    role: u.role as UserRole,
    status: u.status,
    profilePhotoUrl: u.profilePhotoUrl || "",
    emailVerified: Boolean(u.emailVerified),
    preferences: u.preferences || {},
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt || null,
  };
}

/** Optional: set BOOTSTRAP_ADMIN_EMAIL in Railway to elevate first matching signup */
function bootstrapRole(email: string): { role: UserRole; status: "active" | "pending_verification"; verified: boolean } {
  const boot = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
  if (boot && email.toLowerCase() === boot) {
    return { role: "admin", status: "active", verified: true };
  }
  return { role: "standard", status: "pending_verification", verified: false };
}

router.post("/register", authRegisterLimiter, async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }
  const ok = await connectDb();
  if (!ok || mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "database_unavailable" });
  }

  const { fullName, username, email, phone, password } = parsed.data;
  const usernameNorm = username.toLowerCase().trim();

  const exists = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username: usernameNorm }],
  }).lean();
  if (exists) {
    return res.status(409).json({
      error: "duplicate",
      message: "An account with this email or username already exists",
    });
  }

  const passwordHash = await hashPassword(password);
  const boot = bootstrapRole(email);

  const user = await User.create({
    fullName,
    username: usernameNorm,
    email: email.toLowerCase(),
    phone: phone || "",
    passwordHash,
    role: boot.role,
    status: boot.status,
    emailVerified: boot.verified,
  });

  const verifyToken = generateRefreshToken();
  const verifyHash = hashToken(verifyToken);
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: verifyHash,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });

  await logActivity({
    userId: user._id,
    action: "USER_REGISTER",
    resourceType: "user",
    resourceId: user._id.toString(),
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] || "",
  });

  return res.status(201).json({
    ok: true,
    user: publicUser((user as any).toObject ? (user as any).toObject() : user),
    /** Email delivery not wired — token returned for dev/testing only; remove in production or send via email */
    emailVerificationToken: process.env.NODE_ENV === "production" ? undefined : verifyToken,
    message:
      boot.verified && boot.role === "admin"
        ? "Account created (bootstrap admin)."
        : "Account created. Verify your email when delivery is configured.",
  });
});

router.post("/login", authLoginLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }
  const ok = await connectDb();
  if (!ok || mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "database_unavailable" });
  }

  const { identifier, password } = parsed.data;
  const idLower = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: idLower }, { username: idLower }],
  }).select("+passwordHash");

  if (!user) {
    await logActivity({
      action: "LOGIN_FAILED",
      metadata: { reason: "unknown_user", identifier: idLower },
      ip: clientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });
    return res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return res.status(423).json({ error: "account_locked", message: "Too many failed attempts. Try later." });
  }

  if (user.status === "suspended") {
    return res.status(403).json({ error: "account_suspended", message: "Account suspended" });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const fails = (user.failedLoginAttempts || 0) + 1;
    const update: Record<string, unknown> = { failedLoginAttempts: fails };
    if (fails >= MAX_FAILED) {
      update.lockedUntil = new Date(Date.now() + LOCK_MS);
      update.failedLoginAttempts = 0;
    }
    await User.updateOne({ _id: user._id }, { $set: update });
    await logActivity({
      userId: user._id,
      action: "LOGIN_FAILED",
      metadata: { reason: "bad_password" },
      ip: clientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });
    return res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    }
  );

  const refreshToken = generateRefreshToken();
  const refreshHash = hashToken(refreshToken);
  const sess = await Session.create({
    userId: user._id,
    refreshTokenHash: refreshHash,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
    ip: clientIp(req),
  });

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role as UserRole,
    sid: sess._id.toString(),
  });

  await logActivity({
    userId: user._id,
    action: "LOGIN_SUCCESS",
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] || "",
  });

  const u = await User.findById(user._id).lean();
  return res.json({
    ok: true,
    accessToken,
    refreshToken,
    expiresIn: Number(process.env.JWT_ACCESS_TTL_SEC || 900),
    user: publicUser(u),
  });
});

router.post("/refresh", async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error" });
  }
  await connectDb();
  const { refreshToken } = parsed.data;
  const h = hashToken(refreshToken);
  const sess = await Session.findOne({ refreshTokenHash: h, revokedAt: null }).populate("userId");
  if (!sess || sess.expiresAt < new Date()) {
    return res.status(401).json({ error: "invalid_refresh", message: "Session expired or invalid" });
  }

  const u = await User.findById(sess.userId);
  if (!u || u.status === "suspended") {
    return res.status(401).json({ error: "invalid_refresh" });
  }

  sess.revokedAt = new Date();
  await sess.save();

  const newRefresh = generateRefreshToken();
  const newHash = hashToken(newRefresh);
  const newSess = await Session.create({
    userId: u._id,
    refreshTokenHash: newHash,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
    ip: clientIp(req),
  });

  const accessToken = signAccessToken({
    sub: u._id.toString(),
    email: u.email,
    role: u.role as UserRole,
    sid: newSess._id.toString(),
  });

  return res.json({
    ok: true,
    accessToken,
    refreshToken: newRefresh,
    expiresIn: Number(process.env.JWT_ACCESS_TTL_SEC || 900),
    user: publicUser(u.toObject()),
  });
});

router.post("/logout", async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error" });
  }
  await connectDb();
  const h = hashToken(parsed.data.refreshToken);
  await Session.updateMany({ refreshTokenHash: h }, { $set: { revokedAt: new Date() } });
  return res.json({ ok: true });
});

router.get("/me", authMiddleware, async (req: AuthedRequest, res: Response) => {
  await connectDb();
  const u = await User.findById(req.auth!.sub).lean();
  if (!u) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true, user: publicUser(u) });
});

router.post("/change-password", authMiddleware, async (req: AuthedRequest, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }
  await connectDb();
  const user = await User.findById(req.auth!.sub).select("+passwordHash");
  if (!user) return res.status(404).json({ error: "not_found" });
  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_password" });
  user.passwordHash = await hashPassword(parsed.data.newPassword);
  await user.save();
  await Session.updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
  await logActivity({ userId: user._id, action: "PASSWORD_CHANGE", ip: clientIp(req) });
  return res.json({ ok: true, message: "Password updated. Please log in again on other devices." });
});

router.post("/forgot-password", authForgotLimiter, async (req: Request, res: Response) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error" });
  }
  await connectDb();
  const email = parsed.data.email.toLowerCase();
  const user = await User.findOne({ email });
  /** Uniform response — do not leak whether email exists */
  if (user) {
    const raw = generateRefreshToken();
    const tokenHash = hashToken(raw);
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await logActivity({
      userId: user._id,
      action: "PASSWORD_RESET_REQUEST",
      ip: clientIp(req),
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[dev] password reset token for ${email}: ${raw}`);
    }
  }
  return res.json({
    ok: true,
    message: "If an account exists for that email, reset instructions have been sent.",
  });
});

router.post("/reset-password", async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }
  await connectDb();
  const { token, newPassword } = parsed.data;
  const h = hashToken(token);
  const pr = await PasswordResetToken.findOne({ tokenHash: h, usedAt: null });
  if (!pr || pr.expiresAt < new Date()) {
    return res.status(400).json({ error: "invalid_token", message: "Invalid or expired reset link" });
  }
  const user = await User.findById(pr.userId);
  if (!user) return res.status(400).json({ error: "invalid_token" });
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  pr.usedAt = new Date();
  await pr.save();
  await Session.updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
  await logActivity({ userId: user._id, action: "PASSWORD_RESET_COMPLETE", ip: clientIp(req) });
  return res.json({ ok: true, message: "Password has been reset. You can log in now." });
});

router.post("/verify-email", async (req: Request, res: Response) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error" });
  }
  await connectDb();
  const h = hashToken(parsed.data.token);
  const doc = await EmailVerificationToken.findOne({ tokenHash: h, usedAt: null });
  if (!doc || doc.expiresAt < new Date()) {
    return res.status(400).json({ error: "invalid_token" });
  }
  await User.updateOne({ _id: doc.userId }, { $set: { emailVerified: true, status: "active" } });
  doc.usedAt = new Date();
  await doc.save();
  await logActivity({ userId: doc.userId, action: "EMAIL_VERIFIED", ip: clientIp(req) });
  return res.json({ ok: true, message: "Email verified." });
});

export default router;
