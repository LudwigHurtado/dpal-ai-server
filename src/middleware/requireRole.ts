import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth.js";
import type { UserRole } from "../models/User.js";

export function requireRole(...allowed: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (!allowed.includes(req.auth.role as UserRole)) {
      return res.status(403).json({ error: "forbidden", message: "Insufficient permissions" });
    }
    next();
  };
}
