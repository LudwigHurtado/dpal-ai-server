import { Router, Request, Response } from "express";
import { NexusClient } from "../models/NexusClient.js";
import { randomUUID } from "crypto";

const router = Router();

router.get("/", async (req: Request, res: Response, next) => {
  try {
    const { status, plan, limit = "50" } = req.query;
    const query: any = {};
    if (status) query.status = status;
    if (plan) query.plan = plan;

    const clients = await NexusClient.find(query).sort({ createdAt: -1 }).limit(Math.min(Number(limit), 200)).lean();
    const stats = {
      total: await NexusClient.countDocuments(),
      active: await NexusClient.countDocuments({ status: "active" }),
      trial: await NexusClient.countDocuments({ status: "trial" }),
      suspended: await NexusClient.countDocuments({ status: "suspended" }),
    };
    res.json({ ok: true, clients, stats });
  } catch (e) { next(e); }
});

router.get("/:clientId", async (req: Request, res: Response, next) => {
  try {
    const client = await NexusClient.findOne({ clientId: req.params.clientId }).lean();
    if (!client) return res.status(404).json({ ok: false, error: "Client not found" });
    res.json({ ok: true, client });
  } catch (e) { next(e); }
});

router.post("/", async (req: Request, res: Response, next) => {
  try {
    const { orgName, entityType, plan, contactName, contactEmail, city, country, notes, monthlyReportLimit, slaTarget } = req.body;
    if (!orgName) return res.status(400).json({ ok: false, error: "orgName is required" });
    const client = await NexusClient.create({
      clientId: `client_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      orgName, entityType, plan, contactName, contactEmail, city, country, notes, monthlyReportLimit, slaTarget,
    });
    res.status(201).json({ ok: true, client });
  } catch (e) { next(e); }
});

router.patch("/:clientId", async (req: Request, res: Response, next) => {
  try {
    const allowed = ["orgName","entityType","plan","status","contactName","contactEmail","city","country","notes","slaTarget","slaActual","monthlyReportLimit","reportsCount","lastActivityAt"];
    const patch: any = {};
    for (const [k, v] of Object.entries(req.body || {})) { if (allowed.includes(k)) patch[k] = v; }
    const client = await NexusClient.findOneAndUpdate({ clientId: req.params.clientId }, { $set: patch }, { new: true });
    if (!client) return res.status(404).json({ ok: false, error: "Client not found" });
    res.json({ ok: true, client });
  } catch (e) { next(e); }
});

export default router;
