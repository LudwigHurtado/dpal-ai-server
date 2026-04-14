/**
 * DPAL Water Monitor MVP — API Routes
 *
 * /api/water/projects          — project registration & listing
 * /api/water/projects/:id/snapshots/mock-refresh — satellite data pull (mock)
 * /api/water/projects/:id/snapshots              — snapshot history
 * /api/water/projects/:id/reports/generate       — impact report generation
 * /api/water/projects/:id/reports                — report history
 * /api/water/validator/queue   — validator review queue
 * /api/water/validator/reviews — submit validator review
 * /api/water/projects/:id/credits/issue — issue water impact credits
 * /api/water/credits           — credit listing
 * /api/water/credits/:id/list  — list credit on marketplace
 * /api/water/credits/:id/retire — retire credit
 * /api/water/stats             — platform statistics
 * /api/water/activity/feed     — transaction activity feed
 */

import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { WaterProject } from "../models/WaterProject.js";
import { WaterSnapshot } from "../models/WaterSnapshot.js";
import { WaterImpactReport } from "../models/WaterImpactReport.js";
import { WaterCredit } from "../models/WaterCredit.js";
import { WaterTransaction } from "../models/WaterTransaction.js";
import { calculateWaterImpactScore } from "../services/waterImpactScore.service.js";
import { fetchSmapData } from "../services/adapters/smap.adapter.js";
import { fetchSwotData } from "../services/adapters/swot.adapter.js";
import { fetchGraceData } from "../services/adapters/grace.adapter.js";
import { fetchGibsData } from "../services/adapters/gibs.adapter.js";
import { fetchCopernicusData } from "../services/adapters/copernicus.adapter.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function waterHash(data: string): string {
  return "wtr-" + crypto.createHash("sha256").update(data).digest("hex").substring(0, 16);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PROJECTS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/water/projects
router.post("/projects", async (req: Request, res: Response) => {
  try {
    const {
      ownerId,
      ownerName,
      projectName,
      projectType,
      description,
      country,
      region,
      city,
      lat,
      lng,
      polygon,
      totalAcres,
      baselineDate,
      improvementGoal,
      evidenceUrls,
    } = req.body;

    if (!projectName || !projectType || !country) {
      return res
        .status(400)
        .json({ ok: false, error: "projectName, projectType, country required" });
    }

    const projectId = uid("WPJ");
    const project = await WaterProject.create({
      projectId,
      ownerId: String(ownerId || "demo-user-001"),
      ownerName: String(ownerName || "Anonymous"),
      projectName: String(projectName),
      projectType: String(projectType),
      description: String(description || ""),
      location: {
        country: String(country),
        region: String(region || ""),
        city: String(city || ""),
        gpsCenter: { lat: Number(lat || 0), lng: Number(lng || 0) },
        polygon: Array.isArray(polygon) ? polygon : [],
      },
      totalAcres: Number(totalAcres || 0),
      baselineDate: String(baselineDate || new Date().toISOString().split("T")[0]),
      improvementGoal: String(improvementGoal || ""),
      evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
      status: "submitted",
    });

    console.log(`💧 Water project registered: ${projectId} — ${projectName} (${projectType})`);
    return res.status(201).json({ ok: true, project });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// GET /api/water/projects
router.get("/projects", async (req: Request, res: Response) => {
  try {
    const { ownerId, status, limit = "50" } = req.query;
    const filter: Record<string, string> = {};
    if (ownerId) filter.ownerId = String(ownerId);
    if (status) filter.status = String(status);
    const projects = await WaterProject.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(100, Number(limit)))
      .lean();
    return res.json({ ok: true, projects });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// GET /api/water/projects/:id
router.get("/projects/:id", async (req: Request, res: Response) => {
  try {
    const project = await WaterProject.findOne({ projectId: req.params.id }).lean();
    if (!project) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, project });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// PATCH /api/water/projects/:id
router.patch("/projects/:id", async (req: Request, res: Response) => {
  try {
    const allowed = [
      "projectName",
      "description",
      "status",
      "adminNotes",
      "improvementGoal",
      "totalAcres",
      "baselineDate",
      "evidenceUrls",
      "baselineWaterIndex",
    ];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }
    const project = await WaterProject.findOneAndUpdate(
      { projectId: req.params.id },
      { $set: update },
      { new: true }
    ).lean();
    if (!project) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, project });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// DELETE /api/water/projects/:id
router.delete("/projects/:id", async (req: Request, res: Response) => {
  try {
    const project = await WaterProject.findOneAndDelete({ projectId: req.params.id });
    if (!project) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/water/projects/:id/snapshots/mock-refresh
router.post(
  "/projects/:id/snapshots/mock-refresh",
  async (req: Request, res: Response) => {
    try {
      const project = await WaterProject.findOne({ projectId: req.params.id });
      if (!project) return res.status(404).json({ ok: false, error: "Project not found" });

      const polygon = project.location.polygon;
      const baselineDate = project.baselineDate || new Date().toISOString().split("T")[0];
      const targetDate = new Date().toISOString().split("T")[0];

      // Call all 5 adapters in parallel; swallow individual failures
      const [smapResult, swotResult, graceResult, gibsResult, copernicusResult] =
        await Promise.all([
          fetchSmapData(polygon, baselineDate, targetDate).catch(() => null),
          fetchSwotData(polygon, baselineDate, targetDate).catch(() => null),
          fetchGraceData(polygon, baselineDate, targetDate).catch(() => null),
          fetchGibsData(polygon, baselineDate, targetDate).catch(() => null),
          fetchCopernicusData(polygon, baselineDate, targetDate).catch(() => null),
        ]);

      // Merge results into combined metrics
      const soilMoistureIndex =
        smapResult?.soilMoistureIndex ?? copernicusResult?.soilMoistureIndex ?? 0.4;
      const surfaceWaterLevel =
        swotResult?.surfaceWaterLevel ?? copernicusResult?.surfaceWaterLevel ?? 1.0;
      const waterStorageTrend =
        graceResult?.waterStorageTrend ?? copernicusResult?.waterStorageTrend ?? 0;
      const vegetationStress =
        gibsResult?.vegetationStress ?? copernicusResult?.vegetationStress ?? 0.3;
      const droughtRisk =
        gibsResult?.droughtRisk ?? copernicusResult?.droughtRisk ?? 0.2;
      const usageReductionEstimate =
        copernicusResult?.usageReductionEstimate ?? 0;

      // Average confidence score from available adapters
      const confidenceValues = [
        smapResult?.confidenceScore,
        swotResult?.confidenceScore,
        graceResult?.confidenceScore,
        gibsResult?.confidenceScore,
        copernicusResult?.confidenceScore,
      ].filter((v): v is number => v != null);

      const confidenceScore =
        confidenceValues.length > 0
          ? parseFloat(
              (
                confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
              ).toFixed(3)
            )
          : 0.7;

      // Detect anomaly flags
      const anomalyFlags: string[] = [];
      if (droughtRisk > 0.7) anomalyFlags.push("HIGH_DROUGHT_RISK");
      if (soilMoistureIndex < 0.2) anomalyFlags.push("LOW_SOIL_MOISTURE");
      if (waterStorageTrend < -3) anomalyFlags.push("DECLINING_STORAGE");

      // Check if this is the first snapshot (baseline)
      const existingCount = await WaterSnapshot.countDocuments({
        projectId: req.params.id,
      });
      const isBaseline = existingCount === 0;

      const snapshotId = uid("WSN");
      const snapshot = await WaterSnapshot.create({
        snapshotId,
        projectId: req.params.id,
        source: "COPERNICUS_SENTINEL",
        captureDate: targetDate,
        metrics: {
          soilMoistureIndex: parseFloat(soilMoistureIndex.toFixed(3)),
          surfaceWaterLevel: parseFloat(surfaceWaterLevel.toFixed(2)),
          waterStorageTrend: parseFloat(waterStorageTrend.toFixed(2)),
          vegetationStress: parseFloat(vegetationStress.toFixed(3)),
          droughtRisk: parseFloat(droughtRisk.toFixed(3)),
          usageReductionEstimate: parseFloat(usageReductionEstimate.toFixed(3)),
          confidenceScore,
        },
        anomalyFlags,
        isBaseline,
        notes: `Mock refresh via all 5 adapters. ${anomalyFlags.length > 0 ? "Anomalies: " + anomalyFlags.join(", ") : "No anomalies detected."}`,
      });

      // If first snapshot: set baseline and update project status
      if (isBaseline) {
        project.baselineWaterIndex = soilMoistureIndex;
        project.status = "monitoring";
        await project.save();
      }

      // Log a tracking transaction
      await WaterTransaction.create({
        txId: uid("WTX"),
        txType: "issue",
        projectId: req.params.id,
        creditId: "",
        amountKiloLitres: 0,
        priceUsd: 0,
        blockchainHash: waterHash(`snapshot:${snapshotId}:${Date.now()}`),
        note: "Satellite snapshot pulled",
        ts: Date.now(),
      });

      console.log(
        `🛰️  Water snapshot ${snapshotId} — project ${req.params.id}${isBaseline ? " (baseline)" : ""}` +
          (anomalyFlags.length ? ` ⚠️ ${anomalyFlags.join(", ")}` : "")
      );

      return res.status(201).json({ ok: true, snapshot });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ ok: false, error: msg });
    }
  }
);

// GET /api/water/projects/:id/snapshots
router.get("/projects/:id/snapshots", async (req: Request, res: Response) => {
  try {
    const snapshots = await WaterSnapshot.find({ projectId: req.params.id })
      .sort({ captureDate: -1 })
      .lean();
    return res.json({ ok: true, snapshots });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  IMPACT REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/water/projects/:id/reports/generate
router.post(
  "/projects/:id/reports/generate",
  async (req: Request, res: Response) => {
    try {
      const project = await WaterProject.findOne({ projectId: req.params.id }).lean();
      if (!project) return res.status(404).json({ ok: false, error: "Project not found" });

      const snapshots = await WaterSnapshot.find({ projectId: req.params.id })
        .sort({ captureDate: -1 })
        .lean();

      if (snapshots.length === 0) {
        return res.status(400).json({
          ok: false,
          error: "No snapshots found — run mock-refresh first",
        });
      }

      const latest = snapshots[0];
      const oldest = snapshots[snapshots.length - 1];

      const currentSoilMoisture = latest.metrics.soilMoistureIndex ?? 0.3;
      const currentDroughtRisk = latest.metrics.droughtRisk ?? 0.3;

      const scoreResult = calculateWaterImpactScore({
        baselineWaterIndex: project.baselineWaterIndex,
        currentSoilMoisture,
        currentDroughtRisk,
        snapshotCount: snapshots.length,
        hasValidatorApproval: false,
        validatorTrustScore: 0,
      });

      const reportId = uid("WIR");

      // Build findings array
      const findings: string[] = [
        `Current soil moisture index: ${currentSoilMoisture.toFixed(3)} (baseline: ${project.baselineWaterIndex.toFixed(3)})`,
        `Drought risk level: ${(currentDroughtRisk * 100).toFixed(1)}%`,
        `Total snapshots collected: ${snapshots.length}`,
      ];

      if (latest.anomalyFlags.length > 0) {
        findings.push(`Active anomaly flags: ${latest.anomalyFlags.join(", ")}`);
      }

      if (latest.metrics.waterStorageTrend != null) {
        findings.push(
          `Water storage trend: ${latest.metrics.waterStorageTrend > 0 ? "+" : ""}${latest.metrics.waterStorageTrend.toFixed(1)} mm/month`
        );
      }

      const report = await WaterImpactReport.create({
        reportId,
        projectId: req.params.id,
        periodStart: oldest.captureDate,
        periodEnd: latest.captureDate,
        waterImpactScore: scoreResult.totalScore,
        grade: scoreResult.grade,
        summary: scoreResult.explanation,
        findings,
        recommendation: scoreResult.eligibleForCredits
          ? "Project meets criteria for DPAL Verified Water Impact credit issuance. Submit for validator approval."
          : "Continue monitoring and collect additional snapshots. Score must reach 70+ for credit eligibility.",
        componentScores: scoreResult.componentScores,
        eligibleForCredits: scoreResult.eligibleForCredits,
        validatorStatus: "pending",
      });

      // Advance project status to under_review if currently monitoring
      if (project.status === "monitoring") {
        await WaterProject.updateOne(
          { projectId: req.params.id },
          { $set: { status: "under_review" } }
        );
      }

      return res.status(201).json({ ok: true, report });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ ok: false, error: msg });
    }
  }
);

// GET /api/water/projects/:id/reports
router.get("/projects/:id/reports", async (req: Request, res: Response) => {
  try {
    const reports = await WaterImpactReport.find({ projectId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ ok: true, reports });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  VALIDATOR WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/water/validator/queue
router.get("/validator/queue", async (_req: Request, res: Response) => {
  try {
    const reports = await WaterImpactReport.find({ validatorStatus: "pending" })
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    const enriched = await Promise.all(
      reports.map(async (r) => {
        const project = await WaterProject.findOne({ projectId: r.projectId }).lean();
        return { ...r, project };
      })
    );

    return res.json({ ok: true, queue: enriched });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// POST /api/water/validator/reviews
// Body: { reportId, validatorId, validatorName, decision, notes, trustScore }
router.post("/validator/reviews", async (req: Request, res: Response) => {
  try {
    const { reportId, validatorId, validatorName, decision, notes, trustScore } = req.body;

    if (!reportId || !validatorId || !decision) {
      return res
        .status(400)
        .json({ ok: false, error: "reportId, validatorId, decision required" });
    }

    const validDecisions = ["approved", "rejected", "needs_evidence"];
    if (!validDecisions.includes(decision)) {
      return res
        .status(400)
        .json({ ok: false, error: "decision must be approved, rejected, or needs_evidence" });
    }

    const report = await WaterImpactReport.findOne({ reportId });
    if (!report) return res.status(404).json({ ok: false, error: "Report not found" });

    report.validatorStatus = decision as "approved" | "rejected" | "needs_evidence";
    report.validatorNotes = String(notes || "");
    await report.save();

    if (decision === "approved") {
      await WaterProject.updateOne(
        { projectId: report.projectId },
        { $set: { status: "approved" } }
      );
    } else if (decision === "rejected") {
      await WaterProject.updateOne(
        { projectId: report.projectId },
        { $set: { status: "rejected" } }
      );
    }

    console.log(
      `🔍 Validator ${validatorId} (${validatorName || "anonymous"}) — ${decision} report ${reportId}`
    );

    // If approved, recalculate the score with validator trust to update componentScores
    if (decision === "approved") {
      const project = await WaterProject.findOne({ projectId: report.projectId }).lean();
      const snapshots = await WaterSnapshot.find({ projectId: report.projectId })
        .sort({ captureDate: -1 })
        .lean();

      if (project && snapshots.length > 0) {
        const latest = snapshots[0];
        const vts = Math.max(0, Math.min(1, Number(trustScore || 0.8)));

        const rescored = calculateWaterImpactScore({
          baselineWaterIndex: project.baselineWaterIndex,
          currentSoilMoisture: latest.metrics.soilMoistureIndex ?? 0.3,
          currentDroughtRisk: latest.metrics.droughtRisk ?? 0.3,
          snapshotCount: snapshots.length,
          hasValidatorApproval: true,
          validatorTrustScore: vts,
        });

        await WaterImpactReport.updateOne(
          { reportId },
          {
            $set: {
              waterImpactScore: rescored.totalScore,
              grade: rescored.grade,
              summary: rescored.explanation,
              componentScores: rescored.componentScores,
              eligibleForCredits: rescored.eligibleForCredits,
            },
          }
        );
      }
    }

    const updatedReport = await WaterImpactReport.findOne({ reportId }).lean();
    return res.json({ ok: true, report: updatedReport });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CREDIT ISSUANCE
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/water/projects/:id/credits/issue
router.post(
  "/projects/:id/credits/issue",
  async (req: Request, res: Response) => {
    try {
      const project = await WaterProject.findOne({ projectId: req.params.id }).lean();
      if (!project) return res.status(404).json({ ok: false, error: "Project not found" });

      if (project.status !== "approved") {
        return res.status(409).json({
          ok: false,
          error: `Project must be approved before issuing credits (current status: ${project.status})`,
        });
      }

      // Find latest approved report
      const latestReport = await WaterImpactReport.findOne({
        projectId: req.params.id,
        validatorStatus: "approved",
        eligibleForCredits: true,
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!latestReport) {
        return res.status(409).json({
          ok: false,
          error:
            "No approved and credit-eligible impact report found for this project",
        });
      }

      // Determine credit amount in kilolitres
      const latestSnapshot = await WaterSnapshot.findOne({
        projectId: req.params.id,
      })
        .sort({ captureDate: -1 })
        .lean();

      let amountKiloLitres: number;
      if (latestSnapshot && latestSnapshot.metrics.soilMoistureIndex != null) {
        // area in m² × soil moisture fraction × 10% efficiency factor → kilolitres
        amountKiloLitres = Math.round(
          project.totalAcres * 4046.86 * latestSnapshot.metrics.soilMoistureIndex * 0.1
        );
        if (amountKiloLitres <= 0) amountKiloLitres = 1000;
      } else {
        amountKiloLitres = 1000;
      }

      const creditId = uid("WCR");
      const blockchainHash = waterHash(
        `${creditId}:${project.projectId}:${latestReport.reportId}:${Date.now()}`
      );

      const credit = await WaterCredit.create({
        creditId,
        projectId: req.params.id,
        creditType: "DPAL_VERIFIED_WATER_IMPACT",
        amountKiloLitres,
        verificationStatus: "verified",
        issuedAt: Date.now(),
        blockchainHash,
        marketplaceStatus: "not_listed",
        ownerId: project.ownerId,
        ownerName: project.ownerName,
      });

      await WaterTransaction.create({
        txId: uid("WTX"),
        txType: "issue",
        projectId: req.params.id,
        creditId,
        amountKiloLitres,
        priceUsd: 0,
        blockchainHash,
        note: `Issued ${amountKiloLitres.toLocaleString()} KL — water impact score ${latestReport.waterImpactScore}/100`,
        ts: Date.now(),
      });

      await WaterProject.updateOne(
        { projectId: req.params.id },
        { $set: { status: "credited" } }
      );

      console.log(
        `💧 Water credit issued: ${creditId} — ${amountKiloLitres.toLocaleString()} KL for project ${req.params.id}`
      );

      return res.status(201).json({ ok: true, credit });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ ok: false, error: msg });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  CREDITS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/water/credits
router.get("/credits", async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.query;
    const filter: Record<string, string> = {};
    if (ownerId) filter.ownerId = String(ownerId);
    const credits = await WaterCredit.find(filter).sort({ issuedAt: -1 }).lean();
    return res.json({ ok: true, credits });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// PATCH /api/water/credits/:id/list
router.patch("/credits/:id/list", async (req: Request, res: Response) => {
  try {
    const pricePerKL = Number(req.body.pricePerKL) || 0.05;
    const credit = await WaterCredit.findOneAndUpdate(
      { creditId: req.params.id },
      { $set: { marketplaceStatus: "listed", pricePerKL } },
      { new: true }
    ).lean();
    if (!credit) return res.status(404).json({ ok: false, error: "Credit not found" });

    await WaterTransaction.create({
      txId: uid("WTX"),
      txType: "list",
      projectId: credit.projectId,
      creditId: req.params.id,
      amountKiloLitres: credit.amountKiloLitres,
      priceUsd: pricePerKL * credit.amountKiloLitres,
      blockchainHash: waterHash(`list:${req.params.id}:${Date.now()}`),
      note: `Listed on DPAL Water Impact Marketplace at $${pricePerKL}/KL`,
      ts: Date.now(),
    });

    return res.json({ ok: true, credit });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// PATCH /api/water/credits/:id/retire
router.patch("/credits/:id/retire", async (req: Request, res: Response) => {
  try {
    const retiredAt = Date.now();
    const retirementCertHash = waterHash(`retire:${req.params.id}:${retiredAt}`);
    const credit = await WaterCredit.findOneAndUpdate(
      { creditId: req.params.id },
      { $set: { marketplaceStatus: "retired", retiredAt, retirementCertHash } },
      { new: true }
    ).lean();
    if (!credit) return res.status(404).json({ ok: false, error: "Credit not found" });

    await WaterTransaction.create({
      txId: uid("WTX"),
      txType: "retire",
      projectId: credit.projectId,
      creditId: req.params.id,
      amountKiloLitres: credit.amountKiloLitres,
      priceUsd: 0,
      blockchainHash: retirementCertHash,
      note: `Credit permanently retired — water offset claimed (cert: ${retirementCertHash})`,
      ts: retiredAt,
    });

    return res.json({ ok: true, credit });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SATELLITE PREVIEW (no project required)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/water/satellite-preview
// Calls all 5 adapters with a demo bounding box and returns live satellite readings.
// No project registration needed — used for the main dashboard "Live Satellite Feed".
router.get("/satellite-preview", async (_req: Request, res: Response) => {
  try {
    const demoPoly = [
      { lat: 34.05, lng: -118.25 },
      { lat: 34.10, lng: -118.15 },
      { lat: 34.00, lng: -118.15 },
      { lat: 34.00, lng: -118.30 },
    ];
    const baselineDate = "2024-01-01";
    const targetDate = new Date().toISOString().split("T")[0];

    const [smapResult, swotResult, graceResult, gibsResult, copernicusResult] =
      await Promise.all([
        fetchSmapData(demoPoly, baselineDate, targetDate).catch(() => null),
        fetchSwotData(demoPoly, baselineDate, targetDate).catch(() => null),
        fetchGraceData(demoPoly, baselineDate, targetDate).catch(() => null),
        fetchGibsData(demoPoly, baselineDate, targetDate).catch(() => null),
        fetchCopernicusData(demoPoly, baselineDate, targetDate).catch(() => null),
      ]);

    const confidenceValues = [
      smapResult?.confidenceScore,
      swotResult?.confidenceScore,
      graceResult?.confidenceScore,
      gibsResult?.confidenceScore,
      copernicusResult?.confidenceScore,
    ].filter((v): v is number => v != null);

    const avgConfidence =
      confidenceValues.length > 0
        ? parseFloat(
            (confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length).toFixed(3)
          )
        : 0.75;

    return res.json({
      ok: true,
      capturedAt: new Date().toISOString(),
      adapters: {
        smap: smapResult
          ? { ok: true, soilMoistureIndex: smapResult.soilMoistureIndex, confidenceScore: smapResult.confidenceScore }
          : { ok: false },
        swot: swotResult
          ? { ok: true, surfaceWaterLevel: swotResult.surfaceWaterLevel, waterExtentKm2: (swotResult as any).waterExtentKm2 ?? null, confidenceScore: swotResult.confidenceScore }
          : { ok: false },
        grace: graceResult
          ? { ok: true, waterStorageTrend: graceResult.waterStorageTrend, confidenceScore: graceResult.confidenceScore }
          : { ok: false },
        gibs: gibsResult
          ? { ok: true, vegetationStress: (gibsResult as any).vegetationStress ?? null, ndviIndex: (gibsResult as any).ndviIndex ?? null, confidenceScore: gibsResult.confidenceScore }
          : { ok: false },
        copernicus: copernicusResult
          ? {
              ok: true,
              droughtRisk: copernicusResult.droughtRisk,
              precipAnomalyMm: (copernicusResult as any).precipAnomalyMm ?? null,
              confidenceScore: copernicusResult.confidenceScore,
            }
          : { ok: false },
      },
      summary: {
        soilMoistureIndex: smapResult?.soilMoistureIndex ?? copernicusResult?.soilMoistureIndex ?? 0.42,
        surfaceWaterLevel: swotResult?.surfaceWaterLevel ?? 1.0,
        waterStorageTrend: graceResult?.waterStorageTrend ?? 0,
        vegetationStress: (gibsResult as any)?.vegetationStress ?? (copernicusResult as any)?.vegetationStress ?? 0.3,
        droughtRisk: copernicusResult?.droughtRisk ?? (gibsResult as any)?.droughtRisk ?? 0.2,
        confidenceScore: avgConfidence,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  STATS & FEED
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/water/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [totalProjects, approvedProjects, totalCreditsAgg, listedCredits] =
      await Promise.all([
        WaterProject.countDocuments(),
        WaterProject.countDocuments({ status: { $in: ["approved", "credited"] } }),
        WaterCredit.aggregate([
          { $group: { _id: null, total: { $sum: "$amountKiloLitres" } } },
        ]),
        WaterCredit.countDocuments({ marketplaceStatus: "listed" }),
      ]);

    return res.json({
      ok: true,
      stats: {
        totalProjects,
        approvedProjects,
        totalCreditsKL: (totalCreditsAgg[0]?.total as number) || 0,
        listedCredits,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

// GET /api/water/activity/feed
router.get("/activity/feed", async (_req: Request, res: Response) => {
  try {
    const feed = await WaterTransaction.find()
      .sort({ ts: -1 })
      .limit(20)
      .lean();
    return res.json({ ok: true, feed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
