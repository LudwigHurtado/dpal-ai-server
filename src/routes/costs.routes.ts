import { Router, Request, Response } from "express";
import { ServiceCost } from "../models/ServiceCost.js";

const router = Router();

router.get("/", async (req: Request, res: Response, next) => {
  try {
    const { year, month } = req.query;
    const query: any = {};
    if (year) query.periodYear = Number(year);
    if (month) query.periodMonth = Number(month);
    const costs = await ServiceCost.find(query).sort({ periodYear: -1, periodMonth: -1 }).lean();
    res.json({ ok: true, costs });
  } catch (e) { next(e); }
});

router.get("/summary", async (req: Request, res: Response, next) => {
  try {
    const now = new Date();
    const year = Number((req.query.year as string) || now.getFullYear());
    const month = Number((req.query.month as string) || now.getMonth() + 1);
    const [monthly, byCategory, byService, ytd] = await Promise.all([
      ServiceCost.aggregate([{ $match: { periodYear: year, periodMonth: month } }, { $group: { _id: null, total: { $sum: "$amountUsd" }, budget: { $sum: "$budgetUsd" } } }]),
      ServiceCost.aggregate([{ $match: { periodYear: year, periodMonth: month } }, { $group: { _id: "$category", total: { $sum: "$amountUsd" } } }, { $sort: { total: -1 } }]),
      ServiceCost.aggregate([{ $match: { periodYear: year, periodMonth: month } }, { $group: { _id: "$service", label: { $first: "$label" }, total: { $sum: "$amountUsd" }, budget: { $sum: "$budgetUsd" } } }, { $sort: { total: -1 } }]),
      ServiceCost.aggregate([{ $match: { periodYear: year } }, { $group: { _id: null, total: { $sum: "$amountUsd" } } }]),
    ]);
    res.json({
      ok: true, period: { year, month },
      monthlyTotal: monthly[0]?.total || 0, monthlyBudget: monthly[0]?.budget || 0, ytdTotal: ytd[0]?.total || 0,
      byCategory: byCategory.map((c: any) => ({ category: c._id, total: c.total })),
      byService: byService.map((s: any) => ({ service: s._id, label: s.label, total: s.total, budget: s.budget })),
    });
  } catch (e) { next(e); }
});

router.get("/trend", async (req: Request, res: Response, next) => {
  try {
    const months = Math.min(Number(req.query.months) || 6, 24);
    const trend = await ServiceCost.aggregate([
      { $group: { _id: { year: "$periodYear", month: "$periodMonth" }, total: { $sum: "$amountUsd" } } },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: months },
    ]);
    res.json({ ok: true, trend: trend.reverse() });
  } catch (e) { next(e); }
});

router.post("/", async (req: Request, res: Response, next) => {
  try {
    const { service, label, category, periodYear, periodMonth, amountUsd, budgetUsd, usageDetails, invoiceUrl, notes } = req.body;
    if (!service || !periodYear || !periodMonth) return res.status(400).json({ ok: false, error: "service, periodYear, periodMonth required" });
    const cost = await ServiceCost.findOneAndUpdate(
      { service, periodYear: Number(periodYear), periodMonth: Number(periodMonth) },
      { $set: { label: label || service, category, amountUsd, budgetUsd, usageDetails, invoiceUrl, notes } },
      { new: true, upsert: true }
    );
    res.json({ ok: true, cost });
  } catch (e) { next(e); }
});

export default router;
