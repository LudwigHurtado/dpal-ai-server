import { Router, Request, Response } from "express";
import { EmergencyReport } from "../models/EmergencyReport.js";
import { randomUUID } from "crypto";

const router = Router();

router.get("/", async (req: Request, res: Response, next) => {
  try {
    const { status, severity, limit = "50" } = req.query;
    const query: any = {};
    if (status) query.status = status;
    if (severity) query.severity = severity;
    const emergencies = await EmergencyReport.find(query).sort({ createdAt: -1 }).limit(Math.min(Number(limit), 200)).lean();
    const stats = {
      total: await EmergencyReport.countDocuments(),
      active: await EmergencyReport.countDocuments({ status: "active" }),
      critical: await EmergencyReport.countDocuments({ severity: "critical", status: { $nin: ["resolved", "false_alarm"] } }),
      resolved: await EmergencyReport.countDocuments({ status: "resolved" }),
    };
    res.json({ ok: true, emergencies, stats });
  } catch (e) { next(e); }
});

router.get("/:emergencyId", async (req: Request, res: Response, next) => {
  try {
    const emergency = await EmergencyReport.findOne({ emergencyId: req.params.emergencyId }).lean();
    if (!emergency) return res.status(404).json({ ok: false, error: "Emergency not found" });
    res.json({ ok: true, emergency });
  } catch (e) { next(e); }
});

router.post("/", async (req: Request, res: Response, next) => {
  try {
    const { title, description, severity, category, reportedBy, reportedByType, location, lat, lng, city, country, nexusClientId } = req.body;
    if (!title || !severity || !reportedBy) return res.status(400).json({ ok: false, error: "title, severity, reportedBy are required" });
    const emergency = await EmergencyReport.create({
      emergencyId: `emg_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      title, description, severity, category, reportedBy, reportedByType, location, lat, lng, city, country, nexusClientId,
    });
    res.status(201).json({ ok: true, emergency });
  } catch (e) { next(e); }
});

router.patch("/:emergencyId/status", async (req: Request, res: Response, next) => {
  try {
    const { status, assignedTo, notes } = req.body;
    const update: any = { status };
    if (assignedTo) update.assignedTo = assignedTo;
    if (notes) update.notes = notes;
    if (status === "responding") update.respondedAt = new Date();
    if (status === "resolved") update.resolvedAt = new Date();
    const emergency = await EmergencyReport.findOneAndUpdate({ emergencyId: req.params.emergencyId }, { $set: update }, { new: true });
    if (!emergency) return res.status(404).json({ ok: false, error: "Emergency not found" });
    res.json({ ok: true, emergency });
  } catch (e) { next(e); }
});

export default router;
