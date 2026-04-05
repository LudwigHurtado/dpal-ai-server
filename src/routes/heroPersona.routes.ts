import { Router, type Request, type Response } from "express";
import { connectDb } from "../config/db.js";
import { SavedHeroPersona } from "../models/SavedHeroPersona.js";
import mongoose from "mongoose";

const router = Router();

/**
 * POST /api/hero-personas
 * Body: { userId, walletAddress?, persona: { id, name, backstory, ... } }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const ok = await connectDb();
    if (!ok || mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, error: "database_unavailable" });
    }

    const { userId, walletAddress, persona } = req.body ?? {};
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ ok: false, error: "userId required" });
    }
    if (!persona || typeof persona !== "object" || !persona.id) {
      return res.status(400).json({ ok: false, error: "persona with id required" });
    }

    const clientPersonaId = String(persona.id);
    const wallet = walletAddress != null ? String(walletAddress).trim().toLowerCase() : "";

    const doc = await SavedHeroPersona.findOneAndUpdate(
      { userId: String(userId).trim(), clientPersonaId },
      {
        $set: {
          walletAddress: wallet || undefined,
          name: String(persona.name ?? ""),
          backstory: String(persona.backstory ?? ""),
          combatStyle: String(persona.combatStyle ?? ""),
          imageUrl: String(persona.imageUrl ?? ""),
          prompt: String(persona.prompt ?? ""),
          archetype: String(persona.archetype ?? "Sentinel"),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      ok: true,
      id: doc._id.toString(),
      persona: serializePersona(doc),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hero-personas POST]", msg);
    return res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * GET /api/hero-personas?userId=
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const ok = await connectDb();
    if (!ok || mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, error: "database_unavailable", items: [] });
    }

    const userId = String(req.query.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId query required" });
    }

    const docs = await SavedHeroPersona.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      ok: true,
      items: docs.map((d: any) => serializePersona(d)),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hero-personas GET]", msg);
    return res.status(500).json({ ok: false, error: msg, items: [] });
  }
});

function serializePersona(doc: any) {
  return {
    id: doc._id?.toString?.() ?? String(doc._id),
    userId: doc.userId,
    clientPersonaId: doc.clientPersonaId,
    walletAddress: doc.walletAddress || "",
    name: doc.name,
    backstory: doc.backstory,
    combatStyle: doc.combatStyle,
    imageUrl: doc.imageUrl,
    prompt: doc.prompt,
    archetype: doc.archetype,
    isMinted: Boolean(doc.isMinted),
    tokenId: doc.tokenId || "",
    metadataUri: doc.metadataUri || "",
    mintedAt: doc.mintedAt ? new Date(doc.mintedAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export default router;
