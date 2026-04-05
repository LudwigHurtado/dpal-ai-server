import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type AccessPayload } from "../auth/tokens.js";

export type AuthedRequest = Request & {
  auth?: AccessPayload;
};

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: "unauthorized", message: "Missing or invalid Authorization header" });
  }
  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
  }
}
