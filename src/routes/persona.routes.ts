import { Router, type Request, type Response } from "express";
import { generatePersonaImagePng } from "../services/gemini.service.js";
import { Hero } from "../models/Hero.js";
import { connectDb } from "../config/db.js";

const router = Router();

/**
 * POST /api/persona/generate-image
 * Generate a persona/hero image
 * Optional: If heroId is provided, automatically saves to hero's avatarUrl
 * Body: { prompt: string, archetype: string, heroId?: string }
 */
router.post("/generate-image", async (req: Request, res: Response) => {
  try {
    const { prompt, archetype, heroId } = req.body;

    if (!prompt || !archetype) {
      return res.status(400).json({ error: "prompt and archetype are required" });
    }

    // Generate the image
    const pngBytes = await generatePersonaImagePng({
      description: String(prompt),
      archetype: String(archetype),
    });

    const base64 = pngBytes.toString("base64");
    const imageUrl = `data:image/png;base64,${base64}`;

    // If heroId is provided, save to hero's avatarUrl
    if (heroId) {
      try {
        await connectDb();
        await Hero.findOneAndUpdate(
          { heroId: String(heroId) },
          { $set: { avatarUrl: imageUrl }, $setOnInsert: { heroId: String(heroId) } },
          { new: true, upsert: true }
        );
        console.log(`✅ Saved persona image to hero ${heroId}'s avatarUrl`);
      } catch (dbError: any) {
        console.error("Failed to save to hero:", dbError);
        // Don't fail the request if DB save fails, just log it
      }
    }

    return res.status(200).json({
      ok: true,
      imageUrl,
      savedToHero: Boolean(heroId),
    });
  } catch (e: any) {
    console.error("Persona image generation error:", e);
    return res.status(500).json({
      error: "persona image generation failed",
      message: String(e?.message || e),
    });
  }
});

export default router;