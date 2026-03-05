import type { Request, Response, NextFunction } from "express";

/**
 * Middleware to capture raw body for signature verification
 * Stores raw body in req.rawBody before JSON parsing
 */
export function jsonWithRawBody(limit: string = "256kb") {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for GET/HEAD requests or if body is already parsed
    if (req.method === "GET" || req.method === "HEAD" || (req as any).rawBody) {
      return next();
    }

    const chunks: Buffer[] = [];
    let totalLength = 0;
    const maxSize = parseSizeLimit(limit);
    let ended = false;

    const finish = () => {
      if (ended) return;
      ended = true;
      (req as any).rawBody = chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
      next();
    };

    req.on("data", (chunk: Buffer) => {
      if (ended) return;
      totalLength += chunk.length;
      if (totalLength > maxSize) {
        ended = true;
        res.status(413).json({ error: "Payload too large" });
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", finish);
    req.on("error", (err) => {
      if (!ended) {
        ended = true;
        next(err);
      }
    });

    // Fallback: if no data events fire, call next after a short timeout
    // This handles cases where the body is empty or already consumed
    setTimeout(() => {
      if (!ended) {
        finish();
      }
    }, 10);
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