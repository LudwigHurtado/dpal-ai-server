import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authMiddleware, type AuthedRequest } from "../middleware/auth.js";
import { isDbConnected } from "../config/db.js";
import {
  authenticateReedyRiverIngest,
  configuredReedyRiverSourceIds,
} from "../features/reedyRiver/reedyRiver.security.js";
import {
  mapBirdNetBatch,
  mapSensorThingsBatch,
  normalizeNativeReedyRiverObservation,
  type BirdNetBatchInput,
  type SensorThingsBatchInput,
} from "../features/reedyRiver/reedyRiver.ingest.js";
import type {
  ReedyRiverActionStatus,
  ReedyRiverReviewStatus,
  ReedyRiverSourceType,
} from "../features/reedyRiver/reedyRiver.types.js";
import {
  generateReedyRiverReport,
  getLatestReedyRiverReport,
  getReedyRiverObservation,
  getReedyRiverOverview,
  getReedyRiverReport,
  getReedyRiverReportExport,
  ingestReedyRiverObservations,
  listReedyRiverActions,
  listReedyRiverObservations,
  listReedyRiverReports,
  pollUsgsReedyRiver,
  reviewReedyRiverObservation,
  transitionReedyRiverAction,
  startReedyRiverScheduler,
} from "../services/reedyRiver.service.js";

const router = Router();
const ingestLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "reedy_river_ingest_rate_limited" },
});

const SOURCE_TYPES: ReedyRiverSourceType[] = [
  "bioacoustic_sensor",
  "invasive_plant_survey",
  "water_quality_sensor",
  "hydrology_public_api",
  "camera_trap",
  "field_activity",
  "sensor_heartbeat",
  "weather_public_api",
  "other",
];
const REVIEW_STATUSES: ReedyRiverReviewStatus[] = [
  "machine_candidate",
  "field_observed",
  "qa_pending",
  "qa_passed",
  "expert_confirmed",
  "rejected",
];
const ACTION_STATUSES: ReedyRiverActionStatus[] = [
  "proposed",
  "triaged",
  "assigned",
  "in_progress",
  "awaiting_expert",
  "blocked",
  "completed",
  "dismissed",
];

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStatus(message: string): number {
  if (message === "database_unavailable") return 503;
  if (message.endsWith("_not_found")) return 404;
  if (message.startsWith("invalid_")) return 409;
  if (message.includes("requires") || message.includes("must") || message.includes("Missing")) return 400;
  return 500;
}

function sendError(res: Response, error: unknown): Response {
  const message = errorMessage(error);
  const status = errorStatus(message);
  if (status >= 500) {
    console.error("[Reedy River API]", message);
    if (status === 503) {
      return res.status(503).json({
        ok: false,
        error: "database_unavailable",
        message: "The live Reedy River evidence store is unavailable; no fallback or demo data was returned.",
      });
    }
    return res.status(status).json({
      ok: false,
      error: "internal_error",
      message: "The Reedy River operation failed without changing the evidence or action ledger.",
    });
  }
  return res.status(status).json({ ok: false, error: message });
}

function requireReedyOperator(req: AuthedRequest, res: Response, next: NextFunction): unknown {
  return authMiddleware(req, res, () => {
    const role = req.auth?.role;
    if (!role || !["admin", "moderator", "validator"].includes(role)) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
        message: "Reedy River review and action changes require an admin, moderator, or validator account.",
      });
    }
    return next();
  });
}

function ingestPrincipal(req: Request, res: Response): { sourceId: string; hmacVerified: boolean } | null {
  try {
    return authenticateReedyRiverIngest(req);
  } catch (error: unknown) {
    const message = errorMessage(error);
    const status = message.includes("not configured") || message.includes("not valid JSON") ? 503 : 401;
    res.status(status).json({ ok: false, error: message });
    return null;
  }
}

const nativeBatchSchema = z.object({
  observations: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
});

const birdNetBatchSchema = z.object({
  dataMode: z.literal("live"),
  sourceId: z.string().min(1).max(160),
  siteId: z.string().min(1).max(200),
  location: z.object({
    publicLabel: z.string().min(1).max(300),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    precisionMeters: z.number().min(0).max(1_000_000).optional(),
  }),
  provenance: z.object({
    provider: z.string().max(300).optional(),
    method: z.string().max(500).optional(),
    deviceModel: z.string().max(300).optional(),
    modelName: z.string().max(300).optional(),
    modelVersion: z.string().max(300).optional(),
    sourceUrl: z.string().url().max(2000).optional(),
    license: z.string().max(300).optional(),
  }),
  detections: z.array(z.object({
    detectionId: z.union([z.string(), z.number()]).transform(String).optional(),
    observedAt: z.string().min(1),
    confidence: z.number().min(0).max(1),
    commonName: z.string().max(240).optional(),
    scientificName: z.string().max(240).optional(),
    taxonId: z.string().max(240).optional(),
    startSeconds: z.number().min(0).optional(),
    endSeconds: z.number().min(0).optional(),
    frequencyHz: z.number().min(0).optional(),
    audioUri: z.string().max(2000).optional(),
    audioSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
    notes: z.string().max(1000).optional(),
  })).min(1).max(500),
});

const sensorThingsBatchSchema = z.object({
  dataMode: z.literal("live"),
  sourceId: z.string().min(1).max(160),
  siteId: z.string().min(1).max(200),
  location: z.object({
    publicLabel: z.string().min(1).max(300),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    precisionMeters: z.number().min(0).max(1_000_000).optional(),
  }),
  provenance: z.object({
    provider: z.string().max(300).optional(),
    method: z.string().max(500).optional(),
    deviceModel: z.string().max(300).optional(),
    sourceUrl: z.string().url().max(2000).optional(),
    license: z.string().max(300).optional(),
  }).optional(),
  observations: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
});

const actionTransitionSchema = z.object({
  toStatus: z.enum(ACTION_STATUSES as [ReedyRiverActionStatus, ...ReedyRiverActionStatus[]]),
  assignedTo: z.string().min(1).max(200).optional(),
  assignedToLabel: z.string().min(1).max(300).optional(),
  note: z.string().min(1).max(2000),
});

const reviewSchema = z.object({
  toStatus: z.enum(REVIEW_STATUSES as [ReedyRiverReviewStatus, ...ReedyRiverReviewStatus[]]),
  note: z.string().min(8).max(2000),
});

router.get("/health", (_req: Request, res: Response) => {
  noStore(res);
  return res.json({
    ok: true,
    service: "reedy-river-live-operations",
    projectId: "reedy-river-sc",
    databaseConnected: isDbConnected(),
    dataPolicy: "live_only",
    reportCadenceHours: 3,
    configuredIngestSourceCount: configuredReedyRiverSourceIds().length,
    usgsStationId: process.env.REEDY_RIVER_USGS_STATION_ID || "USGS-02164000",
    ts: new Date().toISOString(),
  });
});

router.get("/integration", (_req: Request, res: Response) => {
  noStore(res);
  return res.json({
    ok: true,
    projectId: "reedy-river-sc",
    policy: {
      dataMode: "live only",
      demoPayloads: "rejected",
      exactCoordinates: "stored for authorized operations; omitted from public responses",
      machineSpeciesOutput: "machine_candidate only",
      treatmentGate: "expert confirmation and operational approval required",
    },
    authentication: {
      requiredHeaders: ["X-DPAL-Source-Id", "X-DPAL-Ingest-Key"],
      signedHeaders: ["X-DPAL-Timestamp", "X-DPAL-Signature"],
      signature: "hex HMAC-SHA256(secret, `${ISO_TIMESTAMP}.${raw_request_body}`); prefix sha256= is optional",
      timestampWindowMinutes: 5,
    },
    endpoints: [
      { method: "POST", path: "/api/ecology/reedy-river/ingest/native", use: "DPAL field, lab, camera, water, and activity batches" },
      { method: "POST", path: "/api/ecology/reedy-river/ingest/birdnet", use: "BirdNET detections plus original-audio evidence references" },
      { method: "POST", path: "/api/ecology/reedy-river/ingest/sensorthings", use: "OGC SensorThings Observation batches from university IoT gateways" },
      { method: "GET", path: "/api/ecology/reedy-river/overview", use: "Live dashboard, latest report, public action plan, and public-safe observations" },
      { method: "GET", path: "/api/ecology/reedy-river/overview/private", use: "Authorized operator dashboard with assignments, transition history, and restricted locations" },
      { method: "GET", path: "/api/ecology/reedy-river/observations/:id/private", use: "Authorized field location and restricted provenance lookup" },
      { method: "GET", path: "/api/ecology/reedy-river/reports/:reportId/export?format=markdown|csv|json", use: "Three-hour report documents and tables" },
    ],
    minimumNativeObservation: {
      idempotencyKey: "university-lab-2026-07-22T12:00Z-sample-1",
      dataMode: "live",
      sourceType: "water_quality_sensor",
      sourceId: "must-match-X-DPAL-Source-Id",
      siteId: "institution-controlled-site-id",
      observedAt: "ISO-8601 timestamp",
      kind: "water_quality_measurement",
      reviewStatus: "qa_pending",
      data: { parameterName: "turbidity", value: 0, unit: "FNU" },
      location: { publicLabel: "Reedy River monitoring zone" },
      provenance: { provider: "University program name", method: "documented field or sensor method" },
    },
  });
});

router.get("/overview", async (_req: Request, res: Response) => {
  noStore(res);
  try {
    return res.json(await getReedyRiverOverview({ publicSafe: true }));
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.get("/overview/private", requireReedyOperator, async (_req: AuthedRequest, res: Response) => {
  noStore(res);
  try {
    return res.json(await getReedyRiverOverview({ publicSafe: false }));
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.get("/observations", async (req: Request, res: Response) => {
  noStore(res);
  try {
    const sourceType = typeof req.query.sourceType === "string" && SOURCE_TYPES.includes(req.query.sourceType as ReedyRiverSourceType)
      ? (req.query.sourceType as ReedyRiverSourceType)
      : undefined;
    const reviewStatus = typeof req.query.reviewStatus === "string" && REVIEW_STATUSES.includes(req.query.reviewStatus as ReedyRiverReviewStatus)
      ? (req.query.reviewStatus as ReedyRiverReviewStatus)
      : undefined;
    const observations = await listReedyRiverObservations({
      limit: Number(req.query.limit || 100),
      sourceType,
      reviewStatus,
      siteId: typeof req.query.siteId === "string" ? req.query.siteId : undefined,
      since: typeof req.query.since === "string" ? req.query.since : undefined,
      before: typeof req.query.before === "string" ? req.query.before : undefined,
      publicSafe: true,
    });
    return res.json({ ok: true, total: observations.length, observations });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.get("/observations/:observationId/private", requireReedyOperator, async (req: AuthedRequest, res: Response) => {
  noStore(res);
  try {
    const observation = await getReedyRiverObservation(String(req.params.observationId), false);
    return observation
      ? res.json({ ok: true, observation })
      : res.status(404).json({ ok: false, error: "observation_not_found" });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.patch("/observations/:observationId/review", requireReedyOperator, async (req: AuthedRequest, res: Response) => {
  noStore(res);
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "validation_error", details: parsed.error.flatten() });
  try {
    const observation = await reviewReedyRiverObservation({
      observationId: String(req.params.observationId),
      toStatus: parsed.data.toStatus,
      actorId: String(req.auth?.sub || "unknown"),
      actorLabel: String(req.auth?.email || req.auth?.role || "DPAL reviewer"),
      note: parsed.data.note,
    });
    return res.json({ ok: true, observation });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.post("/ingest/native", ingestLimiter, async (req: Request, res: Response) => {
  noStore(res);
  const principal = ingestPrincipal(req, res);
  if (!principal) return;
  const parsed = nativeBatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "validation_error", details: parsed.error.flatten() });
  try {
    const observations = parsed.data.observations.map((row: Record<string, unknown>) => normalizeNativeReedyRiverObservation(row, principal.sourceId));
    const result = await ingestReedyRiverObservations(observations);
    return res.status(202).json({ ok: true, sourceId: principal.sourceId, hmacVerified: principal.hmacVerified, ...result });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.post("/ingest/birdnet", ingestLimiter, async (req: Request, res: Response) => {
  noStore(res);
  const principal = ingestPrincipal(req, res);
  if (!principal) return;
  const parsed = birdNetBatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "validation_error", details: parsed.error.flatten() });
  try {
    const observations = mapBirdNetBatch(parsed.data as BirdNetBatchInput, principal.sourceId);
    const result = await ingestReedyRiverObservations(observations);
    return res.status(202).json({ ok: true, sourceId: principal.sourceId, hmacVerified: principal.hmacVerified, ...result });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.post("/ingest/sensorthings", ingestLimiter, async (req: Request, res: Response) => {
  noStore(res);
  const principal = ingestPrincipal(req, res);
  if (!principal) return;
  const parsed = sensorThingsBatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "validation_error", details: parsed.error.flatten() });
  try {
    const observations = mapSensorThingsBatch(parsed.data as unknown as SensorThingsBatchInput, principal.sourceId);
    const result = await ingestReedyRiverObservations(observations);
    return res.status(202).json({ ok: true, sourceId: principal.sourceId, hmacVerified: principal.hmacVerified, ...result });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.post("/sources/usgs/poll", requireReedyOperator, async (_req: AuthedRequest, res: Response) => {
  noStore(res);
  try {
    const result = await pollUsgsReedyRiver();
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.get("/reports/latest", async (_req: Request, res: Response) => {
  noStore(res);
  try {
    const report = await getLatestReedyRiverReport();
    return report ? res.json({ ok: true, report }) : res.status(404).json({ ok: false, error: "report_not_found" });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.get("/reports", async (req: Request, res: Response) => {
  noStore(res);
  try {
    const reports = await listReedyRiverReports(Number(req.query.limit || 20));
    return res.json({ ok: true, total: reports.length, reports });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.post("/reports/run", requireReedyOperator, async (req: AuthedRequest, res: Response) => {
  noStore(res);
  try {
    const windowEnd = typeof req.body?.windowEnd === "string" ? new Date(req.body.windowEnd) : undefined;
    if (windowEnd && !Number.isFinite(windowEnd.getTime())) {
      return res.status(400).json({ ok: false, error: "windowEnd must be an ISO-8601 timestamp" });
    }
    const report = await generateReedyRiverReport({ windowEnd, force: Boolean(req.body?.force) });
    return res.json({ ok: true, report });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.get("/reports/:reportId/export", async (req: Request, res: Response) => {
  noStore(res);
  const formatRaw = String(req.query.format || "json").toLowerCase();
  const format = formatRaw === "csv" ? "csv" : formatRaw === "markdown" || formatRaw === "md" ? "markdown" : "json";
  try {
    const exported = await getReedyRiverReportExport(String(req.params.reportId), format);
    res.setHeader("Content-Type", exported.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
    return res.send(exported.body);
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.get("/reports/:reportId", async (req: Request, res: Response) => {
  noStore(res);
  try {
    const report = await getReedyRiverReport(String(req.params.reportId));
    return report ? res.json({ ok: true, report }) : res.status(404).json({ ok: false, error: "report_not_found" });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.get("/actions", async (req: Request, res: Response) => {
  noStore(res);
  try {
    const status = typeof req.query.status === "string" && ACTION_STATUSES.includes(req.query.status as ReedyRiverActionStatus)
      ? (req.query.status as ReedyRiverActionStatus)
      : undefined;
    const actions = await listReedyRiverActions({
      status,
      includeTerminal: req.query.includeTerminal === "true",
      limit: Number(req.query.limit || 100),
      publicSafe: true,
    });
    return res.json({ ok: true, total: actions.length, actions });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.get("/actions/private", requireReedyOperator, async (req: AuthedRequest, res: Response) => {
  noStore(res);
  try {
    const status = typeof req.query.status === "string" && ACTION_STATUSES.includes(req.query.status as ReedyRiverActionStatus)
      ? (req.query.status as ReedyRiverActionStatus)
      : undefined;
    const actions = await listReedyRiverActions({
      status,
      includeTerminal: req.query.includeTerminal === "true",
      limit: Number(req.query.limit || 100),
      publicSafe: false,
    });
    return res.json({ ok: true, total: actions.length, actions });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

router.patch("/actions/:actionId/transition", requireReedyOperator, async (req: AuthedRequest, res: Response) => {
  noStore(res);
  const parsed = actionTransitionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "validation_error", details: parsed.error.flatten() });
  try {
    const action = await transitionReedyRiverAction({
      actionId: String(req.params.actionId),
      toStatus: parsed.data.toStatus,
      actorId: String(req.auth?.sub || "unknown"),
      actorLabel: String(req.auth?.email || req.auth?.role || "DPAL operator"),
      assignedTo: parsed.data.assignedTo,
      assignedToLabel: parsed.data.assignedToLabel,
      note: parsed.data.note,
    });
    return res.json({ ok: true, action });
  } catch (error: unknown) {
    return sendError(res, error);
  }
});

startReedyRiverScheduler();

export default router;
