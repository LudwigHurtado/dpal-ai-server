import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { connectDb } from "../config/db.js";
import { ReportAnchor } from "../models/ReportAnchor.js";
import { EvidenceArtifact } from "../models/EvidenceArtifact.js";

const router = Router();

function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`;
}

function hashHex(value: string): string {
  return `0x${crypto.createHash("sha256").update(value).digest("hex")}`;
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

router.post("/:reportId/evidence", async (req: Request, res: Response) => {
  try {
    await connectDb();

    const reportId = String(req.params.reportId || "").trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!reportId) {
      return res.status(400).json({ ok: false, error: "missing_report_id" });
    }

    if (!items.length) {
      return res.status(400).json({ ok: false, error: "missing_items" });
    }

    const now = new Date();
    const createdRecords = [] as any[];

    for (const item of items) {
      const filename = String(item?.filename || "evidence.bin").slice(0, 180);
      const mimeType = String(item?.mimeType || "application/octet-stream").slice(0, 120);
      const sizeBytes = Number(item?.sizeBytes || 0);
      const sha256 = String(item?.sha256 || "");
      const timestampIso = String(item?.timestampIso || now.toISOString());

      if (!sha256 || !sha256.startsWith("0x")) {
        continue;
      }

      const evidenceRefId = `evd_${crypto.randomBytes(8).toString("hex")}`;
      const timestampHash = hashHex(`${timestampIso}|${sha256}`);
      const chainRefId = hashHex(`${reportId}|${evidenceRefId}|${sha256}|${timestampIso}`);

      const created = await EvidenceArtifact.create({
        reportId,
        evidenceRefId,
        filename,
        mimeType,
        sizeBytes,
        sha256,
        timestampIso,
        timestampHash,
        chainRefId,
      });

      createdRecords.push(created);
    }

    const verificationBaseUrl = `${req.protocol}://${req.get("host")}/api/reports/${encodeURIComponent(reportId)}/evidence/verify`;

    return res.status(201).json({
      ok: true,
      reportId,
      records: createdRecords.map((r) => ({
        evidenceRefId: r.evidenceRefId,
        filename: r.filename,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        sha256: r.sha256,
        timestampIso: r.timestampIso,
        timestampHash: r.timestampHash,
        chainRefId: r.chainRefId,
        verificationLink: `${verificationBaseUrl}/${encodeURIComponent(r.evidenceRefId)}`,
      })),
    });
  } catch (error: any) {
    console.error("Evidence create error:", error);
    return res.status(500).json({ ok: false, error: "evidence_create_failed", message: String(error?.message || error) });
  }
});

router.get("/:reportId/evidence", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const reportId = String(req.params.reportId || "").trim();
    if (!reportId) return res.status(400).json({ ok: false, error: "missing_report_id" });

    const records = await EvidenceArtifact.find({ reportId }).sort({ createdAt: 1 }).lean();
    const verificationBaseUrl = `${req.protocol}://${req.get("host")}/api/reports/${encodeURIComponent(reportId)}/evidence/verify`;

    return res.json({
      ok: true,
      reportId,
      records: records.map((r) => ({
        evidenceRefId: r.evidenceRefId,
        filename: r.filename,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        sha256: r.sha256,
        timestampIso: r.timestampIso,
        timestampHash: r.timestampHash,
        chainRefId: r.chainRefId,
        verificationLink: `${verificationBaseUrl}/${encodeURIComponent(r.evidenceRefId)}`,
      })),
    });
  } catch (error: any) {
    console.error("Evidence list error:", error);
    return res.status(500).json({ ok: false, error: "evidence_list_failed", message: String(error?.message || error) });
  }
});

router.get("/:reportId/evidence/verify/:evidenceRefId", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const reportId = String(req.params.reportId || "").trim();
    const evidenceRefId = String(req.params.evidenceRefId || "").trim();

    const record = await EvidenceArtifact.findOne({ reportId, evidenceRefId }).lean();
    if (!record) {
      return res.status(404).json({ ok: false, error: "evidence_not_found" });
    }

    const expectedTimestampHash = hashHex(`${record.timestampIso}|${record.sha256}`);
    const expectedChainRefId = hashHex(`${record.reportId}|${record.evidenceRefId}|${record.sha256}|${record.timestampIso}`);

    return res.json({
      ok: true,
      reportId,
      evidenceRefId,
      checks: {
        timestampHashValid: expectedTimestampHash === record.timestampHash,
        chainRefValid: expectedChainRefId === record.chainRefId,
      },
      record,
    });
  } catch (error: any) {
    console.error("Evidence verify error:", error);
    return res.status(500).json({ ok: false, error: "evidence_verify_failed", message: String(error?.message || error) });
  }
});

router.get("/:reportId/evidence/packet", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const reportId = String(req.params.reportId || "").trim();
    if (!reportId) return res.status(400).json({ ok: false, error: "missing_report_id" });

    const records = await EvidenceArtifact.find({ reportId }).sort({ createdAt: 1 }).lean();
    const verificationBaseUrl = `${req.protocol}://${req.get("host")}/api/reports/${encodeURIComponent(reportId)}/evidence/verify`;

    const packetBody = {
      reportId,
      generatedAt: new Date().toISOString(),
      recordCount: records.length,
      records: records.map((r) => ({
        evidenceRefId: r.evidenceRefId,
        filename: r.filename,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        sha256: r.sha256,
        timestampIso: r.timestampIso,
        timestampHash: r.timestampHash,
        chainRefId: r.chainRefId,
      })),
    };

    return res.json({
      ok: true,
      ...packetBody,
      packetHash: hashHex(stableStringify(packetBody)),
      verificationBaseUrl,
      records: packetBody.records.map((r) => ({
        ...r,
        verificationLink: `${verificationBaseUrl}/${encodeURIComponent(r.evidenceRefId)}`,
      })),
    });
  } catch (error: any) {
    console.error("Evidence packet error:", error);
    return res.status(500).json({ ok: false, error: "evidence_packet_failed", message: String(error?.message || error) });
  }
});

export default router;
