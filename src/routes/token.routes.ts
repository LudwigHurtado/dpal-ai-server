import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { connectDb } from "../config/db.js";
import { TokenUtilityRecord } from "../models/TokenUtilityRecord.js";

const router = Router();

router.get("/records", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const records = await TokenUtilityRecord.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ ok: true, records });
  } catch (error: any) {
    console.error("Token records fetch failed:", error);
    return res.status(500).json({ ok: false, error: "token_records_fetch_failed", message: String(error?.message || error) });
  }
});

router.post("/records", async (req: Request, res: Response) => {
  try {
    await connectDb();

    const actor = String(req.body?.actor || "OPERATIVE").slice(0, 120);
    const action = String(req.body?.action || "");
    const amount = Number(req.body?.amount || 0);
    const referenceId = req.body?.referenceId ? String(req.body.referenceId).slice(0, 160) : undefined;
    const notes = req.body?.notes ? String(req.body.notes).slice(0, 500) : undefined;

    const allowedActions = [
      "STAKE_VERIFY",
      "UNLOCK_TOOL",
      "SPONSOR_MISSION",
      "REWARD_WHISTLEBLOWER",
      "GOVERNANCE_VOTE",
    ];

    if (!allowedActions.includes(action)) {
      return res.status(400).json({ ok: false, error: "invalid_action" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_amount" });
    }

    const latest = await TokenUtilityRecord.findOne().sort({ blockNumber: -1 }).lean();
    const blockStart = Number(process.env.DPAL_TOKEN_BLOCK_START || 9000001);
    const blockNumber = latest?.blockNumber ? latest.blockNumber + 1 : blockStart;

    const txHash = `0x${crypto.randomBytes(32).toString("hex")}`;
    const chain = process.env.DPAL_CHAIN_NAME || "DPAL_INTERNAL";

    const created = await TokenUtilityRecord.create({
      actor,
      action,
      amount,
      referenceId,
      notes,
      txHash,
      blockNumber,
      chain,
    });

    return res.status(201).json({ ok: true, record: created });
  } catch (error: any) {
    console.error("Token record create failed:", error);
    return res.status(500).json({ ok: false, error: "token_record_create_failed", message: String(error?.message || error) });
  }
});

export default router;
