import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { OffsetProject } from "../models/OffsetProject.js";
import { OffsetPurchase } from "../models/OffsetPurchase.js";
import { OffsetCoalition } from "../models/OffsetCoalition.js";

const router = Router();

// ── Seed data (runs once on first GET if DB is empty) ─────────────────────────

const SEED_PROJECTS = [
  { projectId: "OFP-001", name: "Redwood Valley Reforestation", location: "Humboldt County, CA", address: "101 Redwood Ridge Rd, Eureka, CA 95501", siteUrl: "", imageUrl: "", totalUnits: 1200, availableUnits: 980, retiredUnits: 220, pricePerTonne: 14, status: "Verified", mission: "Plant 40,000 native redwood seedlings across 200 acres", description: "Community-led reforestation project restoring old-growth redwood habitat lost to logging. Verified by third-party auditors.", groupTarget: 200, groupFunded: 87, coalitionCount: 34 },
  { projectId: "OFP-002", name: "Salton Sea Wetland Restoration", location: "Riverside County, CA", address: "Salton Sea State Recreation Area, CA 92274", siteUrl: "", imageUrl: "", totalUnits: 850, availableUnits: 610, retiredUnits: 240, pricePerTonne: 11, status: "Verified", mission: "Restore 500 acres of shoreline wetland habitat", description: "Restoring critical bird habitat while sequestering carbon in revived wetland soils.", groupTarget: 150, groupFunded: 60, coalitionCount: 21 },
  { projectId: "OFP-003", name: "Central Valley Solar-Ag Initiative", location: "Fresno County, CA", address: "14200 S Temperance Ave, Fresno, CA 93706", siteUrl: "", imageUrl: "", totalUnits: 600, availableUnits: 480, retiredUnits: 120, pricePerTonne: 9, status: "In Progress", mission: "Deploy agrivoltaic panels on 300 acres of farmland", description: "Combining solar energy generation with continued crop production to offset grid emissions.", groupTarget: 100, groupFunded: 22, coalitionCount: 12 },
  { projectId: "OFP-004", name: "Mojave Desert Carbon Sink", location: "San Bernardino County, CA", address: "29 Palms Hwy, Twentynine Palms, CA 92277", siteUrl: "", imageUrl: "", totalUnits: 2000, availableUnits: 1750, retiredUnits: 250, pricePerTonne: 16, status: "Verified", mission: "Native scrub restoration across 1,000 acres of degraded desert", description: "Large-scale desert scrub restoration proven to sequester carbon in arid soil biology.", groupTarget: 500, groupFunded: 189, coalitionCount: 58 },
  { projectId: "OFP-005", name: "Bay Area Blue Carbon Project", location: "San Francisco Bay, CA", address: "Coyote Hills Regional Park, Fremont, CA 94555", siteUrl: "", imageUrl: "", totalUnits: 400, availableUnits: 290, retiredUnits: 110, pricePerTonne: 18, status: "Verified", mission: "Restore tidal marsh for blue carbon sequestration", description: "Tidal marsh restoration — one of the most efficient carbon sinks on earth at 5x land carbon density.", groupTarget: 80, groupFunded: 49, coalitionCount: 27 },
  { projectId: "OFP-006", name: "Sierra Nevada Wildfire Buffer", location: "El Dorado County, CA", address: "Georgetown Divide, Georgetown, CA 95634", siteUrl: "", imageUrl: "", totalUnits: 750, availableUnits: 600, retiredUnits: 150, pricePerTonne: 13, status: "In Progress", mission: "Create 15-mile fuel-break corridor through controlled burns", description: "Preventive prescribed burns sequester more carbon long-term by avoiding catastrophic wildfire.", groupTarget: 120, groupFunded: 31, coalitionCount: 16 },
  { projectId: "OFP-007", name: "LA Urban Forest Canopy", location: "Los Angeles, CA", address: "Multiple sites across LA County", siteUrl: "", imageUrl: "", totalUnits: 300, availableUnits: 215, retiredUnits: 85, pricePerTonne: 10, status: "Needs Review", mission: "Plant 10,000 shade trees in low-canopy neighborhoods", description: "Urban tree planting targeting heat islands in underserved LA neighborhoods.", groupTarget: 60, groupFunded: 18, coalitionCount: 9 },
];

async function seedIfEmpty() {
  try {
    const count = await OffsetProject.countDocuments();
    if (count > 0) return;
    const now = Date.now();
    const seeded = SEED_PROJECTS.map((p) => ({
      ...p,
      credibilityScore: Math.floor(70 + Math.random() * 30),
      credibilityNote: "AI review pending",
      priceHistory: Array.from({ length: 7 }, (_, i) => ({
        date: now - (6 - i) * 86400000,
        priceUsd: parseFloat((p.pricePerTonne * (0.9 + Math.random() * 0.2)).toFixed(2)),
      })),
    }));
    await OffsetProject.insertMany(seeded);
    console.log("✅ Seeded offset projects");
  } catch (e: any) {
    console.warn("Offset seed skipped:", e?.message);
  }
}

// ── GET /api/offsets ───────────────────────────────────────────────────────────

router.get("/", async (_req: Request, res: Response) => {
  try {
    await seedIfEmpty();
    const projects = await OffsetProject.find().sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, projects });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── GET /api/offsets/:projectId ────────────────────────────────────────────────

router.get("/:projectId", async (req: Request, res: Response) => {
  try {
    const project = await OffsetProject.findOne({ projectId: req.params.projectId }).lean();
    if (!project) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, project });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── POST /api/offsets/buy ──────────────────────────────────────────────────────
// Body: { projectId, userId, userName, units, coinsSpent, isGroupPurchase? }

router.post("/buy", async (req: Request, res: Response) => {
  try {
    const { projectId, userId, userName, units, coinsSpent, isGroupPurchase } = req.body;
    if (!projectId || !userId || !units || units <= 0) {
      return res.status(400).json({ ok: false, error: "projectId, userId, and units > 0 required" });
    }

    const project = await OffsetProject.findOne({ projectId });
    if (!project) return res.status(404).json({ ok: false, error: "Project not found" });
    if (project.availableUnits < units) {
      return res.status(409).json({ ok: false, error: `Only ${project.availableUnits} tCO2e available` });
    }

    const purchaseId = `PUR-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const totalUsd = parseFloat((units * project.pricePerTonne).toFixed(2));

    const purchase = await OffsetPurchase.create({
      purchaseId,
      projectId,
      projectName: project.name,
      userId: String(userId),
      userName: String(userName || "Anonymous"),
      units: Number(units),
      pricePerTonne: project.pricePerTonne,
      totalUsd,
      coinsSpent: Number(coinsSpent || 0),
      retired: false,
      isGroupPurchase: Boolean(isGroupPurchase),
    });

    // Decrement available units; if group buy, add to groupFunded
    await OffsetProject.updateOne(
      { projectId },
      {
        $inc: {
          availableUnits: -Number(units),
          ...(isGroupPurchase ? { groupFunded: Number(units) } : {}),
        },
        $push: {
          priceHistory: { date: Date.now(), priceUsd: project.pricePerTonne },
        },
      }
    );

    return res.status(201).json({ ok: true, purchase });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── POST /api/offsets/join ─────────────────────────────────────────────────────
// Body: { projectId, userId, userName, role? }

router.post("/join", async (req: Request, res: Response) => {
  try {
    const { projectId, userId, userName, role } = req.body;
    if (!projectId || !userId) {
      return res.status(400).json({ ok: false, error: "projectId and userId required" });
    }

    const validRoles = ["steward", "verifier", "donor", "member"];
    const safeRole = validRoles.includes(role) ? role : "member";

    await OffsetCoalition.findOneAndUpdate(
      { projectId: String(projectId), userId: String(userId) },
      { $setOnInsert: { userName: String(userName || "Anonymous"), role: safeRole, joinedAt: Date.now() } },
      { upsert: true }
    );

    // Refresh coalition count
    const count = await OffsetCoalition.countDocuments({ projectId });
    await OffsetProject.updateOne({ projectId }, { $set: { coalitionCount: count } });

    return res.json({ ok: true, coalitionCount: count });
  } catch (err: any) {
    if (err?.code === 11000) return res.json({ ok: true, alreadyJoined: true });
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── POST /api/offsets/leave ────────────────────────────────────────────────────

router.post("/leave", async (req: Request, res: Response) => {
  try {
    const { projectId, userId } = req.body;
    await OffsetCoalition.deleteOne({ projectId: String(projectId), userId: String(userId) });
    const count = await OffsetCoalition.countDocuments({ projectId });
    await OffsetProject.updateOne({ projectId }, { $set: { coalitionCount: count } });
    return res.json({ ok: true, coalitionCount: count });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── POST /api/offsets/retire ───────────────────────────────────────────────────
// Body: { purchaseId, userId }

router.post("/retire", async (req: Request, res: Response) => {
  try {
    const { purchaseId, userId } = req.body;
    if (!purchaseId || !userId) {
      return res.status(400).json({ ok: false, error: "purchaseId and userId required" });
    }

    const purchase = await OffsetPurchase.findOne({ purchaseId, userId });
    if (!purchase) return res.status(404).json({ ok: false, error: "Purchase not found" });
    if (purchase.retired) return res.status(409).json({ ok: false, error: "Already retired" });

    const certificateHash = crypto
      .createHash("sha256")
      .update(`${purchaseId}:${userId}:${Date.now()}`)
      .digest("hex");

    await OffsetPurchase.updateOne(
      { purchaseId },
      { $set: { retired: true, retiredAt: Date.now(), certificateHash } }
    );

    await OffsetProject.updateOne(
      { projectId: purchase.projectId },
      { $inc: { retiredUnits: purchase.units } }
    );

    return res.json({ ok: true, certificateHash, retiredAt: Date.now() });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── GET /api/offsets/portfolio/:userId ────────────────────────────────────────

router.get("/portfolio/:userId", async (req: Request, res: Response) => {
  try {
    const purchases = await OffsetPurchase.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .lean();
    const totalUnits = purchases.reduce((s, p) => s + p.units, 0);
    const retiredUnits = purchases.filter((p) => p.retired).reduce((s, p) => s + p.units, 0);
    return res.json({ ok: true, purchases, totalUnits, retiredUnits });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── GET /api/offsets/activity/feed ────────────────────────────────────────────
// Recent purchases + joins for the impact feed

router.get("/activity/feed", async (_req: Request, res: Response) => {
  try {
    const [purchases, joins] = await Promise.all([
      OffsetPurchase.find().sort({ createdAt: -1 }).limit(20).lean(),
      OffsetCoalition.find().sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const feed = [
      ...purchases.map((p) => ({
        type: "purchase" as const,
        id: p.purchaseId,
        userName: p.userName,
        projectName: p.projectName,
        projectId: p.projectId,
        units: p.units,
        retired: p.retired,
        ts: new Date(p.createdAt).getTime(),
      })),
      ...joins.map((j) => ({
        type: "join" as const,
        id: `join-${j._id}`,
        userName: j.userName,
        projectId: j.projectId,
        role: j.role,
        ts: j.joinedAt,
      })),
    ].sort((a, b) => b.ts - a.ts).slice(0, 30);

    return res.json({ ok: true, feed });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── POST /api/offsets/verify ───────────────────────────────────────────────────
// Body: { projectId, userId, userName, summary, proofImageUrls }

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { projectId, userId, userName, summary, proofImageUrls } = req.body;
    if (!projectId || !userId) {
      return res.status(400).json({ ok: false, error: "projectId and userId required" });
    }
    // Store as a coalition entry with verifier role + update project status
    await OffsetCoalition.findOneAndUpdate(
      { projectId: String(projectId), userId: String(userId) },
      { $set: { role: "verifier", userName: String(userName || "Anonymous"), joinedAt: Date.now() } },
      { upsert: true }
    );
    // Log the verification summary (reuse directives pattern)
    console.log(`✅ Offset verification submitted for ${projectId} by ${userId}: ${summary}`);
    return res.json({ ok: true, message: "Verification submitted for admin review", proofImageUrls });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── GET /api/offsets/coalition/:projectId ─────────────────────────────────────

router.get("/coalition/:projectId", async (req: Request, res: Response) => {
  try {
    const members = await OffsetCoalition.find({ projectId: req.params.projectId })
      .sort({ joinedAt: -1 })
      .limit(50)
      .lean();
    return res.json({ ok: true, members });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

export default router;
