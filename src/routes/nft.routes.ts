import { Router, type Request, type Response } from "express";
import { generatePersonaImagePng } from "../services/gemini.service.js";
import { serveAssetImage } from "../services/mint.service.js";
import { connectDb } from "../config/db.js";
import { MintReceipt } from "../models/MintReceipt.js";
import { MintRequest } from "../models/MintRequest.js";
import { CreditWallet } from "../models/CreditWallet.js";
import { CreditLedger } from "../models/CreditLedger.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { NftAsset } from "../models/NftAsset.js";
import { Hero } from "../models/Hero.js";
import mongoose from "mongoose";

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
 * Mint an NFT with the provided details.
 *
 * NOTE: This implementation is designed to work on MongoDB instances
 * that do NOT support multi-document transactions (standalone / shared
 * deployments on Railway, etc).
 *
 * We perform the sequence of writes in a carefully ordered way and
 * manually roll back critical pieces (like wallet balance) on failure,
 * but we do NOT open a MongoDB transaction. This avoids the runtime
 * error:
 *
 *   "Transaction numbers are only allowed on a replica set member or mongos"
 *
 * which occurs when attempting to use transactions against a
 * non-replica-set MongoDB deployment.
 */
router.post("/mint", async (req: Request, res: Response) => {
  // Attempt to connect to MongoDB
  const connected = await connectDb();

  // Check if MongoDB is connected before proceeding
  if (!connected || mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "database_unavailable",
      message: "Database connection is not available. Please check MongoDB configuration and ensure MONGODB_URI is set correctly in Railway.",
      details: {
        connectionState: mongoose.connection.readyState,
        stateName:
          mongoose.connection.readyState === 0
            ? "disconnected"
            : mongoose.connection.readyState === 1
            ? "connected"
            : mongoose.connection.readyState === 2
            ? "connecting"
            : "disconnecting",
        hasUri: !!process.env.MONGODB_URI || !!process.env.MONGO_URL,
      },
    });
  }

  // IMPORTANT: No MongoDB transactions here – many hosted MongoDB
  // plans (including Railway shared Mongo) are standalone instances
  // and do not support them. All writes below are single-document
  // atomic operations.

  try {
    const { userId, prompt, theme, category, priceCredits, idempotencyKey, nonce, timestamp, traits } = req.body;

    // === Input Validation ===
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
    
    // Generate a truly unique idempotency key using crypto random to ensure
    // each mint request creates a new NFT, even if the same prompt is used.
    // This prevents duplicate NFTs from being returned.
    const crypto = await import('crypto');
    const uniqueNonce = crypto.randomBytes(16).toString('hex');
    const idemKey = idempotencyKey || `mint-${userId}-${Date.now()}-${uniqueNonce}`;

    // === Check for duplicate mint by prompt content ===
    // Only block if the EXACT same prompt was minted by this user very recently (within 3 seconds)
    // This prevents accidental double-clicks while still allowing intentional re-mints with different prompts
    const recentMintRequest = await MintRequest.findOne({
      userId,
      createdAt: { $gte: new Date(Date.now() - 3000) },
      status: 'COMPLETED'
    }).sort({ createdAt: -1 });
    
    // If there's a very recent completed mint, check if it's the same prompt (likely a double-click)
    if (recentMintRequest) {
      const recentReceipt = await MintReceipt.findOne({ mintRequestId: recentMintRequest._id });
      if (recentReceipt) {
        // Check if this is the same prompt by comparing the first part
        // (we can't store full prompt in MintRequest easily, so we check idempotency key pattern)
        // Since each mint now gets a unique crypto nonce, same prompt = different key, so allow it
        // Only block if it's the EXACT same idempotency key (true duplicate request)
        if (idempotencyKey && recentMintRequest.idempotencyKey === idempotencyKey) {
          // Exact duplicate request - return existing
          return res.status(200).json({
            ok: true,
            tokenId: recentReceipt.tokenId,
            imageUrl: `/api/assets/${recentReceipt.tokenId}.png`,
            txHash: recentReceipt.txHash,
            priceCredits: recentReceipt.priceCredits,
            mintedAt: recentReceipt.createdAt,
            duplicate: true,
          });
        }
      }
    }

    // === Wallet balance and "locking" ===
    // Ensure wallet exists with a generous starting balance so new operatives
    // can mint immediately during testing.
    await CreditWallet.updateOne(
      { userId },
      { $setOnInsert: { balance: 100000, lockedBalance: 0 } },
      { upsert: true }
    );

    // Check balance and lock credits
    let wallet = await CreditWallet.findOneAndUpdate(
      { userId, balance: { $gte: finalPriceCredits }, lockedBalance: 0 },
      {
        $inc: { balance: -finalPriceCredits, lockedBalance: finalPriceCredits },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );

    // If wallet doesn't have enough for this test environment, auto-top up
    // so you can continue minting without manual DB edits.
    if (!wallet) {
      await CreditWallet.updateOne(
        { userId },
        { $set: { balance: 100000, lockedBalance: 0, updatedAt: new Date() } }
      );
      wallet = await CreditWallet.findOneAndUpdate(
        { userId, balance: { $gte: finalPriceCredits }, lockedBalance: 0 },
        {
          $inc: { balance: -finalPriceCredits, lockedBalance: finalPriceCredits },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );
    }

    if (!wallet) {
      return res.status(402).json({
        error: "insufficient_balance",
        message: "Insufficient credits in wallet to complete mint",
      });
    }

    // === Ledger Entry: DEBIT (PENDING) ===
    const ledgerEntry = await CreditLedger.create([{
      userId,
      type: "CREDIT_LOCK",
      amount: finalPriceCredits,
      direction: "DEBIT",
      referenceId: idemKey,
      idempotencyKey: `lock-${idemKey}`,
      meta: { prompt, theme, category }
    }]);

    // === Audit Event: mint initiated ===
    await AuditEvent.create([{
      actorUserId: userId,
      action: "NFT_MINT_INITIATED",
      entityType: "MintRequest",
      entityId: idemKey,
      hash: `mint-${idemKey}`,
      meta: {
        prompt: prompt,
        theme,
        category,
        priceCredits: finalPriceCredits,
        idempotencyKey: idemKey,
        traits
      }
    }]);
    
    // === Generate unique keywords for this mint to ensure uniqueness ===
    // Use AI to enhance the prompt with unique, contextual keywords
    let enhancedPrompt = prompt.trim();
    try {
      const { runGemini } = await import("../services/gemini.service.js");
      const uniquenessPrompt = `Generate 3-5 unique, specific keywords or phrases (related to accountability, transparency, civic duty, or ${category}) that will make this NFT artifact unique. Return only a comma-separated list, no explanation. Context: ${prompt}, Theme: ${theme}, Category: ${category}`;
      const uniqueKeywords = await runGemini(uniquenessPrompt);
      if (uniqueKeywords && !uniqueKeywords.includes("placeholder")) {
        enhancedPrompt = `${prompt.trim()}, ${uniqueKeywords.trim()}`;
      }
    } catch (keywordError) {
      console.warn("Failed to generate unique keywords, using original prompt:", keywordError);
      // Continue with original prompt if keyword generation fails
    }

    // === (Try) Mint Logic ===
    // Let's call image generation and then record mint
    let base64: string, tokenId: string;
    try {
      const pngBytes = await generatePersonaImagePng({
        description: enhancedPrompt,
        archetype: String(theme || "artifact"),
        category: String(category || "general")
      });
      base64 = pngBytes.toString("base64");
      const crypto = await import('crypto');
      const uniqueSuffix = crypto.randomBytes(8).toString('hex');
      tokenId = `DPAL-${Date.now()}-${uniqueSuffix}`;
    } catch (err) {
      // === Rollback: unlock wallet, audit failure ===
      await CreditWallet.updateOne(
        { userId },
        { $inc: { balance: finalPriceCredits, lockedBalance: -finalPriceCredits } },
        {}
      );
      await AuditEvent.create([{
        actorUserId: userId,
        action: "NFT_MINT_IMAGE_FAILED",
        entityType: "MintRequest",
        entityId: idemKey,
        hash: `mint-failed-${idemKey}`,
        meta: { prompt, error: String(err) }
      }]);

      return res.status(502).json({
        error: "image_generation_failed",
        message: "Failed to generate NFT image. Please try again.",
      });
    }

    // === Save NFT Asset ===
    const nftAsset = await NftAsset.create([{
      tokenId,
      collectionId: 'GENESIS_01',
      chain: 'DPAL_INTERNAL',
      metadataUri: `dpal://metadata/${tokenId}`,
      imageUri: `/api/assets/${tokenId}.png`,
      attributes: traits || [],
      createdByUserId: userId,
      status: 'MINTED',
      imageData: Buffer.from(base64, 'base64')
    }]);

    // === Create MintRequest for receipt reference ===
    const mintRequest = await MintRequest.create([{
      userId,
      idempotencyKey: idemKey,
      assetDraftId: tokenId,
      collectionId: 'GENESIS_01',
      priceCredits: finalPriceCredits,
      chain: 'DPAL_INTERNAL',
      nonce: nonce || Math.random().toString(36).slice(2, 15),
      timestamp: timestamp || Date.now(),
      status: 'COMPLETED'
    }]);

    // === Complete ledger entry (spend) ===
    const spendLedgerEntry = await CreditLedger.create([{
      userId,
      type: "CREDIT_SPEND",
      amount: finalPriceCredits,
      direction: "DEBIT",
      referenceId: mintRequest[0]._id.toString(),
      idempotencyKey: `spend-${idemKey}`,
      meta: { prompt, theme, category }
    }]);

    // Unlock wallet (deduct from lockedBalance)
    await CreditWallet.updateOne(
      { userId },
      { $inc: { lockedBalance: -finalPriceCredits } },
      {}
    );

    // === Mint Receipt ===
    const mintReceipt = await MintReceipt.create([{
      mintRequestId: mintRequest[0]._id,
      userId,
      tokenId,
      txHash: `0x${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`,
      chain: 'DPAL_INTERNAL',
      metadataUri: nftAsset[0].metadataUri,
      priceCredits: finalPriceCredits,
      ledgerEntryId: spendLedgerEntry[0]._id,
    }]);

    // === Ledger Entry: CREDIT (offset back if failed, not needed here) ===

    // === Audit Event: MINT_SUCCESS ===
    await AuditEvent.create([{
      actorUserId: userId,
      action: "NFT_MINT",
      entityType: "NftAsset",
      entityId: nftAsset[0]._id.toString(),
      hash: mintReceipt[0].txHash,
      meta: {
        tokenId,
        prompt: prompt.trim(),
        priceCredits: finalPriceCredits,
        receiptId: mintReceipt[0]._id
      }
    }]);

    // === Add NFT to Hero's Collection ===
    // Add tokenId to hero's equippedNftIds (heroId should match userId)
    try {
      await Hero.findOneAndUpdate(
        { heroId: userId },
        { 
          $addToSet: { equippedNftIds: tokenId },
          $setOnInsert: { heroId: userId }
        },
        { upsert: true }
      );
      console.log(`✅ Added NFT ${tokenId} to hero ${userId}'s collection`);
    } catch (heroError: any) {
      console.error("⚠️ Failed to add NFT to hero collection (continuing anyway):", heroError.message);
      // Don't fail the mint if hero update fails - NFT is still saved
    }

    return res.status(200).json({
      ok: true,
      tokenId,
      imageUrl: `/api/assets/${tokenId}.png`,
      txHash: mintReceipt[0].txHash,
      priceCredits: finalPriceCredits,
      mintedAt: mintReceipt[0].createdAt
    });

  } catch (error: any) {
    console.error("NFT mint error:", error);

    // Specific errors
    if (error.message === "INSUFFICIENT_RESOURCE_BALANCE" || error.message?.includes("insufficient")) {
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

    // MongoDB connection errors
    if (error.name === "MongoNetworkError" || error.message?.includes("buffering timed out") || error.message?.includes("MongoServerError")) {
      return res.status(503).json({
        error: "database_unavailable",
        message: "Database connection failed. Please check MongoDB configuration and ensure MONGODB_URI is set correctly.",
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
