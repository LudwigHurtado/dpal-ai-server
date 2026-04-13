import { Router, type Request, type Response } from "express";
import { Directive } from "../models/Directive.js";

const router = Router();

/**
 * POST /api/directives/save
 * Called by the front-end when a user starts or completes a mission.
 * Consumed by the validator node and admin panel.
 */
router.post("/save", async (req: Request, res: Response) => {
  try {
    const {
      directiveId,
      title,
      category,
      status,
      auditHash,
      notes,
      checkedSteps,
      proofImageUrls,
      heroLocation,
      completedAt,
    } = req.body;

    if (!directiveId || !title) {
      return res.status(400).json({ ok: false, error: "directiveId and title are required" });
    }

    const doc = await Directive.findOneAndUpdate(
      { directiveId: String(directiveId) },
      {
        $set: {
          title: String(title),
          category: String(category || ""),
          status: ["available", "in_progress", "completed"].includes(status) ? status : "in_progress",
          ...(auditHash ? { auditHash: String(auditHash) } : {}),
          notes: String(notes || ""),
          checkedSteps: Array.isArray(checkedSteps) ? checkedSteps.map(Number) : [],
          proofImageUrls: Array.isArray(proofImageUrls) ? proofImageUrls.map(String) : [],
          heroLocation: String(heroLocation || ""),
          ...(completedAt ? { completedAt: Number(completedAt) } : {}),
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ ok: true, id: doc._id, directiveId: doc.directiveId });
  } catch (err: any) {
    console.error("❌ /api/directives/save error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to save directive" });
  }
});

/**
 * GET /api/directives
 * Admin panel + validator node: list all saved directives, newest first.
 * Optional query: ?status=completed&limit=50
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const filter: Record<string, any> = {};
    if (status && ["available", "in_progress", "completed"].includes(status)) {
      filter.status = status;
    }

    const directives = await Directive.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ ok: true, count: directives.length, directives });
  } catch (err: any) {
    console.error("❌ /api/directives GET error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to fetch directives" });
  }
});

/**
 * GET /api/directives/:directiveId
 * Validator node + admin: fetch a single directive by its client-side ID.
 */
router.get("/:directiveId", async (req: Request, res: Response) => {
  try {
    const doc = await Directive.findOne({ directiveId: req.params.directiveId }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, directive: doc });
  } catch (err: any) {
    console.error("❌ /api/directives/:id GET error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to fetch directive" });
  }
});

export default router;
