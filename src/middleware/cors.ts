import cors from "cors";
import type { Request, Response, NextFunction } from "express";

const allowedOrigins = new Set<string>();
if (process.env.FRONTEND_ORIGIN) allowedOrigins.add(process.env.FRONTEND_ORIGIN);
if (process.env.FRONTEND_ORIGIN_2) allowedOrigins.add(process.env.FRONTEND_ORIGIN_2);

// optional local dev
allowedOrigins.add("http://localhost:5173");
allowedOrigins.add("http://localhost:3000");

export const corsMw = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    if (origin.endsWith(".vercel.app")) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`), false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
});