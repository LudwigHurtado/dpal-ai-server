import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { UserRole } from "../models/User.js";

const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC || 900); // 15m
const REFRESH_TTL_MS = Number(process.env.JWT_REFRESH_TTL_MS || 7 * 24 * 60 * 60 * 1000); // 7d

function getSecrets() {
  const access = process.env.JWT_SECRET || "";
  const refresh = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "";
  if (!access || access.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set to a strong value (32+ chars) in production");
    }
    console.warn("⚠️  JWT_SECRET missing or weak — using dev-only placeholder (set in .env for production)");
  }
  return {
    access: access || "dev-only-jwt-secret-change-me-32chars!!",
    refresh: refresh || "dev-only-refresh-secret-change-me-32ch!!",
  };
}

export type AccessPayload = {
  sub: string;
  email: string;
  role: UserRole;
  sid: string;
};

export function signAccessToken(payload: AccessPayload): string {
  const { access } = getSecrets();
  return jwt.sign(
    { sub: payload.sub, email: payload.email, role: payload.role, sid: payload.sid },
    access,
    { expiresIn: ACCESS_TTL_SEC }
  );
}

export function verifyAccessToken(token: string): AccessPayload {
  const { access } = getSecrets();
  const decoded = jwt.verify(token, access) as jwt.JwtPayload & AccessPayload;
  return {
    sub: String(decoded.sub),
    email: String(decoded.email),
    role: decoded.role as AccessPayload["role"],
    sid: String(decoded.sid),
  };
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export { ACCESS_TTL_SEC, REFRESH_TTL_MS };
