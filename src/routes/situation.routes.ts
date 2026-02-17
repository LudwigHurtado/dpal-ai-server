import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { connectDb } from "../config/db.js";
import { SituationMessage } from "../models/SituationMessage.js";

const router = Router();

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

router.post("/media", async (req: Request, res: Response) => {
  try {
    const roomId = String(req.body?.roomId || "").trim();
    const type = String(req.body?.type || "").trim();
    const dataUrl = String(req.body?.dataUrl || "").trim();

    if (!roomId || !dataUrl || !["image", "audio"].includes(type)) {
      return res.status(400).json({ ok: false, error: "invalid_media_payload" });
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return res.status(400).json({ ok: false, error: "invalid_data_url" });
    }

    const extByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "audio/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
    };

    const ext = extByMime[parsed.mimeType] || (type === "image" ? "bin" : "webm");
    const fileBuffer = Buffer.from(parsed.base64, "base64");

    const safeRoom = roomId.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
    const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const relativeDir = path.join("uploads", "situation", safeRoom, type);
    const absoluteDir = path.join(process.cwd(), relativeDir);
    ensureDir(absoluteDir);

    const absolutePath = path.join(absoluteDir, fileName);
    fs.writeFileSync(absolutePath, fileBuffer);

    const relativeUrlPath = `/${relativeDir.replace(/\\/g, "/")}/${fileName}`;
    const publicUrl = `${req.protocol}://${req.get("host")}${relativeUrlPath}`;

    return res.status(201).json({
      ok: true,
      roomId,
      type,
      mimeType: parsed.mimeType,
      sizeBytes: fileBuffer.length,
      url: publicUrl,
      path: relativeUrlPath,
    });
  } catch (error: any) {
    console.error("Situation media upload failed:", error);
    return res.status(500).json({ ok: false, error: "media_upload_failed", message: String(error?.message || error) });
  }
});

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
