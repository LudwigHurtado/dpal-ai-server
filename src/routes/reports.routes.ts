import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { connectDb } from "../config/db.js";
import { ReportAnchor } from "../models/ReportAnchor.js";
import { EvidenceArtifact } from "../models/EvidenceArtifact.js";
import { assertTransition, type ReportLifecycleState } from "../domain/reportLifecycle.js";

const router = Router();

type OpsStatus = "New" | "Investigating" | "Action Taken" | "Resolved";

function normalizeOpsStatus(value: any): OpsStatus {
  const input = String(value || "").trim().toLowerCase();
  if (input === "investigating") return "Investigating";
  if (input === "action taken" || input === "action_taken" || input === "action-taken") return "Action Taken";
  if (input === "resolved") return "Resolved";
  return "New";
}

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

async function transitionReportState(reportId: string, next: ReportLifecycleState, patch: Record<string, any> = {}) {
  const doc = await ReportAnchor.findOne({ reportId });
  if (!doc) throw new Error("report_not_found");
  const current = (doc.lifecycleState || "draft") as ReportLifecycleState;
  assertTransition(current, next);
  doc.lifecycleState = next;
  Object.assign(doc, patch);
  await doc.save();
  return doc;
}

router.get("/feed", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const entityType = String(req.query.entityType || "").trim().toLowerCase();
    const entityName = String(req.query.entityName || "").trim().toLowerCase();

    const docs = await ReportAnchor.find({}).sort({ updatedAt: -1 }).limit(limit).lean();

    const items = docs
      .filter((doc: any) => {
        const p = doc.payload || {};
        const pEntityType = String(p.entityType || "").toLowerCase();
        const pEntityName = String(p.entityName || "").toLowerCase();
        if (entityType && !pEntityType.includes(entityType)) return false;
        if (entityName && !pEntityName.includes(entityName)) return false;
        return true;
      })
      .map((doc: any) => {
        const p = doc.payload || {};
        return {
          reportId: doc.reportId,
          title: String(p.title || "Untitled report"),
          category: String(p.category || "General"),
          description: String(p.description || ""),
          location: String(p.location || "Unknown"),
          severity: String(p.severity || "Moderate"),
          channel: String(p.channel || "Web Portal"),
          entityType: String(p.entityType || ""),
          entityName: String(p.entityName || ""),
          lifecycleState: doc.lifecycleState || "draft",
          opsStatus: normalizeOpsStatus(p.opsStatus),
          updatedAt: doc.updatedAt,
          anchoredAt: doc.anchoredAt,
        };
      });

    return res.json({ ok: true, count: items.length, items });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: "feed_read_failed", message: String(error?.message || error) });
  }
});

router.patch("/:reportId/ops-status", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const reportId = String(req.params.reportId || "").trim();
    if (!reportId) return res.status(400).json({ ok: false, error: "missing_report_id" });

    const doc = await ReportAnchor.findOne({ reportId });
    if (!doc) return res.status(404).json({ ok: false, error: "report_not_found" });

    const next = normalizeOpsStatus(req.body?.status);
    const note = String(req.body?.note || "").slice(0, 800);
    const payload = doc.payload || {};
    const history = Array.isArray(payload.opsHistory) ? payload.opsHistory : [];

    payload.opsStatus = next;
    payload.opsHistory = [
      {
        status: next,
        note,
        at: new Date().toISOString(),
      },
      ...history,
    ].slice(0, 50);

    doc.payload = payload;
    await doc.save();

    return res.json({ ok: true, reportId: doc.reportId, opsStatus: next, updatedAt: doc.updatedAt });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: "ops_status_update_failed", message: String(error?.message || error) });
  }
});

router.get("/:reportId/lifecycle", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const reportId = String(req.params.reportId || "").trim();
    const doc = await ReportAnchor.findOne({ reportId }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: "report_not_found" });
    return res.json({
      ok: true,
      reportId: doc.reportId,
      lifecycleState: doc.lifecycleState || "draft",
      submittedAt: doc.submittedAt,
      verifiedAt: doc.verifiedAt,
      anchoredAt: doc.anchoredAt,
      certifiedAt: doc.certifiedAt,
      certificateId: doc.certificateId,
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: "lifecycle_read_failed", message: String(error?.message || error) });
  }
});

router.post("/:reportId/lifecycle/submit", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const reportId = String(req.params.reportId || "").trim();
    const doc = await transitionReportState(reportId, "submitted", { submittedAt: new Date() });
    return res.json({ ok: true, reportId: doc.reportId, lifecycleState: doc.lifecycleState, submittedAt: doc.submittedAt });
  } catch (error: any) {
    return res.status(409).json({ ok: false, error: "invalid_transition", message: String(error?.message || error) });
  }
});

router.post("/:reportId/lifecycle/verify", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const reportId = String(req.params.reportId || "").trim();
    const doc = await transitionReportState(reportId, "verified", { verifiedAt: new Date() });
    return res.json({ ok: true, reportId: doc.reportId, lifecycleState: doc.lifecycleState, verifiedAt: doc.verifiedAt });
  } catch (error: any) {
    return res.status(409).json({ ok: false, error: "invalid_transition", message: String(error?.message || error) });
  }
});

router.post("/:reportId/lifecycle/certify", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const reportId = String(req.params.reportId || "").trim();
    const certificateId = String(req.body?.certificateId || `cert_${Date.now()}`);
    const doc = await transitionReportState(reportId, "certified", { certifiedAt: new Date(), certificateId });
    return res.json({ ok: true, reportId: doc.reportId, lifecycleState: doc.lifecycleState, certifiedAt: doc.certifiedAt, certificateId: doc.certificateId });
  } catch (error: any) {
    return res.status(409).json({ ok: false, error: "invalid_transition", message: String(error?.message || error) });
  }
});

router.post("/:reportId/lifecycle/finalize", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const reportId = String(req.params.reportId || "").trim();
    const doc = await ReportAnchor.findOne({ reportId });
    if (!doc) return res.status(404).json({ ok: false, error: "report_not_found" });

    const current = (doc.lifecycleState || "draft") as ReportLifecycleState;
    if (current === "certified") {
      return res.json({ ok: true, reportId, lifecycleState: current, idempotent: true });
    }

    if (current !== "anchored") {
      return res.status(409).json({
        ok: false,
        error: "invalid_transition",
        message: `Hard Sync finalize requires anchored state. Current state: ${current}`,
      });
    }

    const certificateId = String(req.body?.certificateId || `cert_${Date.now()}`);
    doc.lifecycleState = "certified";
    doc.certifiedAt = new Date();
    doc.certificateId = certificateId;
    await doc.save();

    return res.json({ ok: true, reportId, lifecycleState: doc.lifecycleState, certifiedAt: doc.certifiedAt, certificateId });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: "hard_sync_finalize_failed", message: String(error?.message || error) });
  }
});

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
      channel,
      entityType,
      entityName,
      opsStatus,
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
      channel: String(channel || "Web Portal"),
      entityType: String(entityType || ""),
      entityName: String(entityName || ""),
      opsStatus: normalizeOpsStatus(opsStatus),
      anchoredAt: new Date().toISOString(),
    };

    const canonical = stableStringify(payload);
    const reportHash = `0x${crypto.createHash("sha256").update(canonical).digest("hex")}`;

    const existing = await ReportAnchor.findOne({ reportId: payload.reportId });
    if (existing) {
      const current = (existing.lifecycleState || "draft") as ReportLifecycleState;
      if (current === "anchored" || current === "certified") {
        return res.status(200).json({
          ok: true,
          duplicate: true,
          reportId: existing.reportId,
          reportHash: existing.reportHash,
          txHash: existing.txHash,
          blockNumber: existing.blockNumber,
          chain: existing.chain,
          anchoredAt: existing.anchoredAt,
          lifecycleState: existing.lifecycleState,
          certificateId: existing.certificateId,
        });
      }
      if (current !== "verified") {
        return res.status(409).json({
          ok: false,
          error: "invalid_transition",
          message: `Report must be in verified state before anchoring. Current state: ${current}`,
        });
      }
    }

    const latest = await ReportAnchor.findOne().sort({ blockNumber: -1 }).lean();
    const blockStart = Number(process.env.DPAL_BLOCK_START || 6843021);
    const blockNumber = latest?.blockNumber ? latest.blockNumber + 1 : blockStart;

    const txHash = `0x${crypto.randomBytes(32).toString("hex")}`;
    const chain = process.env.DPAL_CHAIN_NAME || "DPAL_INTERNAL";

    const now = new Date();
    const created = existing
      ? await transitionReportState(payload.reportId, "anchored", {
          reportHash,
          txHash,
          blockNumber,
          chain,
          anchoredAt: now,
          payload,
        })
      : await ReportAnchor.create({
          reportId: payload.reportId,
          reportHash,
          txHash,
          blockNumber,
          chain,
          anchoredAt: now,
          payload,
          lifecycleState: "anchored",
          submittedAt: now,
          verifiedAt: now,
        });

    return res.status(201).json({
      ok: true,
      reportId: created.reportId,
      reportHash: created.reportHash,
      txHash: created.txHash,
      blockNumber: created.blockNumber,
      chain: created.chain,
      anchoredAt: created.anchoredAt,
      lifecycleState: created.lifecycleState,
      legacyBootstrapApplied: !existing,
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

    const timeline = records.map((r) => ({
      at: r.createdAt,
      event: "evidence_recorded",
      evidenceRefId: r.evidenceRefId,
      chainRefId: r.chainRefId,
    }));

    const signedPacketMetadata = {
      signer: process.env.DPAL_PACKET_SIGNER || "DPAL_SERVER_SIGNER_V2",
      algorithm: "SHA256",
      signedAt: new Date().toISOString(),
      utilityOnly: true,
    };

    const packetHash = hashHex(stableStringify({ ...packetBody, timeline, signedPacketMetadata }));

    return res.json({
      ok: true,
      ...packetBody,
      timeline,
      signedPacketMetadata,
      packetHash,
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

router.post("/abuse/check", async (req: Request, res: Response) => {
  try {
    const { fingerprint = "", velocityCount = 0, windowMinutes = 10 } = req.body || {};
    const duplicateLikely = String(fingerprint).trim().length > 0 && Number(velocityCount) > 1;
    const brigadingRisk = Number(velocityCount) >= Math.max(8, windowMinutes);

    return res.json({
      ok: true,
      duplicateLikely,
      brigadingRisk,
      recommendation: brigadingRisk ? "hold_for_review" : duplicateLikely ? "request_additional_evidence" : "allow",
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: "abuse_check_failed", message: String(error?.message || error) });
  }
});

export default router;
