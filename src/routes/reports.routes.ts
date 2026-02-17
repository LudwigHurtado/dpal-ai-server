import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { connectDb } from "../config/db.js";
import { ReportAnchor } from "../models/ReportAnchor.js";

const router = Router();

function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`;
}

router.post("/anchor", async (req: Request, res: Response) => {
  try {
    await connectDb();

    const {
      reportId,
      title,
      description,
      category,
      location,
      trustScore,
      severity,
      isActionable,
      structuredData,
    } = req.body || {};

    if (!reportId || !title || !description || !category) {
      return res.status(400).json({
        ok: false,
        error: "missing_required_fields",
        message: "reportId, title, description, and category are required",
      });
    }

    const payload = {
      reportId: String(reportId),
      title: String(title),
      description: String(description),
      category: String(category),
      location: String(location || ""),
      trustScore: Number(trustScore || 0),
      severity: String(severity || "Standard"),
      isActionable: Boolean(isActionable),
      structuredData: structuredData || {},
      anchoredAt: new Date().toISOString(),
    };

    const canonical = stableStringify(payload);
    const reportHash = `0x${crypto.createHash("sha256").update(canonical).digest("hex")}`;

    const existing = await ReportAnchor.findOne({ reportId: payload.reportId }).lean();
    if (existing) {
      return res.status(200).json({
        ok: true,
        duplicate: true,
        reportId: existing.reportId,
        reportHash: existing.reportHash,
        txHash: existing.txHash,
        blockNumber: existing.blockNumber,
        chain: existing.chain,
        anchoredAt: existing.anchoredAt,
      });
    }

    const latest = await ReportAnchor.findOne().sort({ blockNumber: -1 }).lean();
    const blockStart = Number(process.env.DPAL_BLOCK_START || 6843021);
    const blockNumber = latest?.blockNumber ? latest.blockNumber + 1 : blockStart;

    const txHash = `0x${crypto.randomBytes(32).toString("hex")}`;
    const chain = process.env.DPAL_CHAIN_NAME || "DPAL_INTERNAL";

    const created = await ReportAnchor.create({
      reportId: payload.reportId,
      reportHash,
      txHash,
      blockNumber,
      chain,
      anchoredAt: new Date(),
      payload,
    });

    return res.status(201).json({
      ok: true,
      reportId: created.reportId,
      reportHash: created.reportHash,
      txHash: created.txHash,
      blockNumber: created.blockNumber,
      chain: created.chain,
      anchoredAt: created.anchoredAt,
    });
  } catch (error: any) {
    console.error("Report anchor error:", error);
    return res.status(500).json({
      ok: false,
      error: "anchor_failed",
      message: String(error?.message || "Failed to anchor report"),
    });
  }
});

export default router;
