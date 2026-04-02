import { Router, Request, Response } from "express";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { Wallet } from "../models/Wallet.js";
import { ReportAnchor } from "../models/ReportAnchor.js";

const router = Router();

router.get("/stats", async (req: Request, res: Response, next) => {
  try {
    const [totalEntries, totalWallets, creditAgg] = await Promise.all([
      LedgerEntry.countDocuments(),
      Wallet.countDocuments(),
      Wallet.aggregate([{ $group: { _id: null, totalBalance: { $sum: "$balance" }, totalLocked: { $sum: "$locked" } } }]),
    ]);
    const credits = creditAgg[0] || { totalBalance: 0, totalLocked: 0 };
    res.json({ ok: true, stats: { totalLedgerEntries: totalEntries, totalHeroesWithWallets: totalWallets, totalCreditsInCirculation: credits.totalBalance, totalCreditsLocked: credits.totalLocked } });
  } catch (e) { next(e); }
});

router.get("/anchors", async (req: Request, res: Response, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const anchors = await ReportAnchor.find().sort({ anchoredAt: -1 }).limit(limit).lean();
    res.json({ ok: true, anchors });
  } catch (e) { next(e); }
});

router.get("/anchors/:reportId", async (req: Request, res: Response, next) => {
  try {
    const anchor = await ReportAnchor.findOne({ reportId: req.params.reportId }).lean();
    if (!anchor) return res.status(404).json({ ok: false, error: "Anchor not found" });
    res.json({ ok: true, anchor });
  } catch (e) { next(e); }
});

router.get("/:heroId/summary", async (req: Request, res: Response, next) => {
  try {
    const { heroId } = req.params;
    const [wallet, agg] = await Promise.all([
      Wallet.findOne({ heroId }).lean(),
      LedgerEntry.aggregate([{ $match: { heroId } }, { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    ]);
    const byType: Record<string, any> = {};
    for (const row of agg) byType[row._id] = { total: row.total, count: row.count };
    res.json({ ok: true, heroId, wallet: wallet || { balance: 0, locked: 0 }, summary: byType });
  } catch (e) { next(e); }
});

router.get("/:heroId", async (req: Request, res: Response, next) => {
  try {
    const { heroId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const entries = await LedgerEntry.find({ heroId }).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ ok: true, heroId, entries });
  } catch (e) { next(e); }
});

export default router;
