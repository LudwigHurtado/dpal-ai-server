import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { isDbConnected, getDbState } from "../config/db.js";

const router = Router();

router.get("/confidence", async (_req: Request, res: Response) => {
  const dbConnected = isDbConnected();
  const uploadsDir = path.join(process.cwd(), "uploads");
  const mediaStorageReady = fs.existsSync(uploadsDir) || Boolean(process.env.CLOUDINARY_CLOUD_NAME);

  const anchorQueueLag = Number(process.env.DPAL_ANCHOR_QUEUE_LAG || 0);
  const alerts = [] as string[];

  if (!dbConnected) alerts.push("Database is not connected.");
  if (!mediaStorageReady) alerts.push("Media storage not configured.");
  if (anchorQueueLag > 50) alerts.push("Anchor queue lag is elevated.");

  const score = Math.max(
    0,
    100 - (dbConnected ? 0 : 45) - (mediaStorageReady ? 0 : 20) - Math.min(35, Math.floor(anchorQueueLag / 2))
  );

  return res.json({
    ok: true,
    score,
    status: score >= 85 ? "healthy" : score >= 60 ? "degraded" : "critical",
    checks: {
      api: true,
      database: { connected: dbConnected, state: getDbState() },
      media: { ready: mediaStorageReady },
      anchorQueue: { lag: anchorQueueLag, healthy: anchorQueueLag <= 50 },
    },
    alerts,
    generatedAt: Date.now(),
  });
});

export default router;
