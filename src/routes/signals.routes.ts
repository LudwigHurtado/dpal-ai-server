/**
 * DPAL Global Signals Engine — API Routes
 *
 * GET    /api/signals              — list signals (filters: category, riskLevel, status, country)
 * POST   /api/signals/import       — trigger live feed ingestion (USGS + EONET + OpenAQ)
 * GET    /api/signals/stats        — platform-wide signal statistics
 * GET    /api/signals/:id          — single signal detail
 * PATCH  /api/signals/:id/status   — update signal status + optional reviewer note
 * POST   /api/signals/:id/enrich   — trigger AI enrichment for a specific signal
 * POST   /api/signals/:id/create-mission — convert signal into a DPAL mission record
 */

import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { GlobalSignal } from "../models/GlobalSignal.js";
import {
  runFullSignalImport,
  enrichSignalWithAI,
} from "../services/globalSignals.service.js";

const router = Router();

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

// ── GET /api/signals ──────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, riskLevel, status, country, limit = "60", offset = "0" } = req.query;

    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (riskLevel) filter.riskLevel = riskLevel;
    if (status)    filter.status = status;
    if (country)   filter.country = new RegExp(String(country), "i");

    const total = await GlobalSignal.countDocuments(filter);
    const signals = await GlobalSignal.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 200))
      .lean();

    return res.json({ ok: true, total, signals });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /api/signals/stats ────────────────────────────────────────────────────

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [total, critical, high, missionsCreated, byCategory] = await Promise.all([
      GlobalSignal.countDocuments(),
      GlobalSignal.countDocuments({ riskLevel: "critical" }),
      GlobalSignal.countDocuments({ riskLevel: "high" }),
      GlobalSignal.countDocuments({ status: "mission_created" }),
      GlobalSignal.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
    ]);

    const categories: Record<string, number> = {};
    for (const row of byCategory) categories[row._id as string] = row.count as number;

    return res.json({ ok: true, stats: { total, critical, high, missionsCreated, categories } });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/signals/import ──────────────────────────────────────────────────

router.post("/import", async (_req: Request, res: Response) => {
  try {
    console.log("🌐 Global Signals import triggered via API");
    const result = await runFullSignalImport();
    return res.json({ ok: true, imported: result });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /api/signals/:id ──────────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const signal = await GlobalSignal.findOne({ signalId: req.params.id }).lean();
    if (!signal) return res.status(404).json({ ok: false, error: "Signal not found" });
    return res.json({ ok: true, signal });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── PATCH /api/signals/:id/status ─────────────────────────────────────────────

router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const { status, reviewNote, reviewedBy } = req.body;
    const validStatuses = ["new","reviewed","mission_created","sent_to_verification","verified","closed","logged"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: "Invalid status" });
    }
    const update: Record<string, unknown> = { status };
    if (reviewNote)  update.reviewNote = reviewNote;
    if (reviewedBy)  update.reviewedBy = reviewedBy;

    const signal = await GlobalSignal.findOneAndUpdate(
      { signalId: req.params.id },
      { $set: update },
      { new: true }
    );
    if (!signal) return res.status(404).json({ ok: false, error: "Signal not found" });
    return res.json({ ok: true, signal });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/signals/:id/enrich ──────────────────────────────────────────────

router.post("/:id/enrich", async (req: Request, res: Response) => {
  try {
    await enrichSignalWithAI(String(req.params.id));
    const signal = await GlobalSignal.findOne({ signalId: String(req.params.id) }).lean();
    if (!signal) return res.status(404).json({ ok: false, error: "Signal not found" });
    return res.json({ ok: true, signal });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/signals/:id/create-mission ──────────────────────────────────────

router.post("/:id/create-mission", async (req: Request, res: Response) => {
  try {
    const signal = await GlobalSignal.findOne({ signalId: req.params.id });
    if (!signal) return res.status(404).json({ ok: false, error: "Signal not found" });
    if (signal.status === "mission_created") {
      return res.json({ ok: true, message: "Mission already created", missionId: signal.missionId });
    }

    const { createdBy = "system", createdByName = "DPAL Signal Engine" } = req.body;

    // Build a mission record preserving the original signal ID for full audit trail
    const missionId = uid("SMIS");
    const locationStr = [signal.city, signal.country].filter(Boolean).join(", ") || "Unknown location";

    const missionPayload = {
      missionId,
      title: signal.suggestedMissionTitle || `Verify: ${signal.title}`,
      description: signal.suggestedMissionDescription || signal.aiSummary || signal.description,
      sourceSignalId: signal.signalId,       // AUDIT: links back to originating signal
      sourceCategory: signal.category,
      riskLevel: signal.riskLevel,
      location: locationStr,
      latitude: signal.latitude,
      longitude: signal.longitude,
      status: "open",
      rewardCredits: signal.riskLevel === "critical" ? 150 : signal.riskLevel === "high" ? 100 : 50,
      evidenceRequired: ["photo", "location_confirmation"],
      createdBy,
      createdByName,
      createdAt: new Date(),
    };

    // Update signal status and store mission ID
    await GlobalSignal.updateOne(
      { signalId: req.params.id },
      { $set: { status: "mission_created", missionId } }
    );

    console.log(`🎯 Mission created from signal ${signal.signalId} → ${missionId}`);

    return res.status(201).json({ ok: true, missionId, mission: missionPayload });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
