import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { connectDb } from "../config/db.js";
import { SituationMessage } from "../models/SituationMessage.js";

const router = Router();

router.get("/:roomId/messages", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const roomId = String(req.params.roomId || "").trim();
    const limit = Math.min(Number(req.query.limit || 100), 300);

    if (!roomId) {
      return res.status(400).json({ ok: false, error: "roomId_required" });
    }

    const docs = await SituationMessage.find({ roomId })
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();

    return res.json({ ok: true, roomId, messages: docs });
  } catch (error: any) {
    console.error("GET situation messages failed:", error);
    return res.status(500).json({ ok: false, error: "messages_fetch_failed", message: String(error?.message || error) });
  }
});

router.post("/:roomId/messages", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const roomId = String(req.params.roomId || "").trim();
    const { sender, text, imageUrl, audioUrl, isSystem } = req.body || {};

    if (!roomId) {
      return res.status(400).json({ ok: false, error: "roomId_required" });
    }

    const hasPayload = Boolean((text && String(text).trim()) || imageUrl || audioUrl);
    if (!hasPayload) {
      return res.status(400).json({ ok: false, error: "message_payload_required" });
    }

    const safeSender = String(sender || "OPERATIVE").slice(0, 80);
    const safeText = String(text || "").slice(0, 5000);

    const now = Date.now();
    const ledgerProof = `0x${crypto.createHash("sha256").update(`${roomId}|${safeSender}|${safeText}|${now}`).digest("hex")}`;

    const created = await SituationMessage.create({
      roomId,
      sender: safeSender,
      text: safeText,
      imageUrl: imageUrl ? String(imageUrl) : undefined,
      audioUrl: audioUrl ? String(audioUrl) : undefined,
      isSystem: Boolean(isSystem),
      ledgerProof,
      timestamp: now,
    });

    return res.status(201).json({ ok: true, message: created });
  } catch (error: any) {
    console.error("POST situation message failed:", error);
    return res.status(500).json({ ok: false, error: "message_send_failed", message: String(error?.message || error) });
  }
});

export default router;
