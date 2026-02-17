import { Router, type Request, type Response } from "express";
import { connectDb } from "../config/db.js";
import { ReportAnchor } from "../models/ReportAnchor.js";
import { EvidenceArtifact } from "../models/EvidenceArtifact.js";

const router = Router();

router.get("/metrics", async (_req: Request, res: Response) => {
  try {
    await connectDb();
    const [totalAnchors, totalEvidence, recentAnchors] = await Promise.all([
      ReportAnchor.countDocuments({}),
      EvidenceArtifact.countDocuments({}),
      ReportAnchor.countDocuments({ anchoredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ]);

    return res.json({
      ok: true,
      totals: {
        anchoredReports: totalAnchors,
        evidenceArtifacts: totalEvidence,
        anchorsLast24h: recentAnchors,
      },
      utilityDisclosure: "DPAL metrics are provided for transparency and civic utility only; not investment guidance.",
      generatedAt: Date.now(),
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: "transparency_metrics_failed", message: String(error?.message || error) });
  }
});

export default router;
