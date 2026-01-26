import { Router, type Request, type Response } from "express";
import { generatePersonaImagePng } from "../services/gemini.service.js";
import { serveAssetImage } from "../services/mint.service.js";
import { connectDb } from "../config/db.js";
import { MintReceipt } from "../models/MintReceipt.js";
import { CreditWallet } from "../models/CreditWallet.js";
import { CreditLedger } from "../models/CreditLedger.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { NftAsset } from "../models/NftAsset.js";
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
 * Mint an NFT with the provided details
 * Implements full wallet/credit system with transactions and audit logging
 */
router.post("/mint", async (req: Request, res: Response) => {
  await connectDb();

  // For atomicity, wrap operation in a DB transaction/session
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, prompt, theme, category, priceCredits, idempotencyKey, nonce, timestamp, traits } = req.body;

    // === Input Validation ===
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "userId is required and must be a non-empty string" });
    }
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "prompt is required and must be a non-empty string" });
    }
    if (priceCredits !== undefined) {
      const credits = Number(priceCredits);
      if (isNaN(credits) || credits < 0 || !Number.isInteger(credits)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "priceCredits must be a non-negative integer" });
      }
    }

    const finalPriceCredits = priceCredits !== undefined ? Number(priceCredits) : 0;
    // Normalize idempotency key
    const idemKey = idempotencyKey || `mint-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // === Check for in-progress or duplicate mint (idempotency) ===
    const existingReceipt = await MintReceipt.findOne({ userId, idempotencyKey: idemKey }).session(session);
    if (existingReceipt) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        error: "mint_in_progress",
        message: "A mint request with this idempotency key was already processed",
        receipt: existingReceipt
      });
    }

    // === Wallet balance and "locking" ===
    // Ensure wallet exists
    await CreditWallet.updateOne(
      { userId },
      { $setOnInsert: { balance: 10000, lockedBalance: 0 } },
      { upsert: true, session }
    );

    // Check balance and lock credits
    const wallet = await CreditWallet.findOneAndUpdate(
      { userId, balance: { $gte: finalPriceCredits }, lockedBalance: 0 },
      {
        $inc: { balance: -finalPriceCredits, lockedBalance: finalPriceCredits },
        $set: { updatedAt: new Date() }
      },
      { session, new: true }
    );

    if (!wallet) {
      await session.abortTransaction();
      session.endSession();
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
    }], { session });

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
    }], { session });
    
    // === (Try) Mint Logic ===
    // Let's call image generation and then record mint
    let base64: string, tokenId: string;
    try {
      const pngBytes = await generatePersonaImagePng({
        description: prompt.trim(),
        archetype: String(theme || "artifact")
      });
      base64 = pngBytes.toString("base64");
      tokenId = `DPAL-${Date.now()}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
    } catch (err) {
      // === Rollback: unlock wallet, audit failure ===
      await CreditWallet.updateOne(
        { userId },
        { $inc: { balance: finalPriceCredits, lockedBalance: -finalPriceCredits } },
        { session }
      );
      await AuditEvent.create([{
        actorUserId: userId,
        action: "NFT_MINT_IMAGE_FAILED",
        entityType: "MintRequest",
        entityId: idemKey,
        hash: `mint-failed-${idemKey}`,
        meta: { prompt, error: String(err) }
      }], { session });
      await session.abortTransaction();
      session.endSession();

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
    }], { session });

    // === Create MintRequest for receipt reference ===
    const { MintRequest } = await import("../models/MintRequest.js");
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
    }], { session });

    // === Complete ledger entry (spend) ===
    const spendLedgerEntry = await CreditLedger.create([{
      userId,
      type: "CREDIT_SPEND",
      amount: finalPriceCredits,
      direction: "DEBIT",
      referenceId: mintRequest[0]._id.toString(),
      idempotencyKey: `spend-${idemKey}`,
      meta: { prompt, theme, category }
    }], { session });

    // Unlock wallet (deduct from lockedBalance)
    await CreditWallet.updateOne(
      { userId },
      { $inc: { lockedBalance: -finalPriceCredits } },
      { session }
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
    }], { session });

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
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      ok: true,
      tokenId,
      imageUrl: `/api/assets/${tokenId}.png`,
      txHash: mintReceipt[0].txHash,
      priceCredits: finalPriceCredits,
      mintedAt: mintReceipt[0].createdAt
    });

  } catch (error: any) {
    try {
      await session.abortTransaction();
    } catch {}
    session.endSession();

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
