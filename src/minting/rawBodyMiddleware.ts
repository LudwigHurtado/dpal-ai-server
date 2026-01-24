import type { Request, Response, NextFunction } from "express";

/**
 * Middleware to capture raw body for signature verification.
 * Stores raw body in req.rawBody before JSON parsing.
 * Should be placed before express.json() in the middleware chain.
 */
export function jsonWithRawBody(limit: string = "256kb") {
  return function (req: Request, res: Response, next: NextFunction) {
    let received = 0;
    const maxSize = parseSizeLimit(limit);
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxSize) {
        // Immediately destroy the connection and stop further processing
        req.destroy();
        if (!res.headersSent) {
          res.status(413).json({ error: "Payload too large" });
        }
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      // Only concat if we didn't already error out
      if (received <= maxSize) {
        (req as any).rawBody = Buffer.concat(chunks, received);
        next();
      }
      // Otherwise, req.destroy and error was already handled
    });

    req.on("error", (err) => {
      next(err);
    });
  };
}

/**
 * Parses a size string such as "256kb", "2mb", "1gb" into its numeric value in bytes.
 * Defaults to 256kb if not parsable.
 */
function parseSizeLimit(limit: string): number {
  if (!limit) return 256 * 1024;
  const match = /^(\d+)(kb|mb|gb)?$/i.exec(limit.trim());
  if (!match) return 256 * 1024;

  const size = parseInt(match[1], 10);
  const unit = (match[2] || "kb").toLowerCase();

  switch (unit) {
    case "gb": return size * 1024 * 1024 * 1024;
    case "mb": return size * 1024 * 1024;
    case "kb":
    default: return size * 1024;
  }
}