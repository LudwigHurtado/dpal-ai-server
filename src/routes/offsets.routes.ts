import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { OffsetProject } from "../models/OffsetProject.js";
import { OffsetPurchase } from "../models/OffsetPurchase.js";
import { OffsetCoalition } from "../models/OffsetCoalition.js";
import { GreenParcel, SEQ_RATES } from "../models/GreenParcel.js";

const router = Router();

// ── Seed data (runs once on first GET if DB is empty) ─────────────────────────
// 17 projects spanning USA, South America, Africa, Asia, Europe, Australia

const SEED_PROJECTS = [
  // ── North America ──────────────────────────────────────────────────────────
  {
    projectId: "OFP-001",
    name: "Redwood Valley Reforestation",
    location: "Humboldt County, CA — USA",
    country: "USA",
    lat: 40.7985, lng: -124.1573,
    ecosystemType: "temperate_forest",
    address: "101 Redwood Ridge Rd, Eureka, CA 95501",
    imageUrl: "",
    totalUnits: 1200, availableUnits: 980, retiredUnits: 220,
    pricePerTonne: 14, status: "Verified",
    mission: "Plant 40,000 native redwood seedlings across 200 acres",
    description: "Community-led reforestation restoring old-growth redwood habitat lost to logging. Verified by third-party auditors.",
    groupTarget: 200, groupFunded: 87, coalitionCount: 34,
  },
  {
    projectId: "OFP-002",
    name: "Bay Area Blue Carbon Project",
    location: "San Francisco Bay, CA — USA",
    country: "USA",
    lat: 37.5485, lng: -122.0597,
    ecosystemType: "tidal_marsh",
    address: "Coyote Hills Regional Park, Fremont, CA 94555",
    imageUrl: "",
    totalUnits: 400, availableUnits: 290, retiredUnits: 110,
    pricePerTonne: 18, status: "Verified",
    mission: "Restore tidal marsh for blue carbon sequestration",
    description: "Tidal marsh restoration — one of the most efficient carbon sinks on earth at 5x land carbon density.",
    groupTarget: 80, groupFunded: 49, coalitionCount: 27,
  },
  {
    projectId: "OFP-003",
    name: "Pacific Northwest Old Growth Reserve",
    location: "Snohomish County, WA — USA",
    country: "USA",
    lat: 47.8961, lng: -121.5730,
    ecosystemType: "temperate_forest",
    address: "Mountain Loop Highway, Granite Falls, WA 98252",
    imageUrl: "",
    totalUnits: 2800, availableUnits: 2200, retiredUnits: 600,
    pricePerTonne: 17, status: "Verified",
    mission: "Permanent protection of 4,000 acres of old-growth Douglas fir",
    description: "Ancient forest conservation creating a permanent carbon reservoir while preserving irreplaceable old-growth biodiversity.",
    groupTarget: 400, groupFunded: 178, coalitionCount: 61,
  },
  {
    projectId: "OFP-004",
    name: "Great Plains Grassland Carbon",
    location: "Flint Hills, Kansas — USA",
    country: "USA",
    lat: 38.6654, lng: -96.5347,
    ecosystemType: "grassland",
    address: "Tallgrass Prairie National Preserve, Strong City, KS 66869",
    imageUrl: "",
    totalUnits: 950, availableUnits: 780, retiredUnits: 170,
    pricePerTonne: 9, status: "In Progress",
    mission: "Restore 8,000 acres of native tallgrass prairie to sequester soil carbon",
    description: "Prairie restoration locks carbon deep in the root system — native grasses store 3x more soil carbon than conventional crops.",
    groupTarget: 150, groupFunded: 43, coalitionCount: 19,
  },
  {
    projectId: "OFP-005",
    name: "Gulf Coast Mangrove Belt",
    location: "Everglades, Florida — USA",
    country: "USA",
    lat: 25.3956, lng: -80.9337,
    ecosystemType: "mangrove",
    address: "Everglades National Park, Homestead, FL 33034",
    imageUrl: "",
    totalUnits: 1100, availableUnits: 870, retiredUnits: 230,
    pricePerTonne: 22, status: "Verified",
    mission: "Restore 1,200 acres of red mangrove habitat along Florida coast",
    description: "Mangroves sequester carbon at 5× the rate of tropical forests while protecting coastlines from storm surge. Blue carbon at scale.",
    groupTarget: 200, groupFunded: 89, coalitionCount: 43,
  },
  // ── South America ──────────────────────────────────────────────────────────
  {
    projectId: "OFP-006",
    name: "Amazon Basin Carbon Reserve",
    location: "Amazonas State — Brazil",
    country: "Brazil",
    lat: -3.4653, lng: -62.2159,
    ecosystemType: "tropical_forest",
    address: "Rio Negro Basin, Amazonas, Brazil",
    imageUrl: "",
    totalUnits: 15000, availableUnits: 12800, retiredUnits: 2200,
    pricePerTonne: 12, status: "Verified",
    mission: "Permanently protect 1.2 million acres of primary Amazon rainforest",
    description: "One of the world's most critical carbon sinks. Partners with indigenous Yanomami communities as land stewards and monitors.",
    groupTarget: 3000, groupFunded: 1240, coalitionCount: 318,
  },
  {
    projectId: "OFP-007",
    name: "Andean Cloud Forest Buffer",
    location: "Nariño Department — Colombia",
    country: "Colombia",
    lat: 1.2136, lng: -77.2811,
    ecosystemType: "cloud_forest",
    address: "La Planada Nature Reserve, Ricaurte, Nariño",
    imageUrl: "",
    totalUnits: 3200, availableUnits: 2650, retiredUnits: 550,
    pricePerTonne: 15, status: "Verified",
    mission: "Buffer zone reforestation protecting 180,000 acres of cloud forest watershed",
    description: "Cloud forests capture moisture from the air, sustaining downstream communities. Each acre supports 300+ endemic plant species.",
    groupTarget: 600, groupFunded: 241, coalitionCount: 87,
  },
  {
    projectId: "OFP-008",
    name: "Patagonian Steppe Rewilding",
    location: "Santa Cruz Province — Argentina",
    country: "Argentina",
    lat: -50.4860, lng: -72.7855,
    ecosystemType: "grassland",
    address: "Parque Patagonia, Lago Buenos Aires, Santa Cruz",
    imageUrl: "",
    totalUnits: 4500, availableUnits: 4100, retiredUnits: 400,
    pricePerTonne: 10, status: "In Progress",
    mission: "Restore 500,000 acres of degraded Patagonian steppe with native wildlife",
    description: "Reintroducing guanaco and huemul deer creates a trophic cascade that rebuilds grassland carbon stocks naturally.",
    groupTarget: 800, groupFunded: 167, coalitionCount: 52,
  },
  {
    projectId: "OFP-009",
    name: "Cerrado Savanna Restoration",
    location: "Goiás State — Brazil",
    country: "Brazil",
    lat: -15.7797, lng: -47.9297,
    ecosystemType: "savanna",
    address: "Chapada dos Veadeiros, Alto Paraíso de Goiás",
    imageUrl: "",
    totalUnits: 2100, availableUnits: 1800, retiredUnits: 300,
    pricePerTonne: 11, status: "Verified",
    mission: "Restore 250,000 acres of Cerrado savanna — Brazil's second-largest biome",
    description: "The Cerrado has lost 50% of its cover. Restoration here protects headwaters of six of South America's major river systems.",
    groupTarget: 400, groupFunded: 123, coalitionCount: 44,
  },
  // ── Africa ─────────────────────────────────────────────────────────────────
  {
    projectId: "OFP-010",
    name: "Congo Basin Rainforest Conservation",
    location: "Équateur Province — DRC",
    country: "D.R. Congo",
    lat: -0.2280, lng: 23.6345,
    ecosystemType: "tropical_forest",
    address: "Salonga National Park, Équateur Province, DRC",
    imageUrl: "",
    totalUnits: 18000, availableUnits: 15500, retiredUnits: 2500,
    pricePerTonne: 10, status: "Verified",
    mission: "Protect 2 million acres of Congo Basin — Earth's second lung",
    description: "The Congo Basin stores more carbon than any other forest on Earth. Community ranger networks ensure zero-deforestation enforcement.",
    groupTarget: 5000, groupFunded: 1876, coalitionCount: 412,
  },
  {
    projectId: "OFP-011",
    name: "Maasai Mara Savanna Carbon",
    location: "Narok County — Kenya",
    country: "Kenya",
    lat: -1.5013, lng: 35.1470,
    ecosystemType: "savanna",
    address: "Maasai Mara National Reserve, Narok, Kenya",
    imageUrl: "",
    totalUnits: 3800, availableUnits: 3200, retiredUnits: 600,
    pricePerTonne: 8, status: "Verified",
    mission: "Sustainable grassland management across 1.5M acres with Maasai communities",
    description: "Maasai pastoralism, when properly managed, maintains savanna carbon stocks while supporting 2,000+ wildlife species.",
    groupTarget: 700, groupFunded: 289, coalitionCount: 134,
  },
  {
    projectId: "OFP-012",
    name: "Sahel Great Green Wall",
    location: "Casamance Region — Senegal",
    country: "Senegal",
    lat: 14.6928, lng: -14.4467,
    ecosystemType: "desert",
    address: "Ranérou-Ferlo Nord, Matam Region, Senegal",
    imageUrl: "",
    totalUnits: 6000, availableUnits: 5400, retiredUnits: 600,
    pricePerTonne: 7, status: "In Progress",
    mission: "Plant and restore 50,000 acres as part of the cross-continental Great Green Wall",
    description: "The African Union's Great Green Wall aims to restore 247 million acres by 2030. Each credit funds direct community restoration.",
    groupTarget: 1200, groupFunded: 334, coalitionCount: 98,
  },
  // ── Asia & Pacific ─────────────────────────────────────────────────────────
  {
    projectId: "OFP-013",
    name: "Borneo Peatland Rewetting",
    location: "Sarawak — Malaysia",
    country: "Malaysia",
    lat: 1.5533, lng: 110.3592,
    ecosystemType: "peatland",
    address: "Loagan Bunut National Park, Sarawak, Malaysia",
    imageUrl: "",
    totalUnits: 8500, availableUnits: 7200, retiredUnits: 1300,
    pricePerTonne: 13, status: "Verified",
    mission: "Rewet and restore 400,000 acres of drained tropical peatland",
    description: "Drained peatlands emit massive CO2. Rewetting stops emissions and begins centuries of carbon accumulation. Orangutan habitat protected.",
    groupTarget: 1500, groupFunded: 567, coalitionCount: 189,
  },
  {
    projectId: "OFP-014",
    name: "Sundarbans Mangrove Restoration",
    location: "Khulna Division — Bangladesh",
    country: "Bangladesh",
    lat: 21.9497, lng: 89.1833,
    ecosystemType: "mangrove",
    address: "Sundarbans Forest, Khulna, Bangladesh",
    imageUrl: "",
    totalUnits: 5200, availableUnits: 4400, retiredUnits: 800,
    pricePerTonne: 11, status: "Verified",
    mission: "Restore 200,000 acres of Sundarbans mangrove — world's largest mangrove forest",
    description: "The Sundarbans protect 10 million people from cyclones while sequestering enormous amounts of blue carbon. Home to Bengal tigers.",
    groupTarget: 1000, groupFunded: 402, coalitionCount: 167,
  },
  // ── Europe ─────────────────────────────────────────────────────────────────
  {
    projectId: "OFP-015",
    name: "Finnish Boreal Carbon Sink",
    location: "Lapland Region — Finland",
    country: "Finland",
    lat: 68.9026, lng: 27.5131,
    ecosystemType: "boreal_forest",
    address: "Urho Kekkonen National Park, Saariselkä, Finland",
    imageUrl: "",
    totalUnits: 3400, availableUnits: 3000, retiredUnits: 400,
    pricePerTonne: 16, status: "Verified",
    mission: "Protect 300,000 acres of virgin boreal taiga from logging concessions",
    description: "Boreal forests store 30% of Earth's land carbon. Finland's old-growth taiga is under logging pressure — this project buys permanent protection.",
    groupTarget: 600, groupFunded: 198, coalitionCount: 73,
  },
  // ── Australia / Pacific ────────────────────────────────────────────────────
  {
    projectId: "OFP-016",
    name: "Queensland Rainforest Corridor",
    location: "Wet Tropics — Australia",
    country: "Australia",
    lat: -17.2683, lng: 145.6958,
    ecosystemType: "tropical_forest",
    address: "Daintree Rainforest, Douglas Shire, QLD",
    imageUrl: "",
    totalUnits: 2900, availableUnits: 2500, retiredUnits: 400,
    pricePerTonne: 19, status: "Verified",
    mission: "Reconnect 60,000 acres of fragmented Queensland rainforest",
    description: "Daintree is the world's oldest continuously surviving tropical rainforest (~180M years). Corridor restoration enables wildlife migration.",
    groupTarget: 500, groupFunded: 187, coalitionCount: 64,
  },
  {
    projectId: "OFP-017",
    name: "Mojave Desert Carbon Sink",
    location: "San Bernardino County, CA — USA",
    country: "USA",
    lat: 34.0683, lng: -116.5458,
    ecosystemType: "desert",
    address: "29 Palms Hwy, Twentynine Palms, CA 92277",
    imageUrl: "",
    totalUnits: 2000, availableUnits: 1750, retiredUnits: 250,
    pricePerTonne: 16, status: "Verified",
    mission: "Native scrub restoration across 1,000 acres of degraded desert",
    description: "Large-scale desert scrub restoration proven to sequester carbon in arid soil biology.",
    groupTarget: 500, groupFunded: 189, coalitionCount: 58,
  },
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
    console.log("✅ Seeded global offset projects (17 projects across 10 countries)");
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

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { projectId, userId, userName, summary, proofImageUrls } = req.body;
    if (!projectId || !userId) {
      return res.status(400).json({ ok: false, error: "projectId and userId required" });
    }
    await OffsetCoalition.findOneAndUpdate(
      { projectId: String(projectId), userId: String(userId) },
      { $set: { role: "verifier", userName: String(userName || "Anonymous"), joinedAt: Date.now() } },
      { upsert: true }
    );
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

// ── POST /api/offsets/parcels/register ────────────────────────────────────────
// Body: { ownerName, ownerEmail, heroId?, country, region, totalAcres, ecosystemType, lat, lng, description, sectorSizeAcres? }

router.post("/parcels/register", async (req: Request, res: Response) => {
  try {
    const {
      ownerName, ownerEmail, heroId, country, region,
      totalAcres, ecosystemType, lat, lng, description, sectorSizeAcres,
    } = req.body;

    if (!ownerName || !country || !totalAcres || !ecosystemType || lat == null || lng == null) {
      return res.status(400).json({ ok: false, error: "ownerName, country, totalAcres, ecosystemType, lat, lng required" });
    }

    if (!SEQ_RATES[ecosystemType]) {
      return res.status(400).json({ ok: false, error: `Unknown ecosystemType: ${ecosystemType}` });
    }

    const sectorAcres = Number(sectorSizeAcres) > 0 ? Number(sectorSizeAcres) : 100;
    const sectorCount = Math.ceil(Number(totalAcres) / sectorAcres);
    const creditEstimatePerYear = parseFloat(
      (Number(totalAcres) * SEQ_RATES[ecosystemType]).toFixed(1)
    );

    const parcelId = `GPZ-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const parcel = await GreenParcel.create({
      parcelId,
      ownerName: String(ownerName),
      ownerEmail: String(ownerEmail || ""),
      heroId: String(heroId || ""),
      country: String(country),
      region: String(region || ""),
      totalAcres: Number(totalAcres),
      ecosystemType: String(ecosystemType),
      lat: Number(lat),
      lng: Number(lng),
      description: String(description || ""),
      sectorSizeAcres: sectorAcres,
      sectorCount,
      creditEstimatePerYear,
      status: "pending",
      submittedAt: Date.now(),
    });

    console.log(`🌿 Land registration: ${parcelId} — ${ownerName}, ${totalAcres} acres of ${ecosystemType} in ${country}`);
    return res.status(201).json({ ok: true, parcel, sectorCount, creditEstimatePerYear });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── GET /api/offsets/parcels ───────────────────────────────────────────────────

router.get("/parcels", async (req: Request, res: Response) => {
  try {
    const { heroId, status } = req.query;
    const filter: Record<string, string> = {};
    if (heroId) filter.heroId = String(heroId);
    if (status) filter.status = String(status);
    const parcels = await GreenParcel.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ ok: true, parcels });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── GET /api/offsets/parcels/:parcelId ────────────────────────────────────────

router.get("/parcels/:parcelId", async (req: Request, res: Response) => {
  try {
    const parcel = await GreenParcel.findOne({ parcelId: req.params.parcelId }).lean();
    if (!parcel) return res.status(404).json({ ok: false, error: "Parcel not found" });
    return res.json({ ok: true, parcel });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

export default router;
