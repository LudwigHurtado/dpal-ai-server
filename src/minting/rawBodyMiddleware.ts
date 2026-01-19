// src/minting/rawBodyMiddleware.ts
// Required to make signature verification stable.
// Add this before JSON parsing in your Express app.

import type { Request } from "express";
import express from "express";

export function jsonWithRawBody(limit: string = "256kb") {
  return express.json({
    limit,
    verify: (req: Request, _res, buf) => {
      (req as any).rawBody = buf;
    },
  });
}
