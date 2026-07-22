import { Router, type Request, type Response } from "express";
import { landsatEcologyAdapter } from "../services/adapters/landsatEcology.adapter.js";
import { reedyRiverSensitiveAccountGate } from "../middleware/reedyRiverAccountGate.js";
import reedyRiverReferenceRoutes from "./reedyRiver.reference.routes.js";
import reedyRiverRoutes from "./reedyRiver.routes.js";

const router = Router();

// Regulatory reference and authenticated citizen-science capture. Mounted first so
// these narrowly scoped routes remain separate from source-key ingest operations.
router.use("/reedy-river", reedyRiverReferenceRoutes);

// Revalidate the user and refresh-session state before any operator-only river action.
// This closes the access-token window after logout, session revocation, or account suspension.
router.use("/reedy-river", reedyRiverSensitiveAccountGate);

// Production Reedy River live monitoring, university ingest, reports, and action workflows.
router.use("/reedy-river", reedyRiverRoutes);

// GET /api/ecology/landsat-scan?lat=&lng=&radiusKm=
router.get("/landsat-scan", async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    const radiusKm = parseFloat(String(req.query.radiusKm)) || 15;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, error: "lat and lng query params are required and must be numbers" });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: "lat must be -90..90 and lng must be -180..180" });
    }

    const result = await landsatEcologyAdapter.getFoliageScan(lat, lng, radiusKm);
    return res.json({ ...result, ok: true });
  } catch (err: any) {
    console.error("Ecology scan error:", err?.message);
    return res.status(500).json({
      ok: false,
      dataAvailable: false,
      ndvi: null,
      foliageHealth: null,
      canopyChangePercent: null,
      habitatRisk: "unknown",
      primaryConcern: null,
      captureDate: null,
      cloudCoverPercent: null,
      source: "Microsoft Planetary Computer STAC / USGS Landsat Collection 2 Level-2",
      message: "Landsat scan failed on the server. The Planetary Computer STAC API may be temporarily unavailable.",
      error: err?.message,
    });
  }
});

export default router;
