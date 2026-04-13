/**
 * DPAL Carbon MRV Engine — API Routes
 *
 * /api/carbon/projects        — project registration & listing
 * /api/carbon/satellite       — satellite snapshot management
 * /api/carbon/mrv             — MRV reports + carbon scoring
 * /api/carbon/credits         — credit issuance + marketplace
 * /api/carbon/validators      — validator review workflow
 * /api/carbon/ledger          — transaction audit log
 */

import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { CarbonProject } from "../models/CarbonProject.js";
import { SatelliteSnapshot } from "../models/SatelliteSnapshot.js";
import { MRVReport } from "../models/MRVReport.js";
import { CarbonCredit } from "../models/CarbonCredit.js";
import { ValidatorReview } from "../models/ValidatorReview.js";
import { CarbonTransaction } from "../models/CarbonTransaction.js";

const router = Router();

// ── Sequestration rates by project type (tCO2e/acre/year) ─────────────────────
const SEQ_RATES: Record<string, number> = {
  forest: 2.5,
  reforestation: 3.2,
  farm: 0.5,
  wetland: 3.8,
  methane: 0,        // methane capture — credits per avoided emission, calc separately
  solar: 0,          // clean energy — no sequestration rate
  mangrove: 5.5,
  peatland: 4.0,
  grassland: 0.6,
  other: 1.0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * DPAL Carbon Score formula (0–100):
 *   ndviImprovement * 40 + protectedAreaScore * 25 + noDeforestationScore * 20 + validatorTrustScore * 15
 */
function calcCarbonScore(
  ndviImprovement: number,
  protectedAreaScore: number,
  noDeforestationScore: number,
  validatorTrustScore: number
): number {
  return Math.min(
    100,
    Math.round(
      ndviImprovement * 40 +
      protectedAreaScore * 25 +
      noDeforestationScore * 20 +
      validatorTrustScore * 15
    )
  );
}

/**
 * Simulated satellite data — placeholder until real APIs are integrated.
 * In production replace with calls to NASA Earthdata, Copernicus Sentinel Hub,
 * or Google Earth Engine adapters.
 */
function simulateSatelliteData(baselineNdvi: number, monthsElapsed: number) {
  const improvement = Math.min(0.4, monthsElapsed * 0.02 * (0.7 + Math.random() * 0.6));
  const ndviScore = Math.min(0.95, baselineNdvi + improvement);
  const deforestationAlert = Math.random() < 0.05; // 5% random alert
  const vegetationChangePercent = parseFloat((improvement * 100).toFixed(1));
  const cloudCoverPercent = Math.round(Math.random() * 30);
  const landCoverType = ndviScore > 0.7 ? "dense_vegetation" : ndviScore > 0.4 ? "moderate_vegetation" : "sparse_vegetation";
  return { ndviScore, vegetationChangePercent, deforestationAlert, cloudCoverPercent, landCoverType };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PROJECTS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/carbon/projects
router.post("/projects", async (req: Request, res: Response) => {
  try {
    const {
      ownerId, ownerName, projectName, projectType, description,
      country, region, city, lat, lng, polygon,
      totalAcres, baselineDate, evidenceUrls,
    } = req.body;

    if (!ownerId || !projectName || !projectType) {
      return res.status(400).json({ ok: false, error: "ownerId, projectName, projectType required" });
    }

    const projectId = uid("CPJ");
    const project = await CarbonProject.create({
      projectId,
      ownerId: String(ownerId),
      ownerName: String(ownerName || "Anonymous"),
      projectName: String(projectName),
      projectType: String(projectType),
      description: String(description || ""),
      location: {
        country: String(country || ""),
        region: String(region || ""),
        city: String(city || ""),
        gpsCenter: { lat: Number(lat || 0), lng: Number(lng || 0) },
        polygon: Array.isArray(polygon) ? polygon : [],
      },
      totalAcres: Number(totalAcres || 0),
      baselineDate: String(baselineDate || new Date().toISOString().split("T")[0]),
      evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
      status: "submitted",
    });

    console.log(`🌿 Carbon project registered: ${projectId} — ${projectName} (${projectType}) by ${ownerName}`);
    return res.status(201).json({ ok: true, project });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// GET /api/carbon/projects
router.get("/projects", async (req: Request, res: Response) => {
  try {
    const { ownerId, status, limit = "50" } = req.query;
    const filter: Record<string, string> = {};
    if (ownerId) filter.ownerId = String(ownerId);
    if (status) filter.status = String(status);
    const projects = await CarbonProject.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(100, Number(limit)))
      .lean();
    return res.json({ ok: true, projects });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// GET /api/carbon/projects/:projectId
router.get("/projects/:projectId", async (req: Request, res: Response) => {
  try {
    const project = await CarbonProject.findOne({ projectId: req.params.projectId }).lean();
    if (!project) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, project });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// PATCH /api/carbon/projects/:projectId/status
// Body: { status, adminNotes? }
router.patch("/projects/:projectId/status", async (req: Request, res: Response) => {
  try {
    const { status, adminNotes } = req.body;
    const valid = ["submitted", "monitoring", "review", "approved", "rejected", "listed"];
    if (!valid.includes(status)) return res.status(400).json({ ok: false, error: "Invalid status" });
    const update: Record<string, string> = { status };
    if (adminNotes) update.adminNotes = adminNotes;
    await CarbonProject.updateOne({ projectId: req.params.projectId }, { $set: update });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SATELLITE MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/carbon/satellite/snapshot
// Pulls or simulates a new satellite snapshot for a project.
// Body: { projectId, provider?, captureDate? }
router.post("/satellite/snapshot", async (req: Request, res: Response) => {
  try {
    const { projectId, provider = "Simulated", captureDate } = req.body;
    if (!projectId) return res.status(400).json({ ok: false, error: "projectId required" });

    const project = await CarbonProject.findOne({ projectId }).lean();
    if (!project) return res.status(404).json({ ok: false, error: "Project not found" });

    // Get previous snapshot for delta calculation
    const previous = await SatelliteSnapshot.findOne({ projectId }).sort({ captureDate: -1 }).lean();
    const previousNdvi = previous ? previous.ndviScore : 0.3 + Math.random() * 0.3;

    // Calculate months since baseline
    const baselineMs = project.baselineDate
      ? new Date(project.baselineDate).getTime()
      : Date.now() - 90 * 86400000;
    const monthsElapsed = Math.max(0, (Date.now() - baselineMs) / (30 * 86400000));

    const sim = simulateSatelliteData(previousNdvi, monthsElapsed);
    const ndviChange = parseFloat((sim.ndviScore - previousNdvi).toFixed(4));
    const snapshotId = uid("SAT");
    const isBaseline = !previous;
    const date = captureDate || new Date().toISOString().split("T")[0];

    const snapshot = await SatelliteSnapshot.create({
      snapshotId,
      projectId,
      provider: provider || "Simulated",
      imageUrl: "",
      thumbnailUrl: "",
      captureDate: date,
      ndviScore: parseFloat(sim.ndviScore.toFixed(4)),
      ndviPrevious: parseFloat(previousNdvi.toFixed(4)),
      ndviChange,
      landCoverType: sim.landCoverType,
      vegetationChangePercent: sim.vegetationChangePercent,
      deforestationAlert: sim.deforestationAlert,
      cloudCoverPercent: sim.cloudCoverPercent,
      rawMetadata: { simulated: true, monthsElapsed: parseFloat(monthsElapsed.toFixed(1)) },
      isBaseline,
    });

    // Update project baseline NDVI if first snapshot
    if (isBaseline) {
      await CarbonProject.updateOne({ projectId }, {
        $set: { baselineNdvi: snapshot.ndviScore, status: "monitoring" },
      });
    }

    // Deforestation alert escalation
    if (sim.deforestationAlert) {
      await CarbonProject.updateOne({ projectId }, { $set: { status: "review" } });
    }

    return res.status(201).json({ ok: true, snapshot });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// GET /api/carbon/satellite/:projectId
router.get("/satellite/:projectId", async (req: Request, res: Response) => {
  try {
    const snapshots = await SatelliteSnapshot.find({ projectId: req.params.projectId })
      .sort({ captureDate: -1 })
      .limit(24)
      .lean();
    return res.json({ ok: true, snapshots });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MRV ENGINE — CARBON SCORING
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/carbon/mrv/score
// Generates a new MRV report for a project using the latest satellite snapshot.
// Body: { projectId, validatorTrustScore? }
router.post("/mrv/score", async (req: Request, res: Response) => {
  try {
    const { projectId, validatorTrustScore = 0.5 } = req.body;
    if (!projectId) return res.status(400).json({ ok: false, error: "projectId required" });

    const project = await CarbonProject.findOne({ projectId }).lean();
    if (!project) return res.status(404).json({ ok: false, error: "Project not found" });

    const latestSnap = await SatelliteSnapshot.findOne({ projectId }).sort({ captureDate: -1 }).lean();
    const baselineSnap = await SatelliteSnapshot.findOne({ projectId, isBaseline: true }).lean();

    if (!latestSnap) {
      return res.status(400).json({ ok: false, error: "No satellite snapshot found — run /satellite/snapshot first" });
    }

    const baselineNdvi = baselineSnap?.ndviScore ?? (project.baselineNdvi >= 0 ? project.baselineNdvi : 0.3);
    const currentNdvi = latestSnap.ndviScore;

    // Score components (all 0–1)
    const ndviImprovement = Math.max(0, Math.min(1, (currentNdvi - baselineNdvi) / 0.5));
    const noDeforestationScore = latestSnap.deforestationAlert ? 0 : 1;
    const protectedAreaScore = noDeforestationScore * 0.9 + (ndviImprovement > 0.1 ? 0.1 : 0);
    const vts = Math.max(0, Math.min(1, Number(validatorTrustScore)));

    const carbonScore = calcCarbonScore(ndviImprovement, protectedAreaScore, noDeforestationScore, vts);
    const seqRate = SEQ_RATES[project.projectType] ?? 1.0;
    const creditEstimateTons = Math.round((project.totalAcres || 0) * seqRate * (carbonScore / 100));
    const riskLevel: "low" | "medium" | "high" =
      carbonScore >= 70 ? "low" : carbonScore >= 40 ? "medium" : "high";

    const aiSummary = `Carbon score ${carbonScore}/100 — ${
      carbonScore >= 70
        ? "Strong vegetation growth and zero deforestation detected. Project qualifies for full credit issuance."
        : carbonScore >= 40
        ? "Moderate vegetation improvement. Some risk factors present — additional monitoring recommended."
        : "Low score due to limited vegetation change or deforestation alerts. Validator review required before credit issuance."
    } Estimated ${creditEstimateTons.toLocaleString()} tCO2e based on ${project.totalAcres.toLocaleString()} acres of ${project.projectType}.`;

    const reportId = uid("MRV");
    const report = await MRVReport.create({
      reportId,
      projectId,
      snapshotId: latestSnap.snapshotId,
      reportDate: new Date().toISOString().split("T")[0],
      ndviImprovement: parseFloat(ndviImprovement.toFixed(3)),
      protectedAreaScore: parseFloat(protectedAreaScore.toFixed(3)),
      noDeforestationScore,
      validatorTrustScore: vts,
      carbonScore,
      creditEstimateTons,
      riskLevel,
      aiSummary,
      status: "submitted",
    });

    // Move project to review
    await CarbonProject.updateOne({ projectId }, { $set: { status: "review" } });

    return res.status(201).json({ ok: true, report });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// GET /api/carbon/mrv/:projectId
router.get("/mrv/:projectId", async (req: Request, res: Response) => {
  try {
    const reports = await MRVReport.find({ projectId: req.params.projectId })
      .sort({ reportDate: -1 })
      .limit(12)
      .lean();
    return res.json({ ok: true, reports });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// GET /api/carbon/mrv/report/:reportId
router.get("/mrv/report/:reportId", async (req: Request, res: Response) => {
  try {
    const report = await MRVReport.findOne({ reportId: req.params.reportId }).lean();
    if (!report) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, report });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  VALIDATOR REVIEWS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/carbon/validators/queue
// Returns MRV reports awaiting validation, with their project and snapshot data.
router.get("/validators/queue", async (_req: Request, res: Response) => {
  try {
    const reports = await MRVReport.find({ status: { $in: ["submitted", "draft"] } })
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    const enriched = await Promise.all(
      reports.map(async (r) => {
        const project = await CarbonProject.findOne({ projectId: r.projectId }).lean();
        const snapshot = r.snapshotId
          ? await SatelliteSnapshot.findOne({ snapshotId: r.snapshotId }).lean()
          : null;
        return { ...r, project, snapshot };
      })
    );

    return res.json({ ok: true, queue: enriched });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// POST /api/carbon/validators/review
// Body: { reportId, validatorId, validatorName, decision, trustScore, notes, proofUrls? }
router.post("/validators/review", async (req: Request, res: Response) => {
  try {
    const { reportId, validatorId, validatorName, decision, trustScore, notes, proofUrls } = req.body;
    if (!reportId || !validatorId || !decision) {
      return res.status(400).json({ ok: false, error: "reportId, validatorId, decision required" });
    }

    const report = await MRVReport.findOne({ reportId }).lean();
    if (!report) return res.status(404).json({ ok: false, error: "Report not found" });

    const reviewId = uid("VAL");
    await ValidatorReview.create({
      reviewId,
      projectId: report.projectId,
      reportId,
      validatorId: String(validatorId),
      validatorName: String(validatorName || "Anonymous"),
      decision: String(decision),
      trustScore: Math.max(0, Math.min(1, Number(trustScore || 0.5))),
      notes: String(notes || ""),
      proofUrls: Array.isArray(proofUrls) ? proofUrls : [],
      reviewedAt: Date.now(),
    });

    // Update report status
    const reportStatus = decision === "approved"
      ? "validated"
      : decision === "rejected"
      ? "rejected"
      : "submitted";

    await MRVReport.updateOne(
      { reportId },
      { $set: { status: reportStatus, validatorId, validatorNotes: notes, validatedAt: Date.now() } }
    );

    // If approved: issue carbon credits and move project to approved/listed
    if (decision === "approved") {
      const project = await CarbonProject.findOne({ projectId: report.projectId }).lean();
      const creditId = uid("CCR");
      const blockchainHash = sha256(`${creditId}:${reportId}:${validatorId}:${Date.now()}`);

      const credit = await CarbonCredit.create({
        creditId,
        projectId: report.projectId,
        projectName: project?.projectName || "",
        reportId,
        issuedTo: project?.ownerId || "",
        issuedToName: project?.ownerName || "Anonymous",
        creditAmountTons: report.creditEstimateTons,
        verificationStatus: "verified",
        validatorId: String(validatorId),
        blockchainHash,
        marketplaceStatus: "not_listed",
        pricePerTon: 12,
        issuedAt: Date.now(),
      });

      // Log blockchain transaction
      await CarbonTransaction.create({
        txId: uid("TX"),
        creditId,
        projectId: report.projectId,
        txType: "issue",
        fromId: "DPAL_MRV_ENGINE",
        toId: project?.ownerId || "",
        amountTons: report.creditEstimateTons,
        priceUsd: 0,
        blockchainHash,
        note: `MRV-verified credit issuance — carbon score ${report.carbonScore}/100`,
        ts: Date.now(),
      });

      await CarbonProject.updateOne({ projectId: report.projectId }, { $set: { status: "approved" } });

      return res.json({ ok: true, decision, credit, blockchainHash });
    }

    return res.json({ ok: true, decision });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CARBON CREDIT MARKETPLACE
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/carbon/marketplace
// Returns all verified, listed credits for sale.
router.get("/marketplace", async (_req: Request, res: Response) => {
  try {
    const credits = await CarbonCredit.find({
      verificationStatus: "verified",
      marketplaceStatus: "listed",
    })
      .sort({ listedAt: -1 })
      .limit(50)
      .lean();
    return res.json({ ok: true, credits });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// POST /api/carbon/marketplace/list
// Body: { creditId, ownerId, pricePerTon }
router.post("/marketplace/list", async (req: Request, res: Response) => {
  try {
    const { creditId, ownerId, pricePerTon } = req.body;
    if (!creditId || !ownerId) return res.status(400).json({ ok: false, error: "creditId and ownerId required" });

    const credit = await CarbonCredit.findOne({ creditId, issuedTo: ownerId });
    if (!credit) return res.status(404).json({ ok: false, error: "Credit not found or not owned by you" });
    if (credit.verificationStatus !== "verified") {
      return res.status(409).json({ ok: false, error: "Credit must be verified before listing" });
    }

    await CarbonCredit.updateOne(
      { creditId },
      { $set: { marketplaceStatus: "listed", pricePerTon: Number(pricePerTon) || 12, listedAt: Date.now() } }
    );

    await CarbonProject.updateOne({ projectId: credit.projectId }, { $set: { status: "listed" } });

    await CarbonTransaction.create({
      txId: uid("TX"),
      creditId,
      projectId: credit.projectId,
      txType: "list",
      fromId: ownerId,
      toId: "MARKETPLACE",
      amountTons: credit.creditAmountTons,
      priceUsd: (Number(pricePerTon) || 12) * credit.creditAmountTons,
      blockchainHash: sha256(`list:${creditId}:${Date.now()}`),
      note: "Listed on DPAL Carbon Marketplace",
      ts: Date.now(),
    });

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// POST /api/carbon/marketplace/buy
// Body: { creditId, buyerId, buyerName }
router.post("/marketplace/buy", async (req: Request, res: Response) => {
  try {
    const { creditId, buyerId, buyerName } = req.body;
    if (!creditId || !buyerId) return res.status(400).json({ ok: false, error: "creditId and buyerId required" });

    const credit = await CarbonCredit.findOne({ creditId, marketplaceStatus: "listed" });
    if (!credit) return res.status(404).json({ ok: false, error: "Credit not listed or already sold" });

    const totalUsd = credit.pricePerTon * credit.creditAmountTons;
    await CarbonCredit.updateOne(
      { creditId },
      { $set: { marketplaceStatus: "sold", buyerId: String(buyerId), buyerName: String(buyerName || ""), soldAt: Date.now() } }
    );

    await CarbonTransaction.create({
      txId: uid("TX"),
      creditId,
      projectId: credit.projectId,
      txType: "buy",
      fromId: credit.issuedTo,
      toId: String(buyerId),
      amountTons: credit.creditAmountTons,
      priceUsd: totalUsd,
      blockchainHash: sha256(`buy:${creditId}:${buyerId}:${Date.now()}`),
      note: `Purchased ${credit.creditAmountTons} tCO2e at $${credit.pricePerTon}/t`,
      ts: Date.now(),
    });

    return res.json({ ok: true, totalUsd, creditAmountTons: credit.creditAmountTons });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// POST /api/carbon/marketplace/retire
// Body: { creditId, userId }
router.post("/marketplace/retire", async (req: Request, res: Response) => {
  try {
    const { creditId, userId } = req.body;
    if (!creditId || !userId) return res.status(400).json({ ok: false, error: "creditId and userId required" });

    const credit = await CarbonCredit.findOne({ creditId });
    if (!credit) return res.status(404).json({ ok: false, error: "Credit not found" });
    if (credit.marketplaceStatus === "retired") return res.status(409).json({ ok: false, error: "Already retired" });

    const certHash = sha256(`retire:${creditId}:${userId}:${Date.now()}`);
    await CarbonCredit.updateOne(
      { creditId },
      { $set: { marketplaceStatus: "retired", retiredAt: Date.now(), retiredBy: String(userId), retirementCertHash: certHash } }
    );

    await CarbonTransaction.create({
      txId: uid("TX"),
      creditId,
      projectId: credit.projectId,
      txType: "retire",
      fromId: String(userId),
      toId: "RETIRED",
      amountTons: credit.creditAmountTons,
      priceUsd: 0,
      blockchainHash: certHash,
      note: "Credit permanently retired — carbon offset claimed",
      ts: Date.now(),
    });

    return res.json({ ok: true, certHash });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// GET /api/carbon/credits/:ownerId
router.get("/credits/:ownerId", async (req: Request, res: Response) => {
  try {
    const credits = await CarbonCredit.find({
      $or: [{ issuedTo: req.params.ownerId }, { buyerId: req.params.ownerId }],
    }).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, credits });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  LEDGER — BLOCKCHAIN AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/carbon/ledger/:projectId
router.get("/ledger/:projectId", async (req: Request, res: Response) => {
  try {
    const txs = await CarbonTransaction.find({ projectId: req.params.projectId })
      .sort({ ts: -1 })
      .limit(50)
      .lean();
    return res.json({ ok: true, transactions: txs });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// GET /api/carbon/ledger
// Global transaction feed
router.get("/ledger", async (_req: Request, res: Response) => {
  try {
    const txs = await CarbonTransaction.find().sort({ ts: -1 }).limit(30).lean();
    return res.json({ ok: true, transactions: txs });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// GET /api/carbon/stats
// Platform-wide MRV stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [totalProjects, approvedProjects, totalCredits, listedCredits] = await Promise.all([
      CarbonProject.countDocuments(),
      CarbonProject.countDocuments({ status: { $in: ["approved", "listed"] } }),
      CarbonCredit.aggregate([{ $group: { _id: null, total: { $sum: "$creditAmountTons" } } }]),
      CarbonCredit.countDocuments({ marketplaceStatus: "listed" }),
    ]);
    return res.json({
      ok: true,
      stats: {
        totalProjects,
        approvedProjects,
        totalCreditsTons: totalCredits[0]?.total || 0,
        listedCredits,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

export default router;
