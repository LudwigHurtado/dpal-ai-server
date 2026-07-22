import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { isDbConnected } from "../config/db.js";
import { authMiddleware, type AuthedRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { ReedyRiverObservationModel } from "../models/ReedyRiverObservation.js";
import { REEDY_RIVER_TMDL_REFERENCE } from "../features/reedyRiver/reedyRiver.regulatory.js";
import { REEDY_RIVER_PROJECT_ID } from "../features/reedyRiver/reedyRiver.types.js";
import {
  buildReedyRiverCitizenObservation,
  type ReedyRiverCitizenCapturePayload,
} from "../features/reedyRiver/reedyRiver.capture.js";
import { ingestReedyRiverObservations } from "../services/reedyRiver.service.js";
import { mapObservation, sanitizePublicReedyRiverObservation } from "../services/reedyRiver.service.shared.js";

const router = Router();

const captureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "citizen_capture_rate_limited" },
});

const sha256Schema = z.string().regex(/^[a-fA-F0-9]{64}$/);
const captureSchema = z.object({
  dataMode: z.literal("live"),
  stationId: z.string().min(1).max(80),
  capturedAt: z.string().min(1).max(80),
  gps: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().min(0).max(1000),
  }),
  sampleType: z.enum(["field_screening", "laboratory_result"]),
  condition: z.enum(["dry", "rain", "post_rain", "unknown"]),
  methodName: z.string().min(3).max(300),
  laboratoryName: z.string().min(2).max(300).optional(),
  laboratoryCertificationId: z.string().min(2).max(160).optional(),
  measurements: z.object({
    ecoliMpnPer100mL: z.number().min(0).max(100_000_000).optional(),
    turbidityNtu: z.number().min(0).max(1_000_000).optional(),
    conductivityUsPerCm: z.number().min(0).max(10_000_000).optional(),
    waterTemperatureC: z.number().min(-5).max(70).optional(),
  }),
  note: z.string().max(2000).optional(),
  evidence: z.array(z.object({
    sha256: sha256Schema,
    mimeType: z.string().max(200).optional(),
    capturedAt: z.string().max(80).optional(),
  })).max(8).default([]),
  clientHash: sha256Schema,
});

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

function captureErrorStatus(message: string): number {
  if (message === "database_unavailable") return 503;
  if (message === "hash_mismatch") return 400;
  if (message.endsWith("_required") || message.startsWith("ecoli_requires") || message.startsWith("capturedAt_") || message.includes("invalid") || message.includes("not_in_tmdl")) return 400;
  return 500;
}

router.get("/regulatory/tmdl", (_req: Request, res: Response) => {
  noStore(res);
  return res.json({ ok: true, reference: REEDY_RIVER_TMDL_REFERENCE });
});

router.get("/captures", async (req: Request, res: Response) => {
  noStore(res);
  if (!isDbConnected()) {
    return res.status(503).json({ ok: false, error: "database_unavailable", message: "The live evidence store is unavailable; no fallback capture rows were returned." });
  }
  try {
    const filter: Record<string, unknown> = {
      projectId: REEDY_RIVER_PROJECT_ID,
      kind: { $in: ["citizen_field_screening", "citizen_laboratory_result"] },
    };
    if (typeof req.query.stationId === "string" && req.query.stationId.trim()) filter.siteId = req.query.stationId.trim();
    const rows = await ReedyRiverObservationModel.find(filter)
      .sort({ observedAt: -1 })
      .limit(Math.max(1, Math.min(Number(req.query.limit || 25), 100)))
      .lean();
    const captures = rows.map(mapObservation).map(sanitizePublicReedyRiverObservation);
    return res.json({ ok: true, total: captures.length, captures });
  } catch (error: unknown) {
    console.error("[Reedy River captures] list failed", error);
    return res.status(500).json({ ok: false, error: "capture_list_failed" });
  }
});

router.post("/captures", captureLimiter, authMiddleware, async (req: AuthedRequest, res: Response) => {
  noStore(res);
  const parsed = captureSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "validation_error", details: parsed.error.flatten() });
  }
  if (!isDbConnected()) {
    return res.status(503).json({ ok: false, error: "database_unavailable", message: "The live evidence store is unavailable; the capture was not recorded." });
  }
  try {
    const account = await User.findById(String(req.auth?.sub || "")).select("status emailVerified role").lean();
    if (!account) return res.status(401).json({ ok: false, error: "account_not_found" });
    if (account.status !== "active") {
      return res.status(403).json({ ok: false, error: "account_not_active", message: "Citizen-science capture requires an active DPAL account." });
    }
    if (!account.emailVerified) {
      return res.status(403).json({ ok: false, error: "email_verification_required", message: "Verify the DPAL account before submitting field evidence." });
    }

    const built = buildReedyRiverCitizenObservation({
      payload: parsed.data as ReedyRiverCitizenCapturePayload,
      account: { userId: String(req.auth?.sub), role: String(account.role || req.auth?.role || "standard") },
    });
    const result = await ingestReedyRiverObservations([built.observation]);
    return res.status(result.inserted > 0 ? 201 : 200).json({
      ok: true,
      observationId: result.observationIds[0],
      duplicate: result.inserted === 0,
      payloadHash: built.payloadHash,
      canonicalHash: built.canonicalHash,
      hashVerified: true,
      anchored: false,
      anchorRef: null,
      reviewStatus: "qa_pending",
      verified: false,
      certified: false,
      recordedAt: new Date().toISOString(),
      accountGate: "active_verified_account",
      regulatoryUse: "not_regulatory_until_method_and_qa_acceptance",
      message: "The live capture was recorded with a server-verified hash. It is not anchored, verified, certified, or a compliance result.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = captureErrorStatus(message);
    if (status >= 500) console.error("[Reedy River captures] create failed", error);
    return res.status(status).json({
      ok: false,
      error: status >= 500 ? "capture_failed" : message,
      message: status >= 500 ? "The capture was not written to the evidence ledger." : undefined,
    });
  }
});

export default router;
