import { Router, type Request, type Response } from "express";

const router = Router();

type AdapterName = "open311" | "cityGeoJson" | "airQuality";

function normalizeRecords(adapter: AdapterName, payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.slice(0, 200);
  if (Array.isArray(payload.records)) return payload.records.slice(0, 200);
  if (Array.isArray(payload.features)) {
    return payload.features.slice(0, 200).map((f: any) => ({
      source: adapter,
      id: f?.id || f?.properties?.id || `feat-${Math.random().toString(36).slice(2, 8)}`,
      title: f?.properties?.title || f?.properties?.name || "City feed item",
      category: f?.properties?.category || "general",
      coordinates: f?.geometry?.coordinates,
      raw: f,
    }));
  }
  return [];
}

router.post("/ingest", async (req: Request, res: Response) => {
  const adapter = String(req.body?.adapter || "").trim() as AdapterName;
  const city = String(req.body?.city || "").trim();
  const payload = req.body?.payload;

  if (!adapter || !["open311", "cityGeoJson", "airQuality"].includes(adapter)) {
    return res.status(400).json({ ok: false, error: "unsupported_adapter" });
  }

  const records = normalizeRecords(adapter, payload);

  return res.status(202).json({
    ok: true,
    adapter,
    city,
    acceptedRecords: records.length,
    records,
    note: "Starter ingestion route enabled for safe open-data mission seeding.",
  });
});

export default router;
