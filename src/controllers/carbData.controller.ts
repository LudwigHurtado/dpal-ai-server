import type { Request, Response } from "express";
import { getCarbImportMeta, importCarbDataset, searchCarbFacilityRecords } from "../services/carbData.service.js";

export async function getCarbDataHealth(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true, module: "carb-data" });
}

export async function searchCarbData(req: Request, res: Response): Promise<void> {
  const result = await searchCarbFacilityRecords({
    q: String(req.query.q ?? ""),
    facilityId: String(req.query.facilityId ?? ""),
    city: String(req.query.city ?? ""),
    county: String(req.query.county ?? ""),
    sector: String(req.query.sector ?? ""),
    year: Number(req.query.year || 0) || undefined,
    limit: Number(req.query.limit || 50) || 50,
  });
  const meta = getCarbImportMeta();
  res.json({
    ok: true,
    results: result.results,
    count: result.count,
    sourceMode: result.sourceMode,
    warnings: result.warnings,
    datasetVersion: meta.datasetVersion,
    retrievalDate: meta.retrievalDate,
  });
}

export async function importCarbData(req: Request, res: Response): Promise<void> {
  // TODO: add multipart/form-data upload path when file attachments are needed.
  const imported = await importCarbDataset({
    records: Array.isArray(req.body?.records) ? req.body.records : undefined,
    csvText: typeof req.body?.csvText === "string" ? req.body.csvText : undefined,
    jsonText: typeof req.body?.jsonText === "string" ? req.body.jsonText : undefined,
    datasetVersion: typeof req.body?.datasetVersion === "string" ? req.body.datasetVersion : undefined,
    sourceUrl: typeof req.body?.sourceUrl === "string" ? req.body.sourceUrl : undefined,
  });
  res.status(201).json({
    ok: true,
    imported: imported.imported,
    warnings: imported.warnings,
    sourceMode: imported.imported > 0 ? "IMPORTED" : "DEMO_FALLBACK",
  });
}

