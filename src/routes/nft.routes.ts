import { Router, type Request, type Response } from "express";
import { generatePersonaImagePng } from "../services/gemini.service.js";
import { mintTestDraft } from "../minting/testMintService.js";
import crypto from "crypto";
import mongoose, { Schema, model } from "mongoose";

const router = Router();

const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();

let connected = false;
async function ensureMongo() {
  if (connected) return;
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(MONGODB_URI);
  connected = true;
}

// NFT Receipt Schema
type NftReceiptDoc = {
  userId: string;
  tokenId: string;
  prompt: string;
  theme?: string;
  category?: string;
  priceCredits?: number;
  idempotencyKey?: string;
  txHash?: string;
  imageUrl: string;
  createdAt: Date;
};

const NftReceiptSchema = new Schema<NftReceiptDoc>({
  userId: { type: String, required: true, index: true },
  tokenId: { type: String, required: true, unique: true, index: true },
  prompt: { type: String, required: true },
  theme: { type: String },
  category: { type: String },
  priceCredits: { type: Number },
  idempotencyKey: { type: String, index: true },
  txHash: { type: String },
  imageUrl: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

const NftReceipt = model<NftReceiptDoc>("NftReceipt", NftReceiptSchema);

/**
 * POST /api/nft/mint
 * Mint an NFT with the provided details
 */
router.post("/mint", async (req: Request, res: Response) => {
  try {
    await ensureMongo();

    const { userId, prompt, theme, category, priceCredits, idempotencyKey, nonce, timestamp, traits } = req.body;

    if (!userId || !prompt) {
      return res.status(400).json({ error: "userId and prompt are required" });
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await NftReceipt.findOne({ userId, idempotencyKey });
      if (existing) {
        return res.status(200).json({
          ok: true,
          tokenId: existing.tokenId,
          imageUrl: existing.imageUrl,
          txHash: existing.txHash,
          priceCredits: existing.priceCredits,
          mintedAt: existing.createdAt,
        });
      }
    }

    // Generate image and create receipt
    const txHash = `0x${crypto.randomBytes(16).toString("hex")}${Date.now().toString(16)}`;

    const testResult = await mintTestDraft({ prompt, archetype: theme || "artifact" });

    // Create receipt
    const receipt = await NftReceipt.create({
      userId: String(userId),
      tokenId: testResult.tokenId,
      prompt: String(prompt),
      theme: theme ? String(theme) : undefined,
      category: category ? String(category) : undefined,
      priceCredits: priceCredits ? Number(priceCredits) : undefined,
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
      txHash,
      imageUrl: testResult.imageUrl,
    });

    return res.status(200).json({
      ok: true,
      tokenId: receipt.tokenId,
      imageUrl: receipt.imageUrl,
      txHash: receipt.txHash,
      priceCredits: receipt.priceCredits,
      mintedAt: receipt.createdAt,
    });
  } catch (e: any) {
    console.error("NFT mint error:", e);
    return res.status(500).json({
      error: "nft mint failed",
      message: String(e?.message || e),
    });
  }
});

/**
 * POST /api/nft/generate-image
 * Generate an NFT image from a prompt
 */
router.post("/generate-image", async (req: Request, res: Response) => {
  try {
    const { prompt, theme, operativeId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
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
      error: "image generation failed",
      message: String(e?.message || e),
    });
  }
});

/**
 * GET /api/nft/receipts
 * Get all NFT receipts (optionally filtered by userId)
 */
router.get("/receipts", async (req: Request, res: Response) => {
  try {
    await ensureMongo();

    const userId = req.query.userId as string | undefined;
    const query = userId ? { userId } : {};

    const receipts = await NftReceipt.find(query).sort({ createdAt: -1 }).limit(100).lean();

    return res.status(200).json(receipts);
  } catch (e: any) {
    console.error("Get receipts error:", e);
    return res.status(500).json({
      error: "get receipts failed",
      message: String(e?.message || e),
    });
  }
});

export default router;