import type { Request, Response, NextFunction } from "express";

/**
 * Middleware to capture raw body for signature verification
 * Stores raw body in req.rawBody before JSON parsing
 */
export function jsonWithRawBody(limit: string = "256kb") {
  return (req: Request, res: Response, next: NextFunction) => {
    const chunks: Buffer[] = [];
    let totalLength = 0;
    const maxSize = parseSizeLimit(limit);

    req.on("data", (chunk: Buffer) => {
      totalLength += chunk.length;
      if (totalLength > maxSize) {
        res.status(413).json({ error: "Payload too large" });
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      (req as any).rawBody = Buffer.concat(chunks);
      next();
    });

    req.on("error", (err) => {
      next(err);
    });
  };
}

function parseSizeLimit(limit: string): number {
  const match = limit.match(/^(\d+)(kb|mb|gb)?$/i);
  if (!match) return 256 * 1024; // default 256kb

  const size = parseInt(match[1], 10);
  const unit = (match[2] || "kb").toLowerCase();

  switch (unit) {
    case "gb":
      return size * 1024 * 1024 * 1024;
    case "mb":
      return size * 1024 * 1024;
    case "kb":
    default:
      return size * 1024;
  }
}