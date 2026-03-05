import type { Request, Response, NextFunction } from "express";

export const errorMw = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ ok: false, error: String(err?.message || err) });
};