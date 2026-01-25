import { Router, type Request, type Response } from "express";
import { generatePersonaImagePng } from "../services/gemini.service.js";
import { executeMintFlow, serveAssetImage } from "../services/mint.service.js";
import { connectDb } from "../config/db.js";
import { MintReceipt } from "../models/MintReceipt.js";

const router = Router();

/**
 * GET /api/nft/test
 * Test route to verify NFT routes are loaded
 */
router.get("/test", (_req: Request, res: Response) => {
  res.json({ ok: true, message: "NFT routes are loaded and working", ts: Date.now() });
});

/**
 * POST /api/nft/mint
 * Mint an NFT with the provided details
 * Implements full wallet/credit system with transactions and audit logging
 */
router.post("/mint", async (req: Request, res: Response) => {
  try {
    await connectDb();

    const { userId, prompt, theme, category, priceCredits, idempotencyKey, nonce, timestamp, traits } = req.body;

    // Validation
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      return res.status(400).json({ error: "userId is required and must be a non-empty string" });
    }

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({ error: "prompt is required and must be a non-empty string" });
    }

    if (priceCredits !== undefined) {
      const credits = Number(priceCredits);
      if (isNaN(credits) || credits < 0 || !Number.isInteger(credits)) {
        return res.status(400).json({ error: "priceCredits must be a non-negative integer" });
      }
    }

    const finalPriceCredits = priceCredits !== undefined ? Number(priceCredits) : 0;

    // Execute full mint flow
    const result = await executeMintFlow(userId, {
      idempotencyKey,
      prompt: prompt.trim(),
      theme,
      category,
      priceCredits: finalPriceCredits,
      nonce,
      timestamp,
      traits,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("NFT mint error:", error);

    // Handle specific error types
    if (error.message === "INSUFFICIENT_RESOURCE_BALANCE") {
      return res.status(402).json({
        error: "insufficient_balance",
        message: "Insufficient credits in wallet to complete mint",
      });
    }

    if (error.message === "MINT_ALREADY_IN_PROGRESS") {
      return res.status(409).json({
        error: "mint_in_progress",
        message: "A mint request with this idempotency key is already being processed",
      });
    }

    if (error.message === "ORACLE_VISUAL_GENERATION_FAILED" || error.message?.includes("Gemini")) {
      return res.status(502).json({
        error: "image_generation_failed",
        message: "Failed to generate NFT image. Please try again.",
      });
    }

    if (error.message?.includes("GEMINI_API_KEY")) {
      return res.status(500).json({
        error: "configuration_error",
        message: "AI service is not properly configured",
      });
    }

    // Generic error
    return res.status(500).json({
      error: "mint_failed",
      message: String(error?.message || "An unexpected error occurred"),
    });
  }
});

/**
 * POST /api/nft/generate-image
 * Generate an NFT image from a prompt (preview only, doesn't mint)
 */
router.post("/generate-image", async (req: Request, res: Response) => {
  try {
    const { prompt, theme, operativeId } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({ error: "prompt is required and must be a non-empty string" });
    }

    const pngBytes = await generatePersonaImagePng({
      description: String(prompt),
      archetype: String(theme || "artifact"),
    });

    const base64 = pngBytes.toString("base64");
    const imageUrl = `data:image/png;base64,${base64}`;

    return res.status(200).json({
      ok: true,
      imageUrl,
    });
  } catch (e: any) {
    console.error("NFT image generation error:", e);
    return res.status(500).json({
      error: "image_generation_failed",
      message: String(e?.message || "Failed to generate image"),
    });
  }
});

/**
 * GET /api/nft/receipts
 * Get all NFT receipts (optionally filtered by userId)
 */
router.get("/receipts", async (req: Request, res: Response) => {
  try {
    await connectDb();

    const userId = req.query.userId as string | undefined;
    const query = userId ? { userId: String(userId) } : {};

    const receipts = await MintReceipt.find(query).sort({ createdAt: -1 }).limit(100).lean();

    return res.status(200).json(receipts);
  } catch (e: any) {
    console.error("Get receipts error:", e);
    return res.status(500).json({
      error: "get_receipts_failed",
      message: String(e?.message || "Failed to retrieve receipts"),
    });
  }
});

export default router;
