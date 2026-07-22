import type { NextFunction, Response } from "express";
import { isDbConnected } from "../config/db.js";
import { authMiddleware, type AuthedRequest } from "./auth.js";
import { User } from "../models/User.js";
import { Session } from "../models/Session.js";

export type ReedyRiverAccountRequest = AuthedRequest & {
  reedyAccount?: {
    userId: string;
    role: string;
    emailVerified: boolean;
    status: string;
  };
};

const OPERATOR_ROLES = new Set(["admin", "moderator", "validator"]);

export function requireActiveReedyRiverAccount(options: { operator?: boolean } = {}) {
  return (req: ReedyRiverAccountRequest, res: Response, next: NextFunction): unknown =>
    authMiddleware(req, res, () => {
      void (async () => {
        if (!isDbConnected()) {
          return res.status(503).json({ ok: false, error: "database_unavailable", message: "Account status could not be validated; no protected river operation was performed." });
        }
        const [user, session] = await Promise.all([
          User.findById(String(req.auth?.sub || "")).select("status emailVerified role").lean(),
          Session.findById(String(req.auth?.sid || "")).select("userId expiresAt revokedAt").lean(),
        ]);
        if (!user || !session) return res.status(401).json({ ok: false, error: "account_or_session_not_found" });
        if (String(session.userId) !== String(req.auth?.sub || "")) {
          return res.status(401).json({ ok: false, error: "session_user_mismatch" });
        }
        if (session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
          return res.status(401).json({ ok: false, error: "session_inactive" });
        }
        if (user.status !== "active") {
          return res.status(403).json({ ok: false, error: "account_not_active", message: "An active DPAL account is required for this river operation." });
        }
        if (!user.emailVerified) {
          return res.status(403).json({ ok: false, error: "email_verification_required", message: "Verify the DPAL account before submitting or changing river evidence." });
        }
        const role = String(user.role || req.auth?.role || "standard");
        if (options.operator && !OPERATOR_ROLES.has(role)) {
          return res.status(403).json({ ok: false, error: "operator_role_required", message: "This operation requires an active, verified admin, moderator, or validator account." });
        }
        req.reedyAccount = {
          userId: String(req.auth?.sub),
          role,
          emailVerified: true,
          status: "active",
        };
        return next();
      })().catch(next);
    });
}

const PROTECTED_OPERATOR_PATHS: Array<{ methods: string[]; pattern: RegExp }> = [
  { methods: ["GET"], pattern: /^\/overview\/private\/?$/ },
  { methods: ["GET"], pattern: /^\/observations\/[^/]+\/private\/?$/ },
  { methods: ["PATCH"], pattern: /^\/observations\/[^/]+\/review\/?$/ },
  { methods: ["POST"], pattern: /^\/sources\/usgs\/poll\/?$/ },
  { methods: ["POST"], pattern: /^\/reports\/run\/?$/ },
  { methods: ["GET"], pattern: /^\/actions\/private\/?$/ },
  { methods: ["PATCH"], pattern: /^\/actions\/[^/]+\/transition\/?$/ },
];

export function reedyRiverSensitiveAccountGate(req: ReedyRiverAccountRequest, res: Response, next: NextFunction): unknown {
  const protectedRequest = PROTECTED_OPERATOR_PATHS.some(
    ({ methods, pattern }) => methods.includes(req.method.toUpperCase()) && pattern.test(req.path),
  );
  return protectedRequest ? requireActiveReedyRiverAccount({ operator: true })(req, res, next) : next();
}
