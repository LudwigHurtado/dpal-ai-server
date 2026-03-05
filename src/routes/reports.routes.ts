import { Router, type Request, type Response } from "express";

const router = Router();

/**
 * Skeleton reports feed for DPAL Enterprise Dashboard.
 *
 * GET /api/reports/feed?limit=200&status=...&entityType=...
 * Returns mock data for now; replace with real query logic.
 */

router.get("/feed", (req: Request, res: Response) => {
  const now = Date.now();
  const limit = Math.min(Number(req.query.limit) || 50, 500);

  const items = Array.from({ length: limit }).map((_, i) => ({
    reportId: `rep_${i + 1}`,
    title: `Sample report #${i + 1}`,
    description: "Placeholder report used for dashboard wiring.",
    severity: i % 3 === 0 ? "High" : i % 3 === 1 ? "Moderate" : "Low",
    opsStatus: i % 4 === 0 ? "New" : i % 4 === 1 ? "Investigating" : i % 4 === 2 ? "Action Taken" : "Resolved",
    location: "Unknown",
    channel: "web",
    category: "general",
    entityType: i % 2 === 0 ? "provider" : "user",
    entityName: i % 2 === 0 ? `Provider ${Math.floor(i / 2) + 1}` : `User ${Math.floor(i / 2) + 1}`,
    createdAt: new Date(now - (i + 1) * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - i * 45 * 60 * 1000).toISOString(),
  }));

  res.json({
    ok: true,
    items,
    total: items.length,
  });
});

export default router;

