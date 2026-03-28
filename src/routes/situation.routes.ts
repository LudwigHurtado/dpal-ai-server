import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { connectDb } from "../config/db.js";
import { SituationMessage } from "../models/SituationMessage.js";
import { SituationRoom } from "../models/SituationRoom.js";

const router = Router();

async function ensureRoomExists(roomId: string, title?: string, city?: string, createdBy?: string) {
  const safeRoom = roomId.trim();
  if (!safeRoom) return null;
  let room = await SituationRoom.findOne({ roomId: safeRoom });
  if (!room) {
    room = await SituationRoom.create({
      roomId: safeRoom,
      title: title || `Situation Room ${safeRoom.slice(0, 8).toUpperCase()}`,
      city: city || "",
      createdBy: createdBy || "",
      memberCount: 0,
      lastActivityAt: Date.now(),
    });
  }
  return room;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

/** Max inline data URL per field — must stay under express.json body limit (12mb). */
const MAX_INLINE_MEDIA_CHARS = 9 * 1024 * 1024;

/**
 * Accept https URLs (uploaded files / Cloudinary) or data: URLs stored in Mongo for cross-device chat.
 */
function normalizeSituationMediaUrl(value: unknown, kind: "image" | "audio"): string | undefined {
  if (value == null || value === "") return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  if (s.startsWith("data:")) {
    if (s.length > MAX_INLINE_MEDIA_CHARS) {
      throw new Error(`${kind}_inline_too_large`);
    }
    if (kind === "image") {
      if (!/^data:image\//.test(s)) throw new Error("invalid_inline_image");
    } else if (!/^data:audio\//.test(s)) {
      throw new Error("invalid_inline_audio");
    }
    return s;
  }
  if (/^https?:\/\//i.test(s)) {
    if (s.length > 4096) throw new Error("media_url_too_long");
    return s;
  }
  throw new Error("invalid_media_url");
}

function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

async function uploadToCloudinary(params: {
  buffer: Buffer;
  mimeType: string;
  roomId: string;
  type: "image" | "audio";
}) {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("cloudinary_not_configured");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const safeRoom = params.roomId.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
  const folder = `dpal/situation/${safeRoom}/${params.type}`;
  const publicId = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;

  const signatureBase = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureBase).digest("hex");

  const dataUri = `data:${params.mimeType};base64,${params.buffer.toString("base64")}`;

  const form = new FormData();
  form.set("file", dataUri);
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("folder", folder);
  form.set("public_id", publicId);
  form.set("signature", signature);

  const resourceType = params.type === "audio" ? "video" : "image";
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`cloudinary_upload_failed:${response.status}:${body.slice(0, 300)}`);
  }

  const json: any = await response.json();
  const secureUrl = String(json?.secure_url || "");
  if (!secureUrl) throw new Error("cloudinary_missing_url");

  return {
    url: secureUrl,
    path: String(json?.public_id || publicId),
    storage: "cloudinary" as const,
  };
}

router.get("/rooms", async (_req: Request, res: Response) => {
  try {
    await connectDb();
    const rooms = await SituationRoom.find().sort({ lastActivityAt: -1 }).limit(200).lean();
    return res.json({ ok: true, rooms });
  } catch (error: any) {
    console.error("Situation rooms list failed:", error);
    return res.status(500).json({ ok: false, error: "rooms_list_failed", message: String(error?.message || error) });
  }
});

router.post("/rooms", async (req: Request, res: Response) => {
  try {
    await connectDb();
    const roomId = String(req.body?.roomId || `room-${Date.now().toString(36)}`).trim();
    const title = String(req.body?.title || `Situation Room ${roomId.slice(0, 8).toUpperCase()}`).trim();
    const city = String(req.body?.city || "").trim();
    const createdBy = String(req.body?.createdBy || "").trim();

    const room = await ensureRoomExists(roomId, title, city, createdBy);
    return res.status(201).json({ ok: true, room });
  } catch (error: any) {
    console.error("Situation room create failed:", error);
    return res.status(500).json({ ok: false, error: "room_create_failed", message: String(error?.message || error) });
  }
});

router.post("/media", async (req: Request, res: Response) => {
  try {
    const roomId = String(req.body?.roomId || "").trim();
    const type = String(req.body?.type || "").trim();
    const dataUrl = String(req.body?.dataUrl || "").trim();

    if (!roomId || !dataUrl || !["image", "audio"].includes(type)) {
      return res.status(400).json({ ok: false, error: "invalid_media_payload" });
    }

    await connectDb();
    await ensureRoomExists(roomId);

    const requirePersistent = String(process.env.REQUIRE_PERSISTENT_MEDIA || "true").toLowerCase() === "true";
    if (requirePersistent && !cloudinaryConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "persistent_media_not_configured",
        message: "Persistent media storage is required. Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
      });
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

    // hard guard against very large inline uploads
    const maxBytes = Number(process.env.SITUATION_MEDIA_MAX_BYTES || 12 * 1024 * 1024);
    if (fileBuffer.length > maxBytes) {
      return res.status(413).json({ ok: false, error: "media_too_large", maxBytes });
    }

    let storedUrl = "";
    let storedPath = "";
    let storage: "cloudinary" | "local" = "local";

    if (cloudinaryConfigured()) {
      try {
        const uploaded = await uploadToCloudinary({
          buffer: fileBuffer,
          mimeType: parsed.mimeType,
          roomId,
          type: type as "image" | "audio",
        });
        storedUrl = uploaded.url;
        storedPath = uploaded.path;
        storage = uploaded.storage;
      } catch (cloudError: any) {
        console.warn("Cloudinary upload failed, falling back to local storage:", cloudError?.message || cloudError);
      }
    }

    if (!storedUrl) {
      const safeRoom = roomId.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
      const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
      const relativeDir = path.join("uploads", "situation", safeRoom, type);
      const absoluteDir = path.join(process.cwd(), relativeDir);
      ensureDir(absoluteDir);

      const absolutePath = path.join(absoluteDir, fileName);
      fs.writeFileSync(absolutePath, fileBuffer);

      const relativeUrlPath = `/${relativeDir.replace(/\\/g, "/")}/${fileName}`;
      storedUrl = `${req.protocol}://${req.get("host")}${relativeUrlPath}`;
      storedPath = relativeUrlPath;
      storage = "local";
    }

    await SituationRoom.updateOne({ roomId }, { $set: { lastActivityAt: Date.now() } });

    return res.status(201).json({
      ok: true,
      roomId,
      type,
      mimeType: parsed.mimeType,
      sizeBytes: fileBuffer.length,
      url: storedUrl,
      path: storedPath,
      storage,
      persistent: storage === "cloudinary",
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

    await ensureRoomExists(roomId);

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

    await ensureRoomExists(roomId, undefined, undefined, String(sender || "OPERATIVE"));

    const hasPayload = Boolean((text && String(text).trim()) || imageUrl || audioUrl);
    if (!hasPayload) {
      return res.status(400).json({ ok: false, error: "message_payload_required" });
    }

    const safeSender = String(sender || "OPERATIVE").slice(0, 80);
    const safeText = String(text || "").slice(0, 5000);

    let safeImageUrl: string | undefined;
    let safeAudioUrl: string | undefined;
    try {
      safeImageUrl = normalizeSituationMediaUrl(imageUrl, "image");
      safeAudioUrl = normalizeSituationMediaUrl(audioUrl, "audio");
    } catch (e: any) {
      return res.status(400).json({
        ok: false,
        error: "invalid_media",
        message: String(e?.message || e),
      });
    }

    const now = Date.now();
    const ledgerProof = `0x${crypto.createHash("sha256").update(`${roomId}|${safeSender}|${safeText}|${now}`).digest("hex")}`;

    const created = await SituationMessage.create({
      roomId,
      sender: safeSender,
      text: safeText,
      imageUrl: safeImageUrl,
      audioUrl: safeAudioUrl,
      isSystem: Boolean(isSystem),
      ledgerProof,
      timestamp: now,
    });

    await SituationRoom.updateOne({ roomId }, { $set: { lastActivityAt: now } });

    return res.status(201).json({ ok: true, message: created });
  } catch (error: any) {
    console.error("POST situation message failed:", error);
    return res.status(500).json({ ok: false, error: "message_send_failed", message: String(error?.message || error) });
  }
});

export default router;
