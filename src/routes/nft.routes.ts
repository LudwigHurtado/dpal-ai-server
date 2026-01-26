import { Router, type Request, type Response } from "express";
import { generatePersonaImagePng } from "../services/gemini.service.js";
import { serveAssetImage } from "../services/mint.service.js";
import { connectDb } from "../config/db.js";
import { MintReceipt } from "../models/MintReceipt.js";
import { Wallet } from "../models/Wallet.js"; // Assumes a Wallet model exists
import { LedgerEntry } from "../models/LedgerEntry.js"; // Assumes a LedgerEntry model exists
import { AuditEvent } from "../models/AuditEvent.js"; // Assumes an AuditEvent model exists
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

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
    const idemKey = idempotencyKey || uuidv4();

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
    let wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      // Always auto-create wallet for new users
      wallet = new Wallet({ userId, balance: 0 });
      await wallet.save({ session });
    }

    if (wallet.locked) {
      await session.abortTransaction();
      session.endSession();
      return res.status(423).json({
        error: "wallet_locked",
        message: "Wallet is currently locked for an operation"
      });
    }

    if (wallet.balance < finalPriceCredits) {
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        error: "insufficient_balance",
        message: "Insufficient credits in wallet to complete mint",
      });
    }

    // === Lock Credits ===
    wallet.locked = true;
    wallet.lockReason = `mint-nft:${idemKey}`;
    await wallet.save({ session });

    // === Ledger Entry: DEBIT (PENDING) ===
    const ledgerEntry = await LedgerEntry.create([{
      userId,
      amount: -finalPriceCredits,
      type: "MINT_DEBIT_PENDING",
      memo: "Mint NFT - pending",
      refId: idemKey,
      status: "pending"
    }], { session });

    // === Audit Event: mint initiated ===
    await AuditEvent.create([{
      userId,
      eventType: "NFT_MINT_INITIATED",
      eventSource: "nft.routes.ts",
      details: {
        prompt: prompt,
        theme,
        category,
        priceCredits: finalPriceCredits,
        idempotencyKey: idemKey,
        traits
      },
      refId: idemKey,
      timestamp: new Date()
    }], { session });
    
    // === (Try) Mint Logic ===
    // Let's call image generation and then record mint
    let imageUrl, pngBytes, nftId;
    try {
      pngBytes = await generatePersonaImagePng({
        description: prompt.trim(),
        archetype: String(theme || "artifact"),
        traits
      });
      const base64 = pngBytes.toString("base64");
      imageUrl = `data:image/png;base64,${base64}`;
      nftId = `nft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    } catch (err) {
      // === Rollback debit, unlock wallet, audit failure ===
      await LedgerEntry.updateOne({ _id: ledgerEntry[0]._id }, { $set: { status: "rollback", memo: "Mint failed, rollback debit" } }, { session });
      wallet.locked = false;
      wallet.lockReason = null;
      await wallet.save({ session });
      await AuditEvent.create([{
        userId,
        eventType: "NFT_MINT_IMAGE_FAILED",
        eventSource: "nft.routes.ts",
        details: { prompt, error: String(err) },
        refId: idemKey,
        timestamp: new Date()
      }], { session });
      await session.abortTransaction();
      session.endSession();

      return res.status(502).json({
        error: "image_generation_failed",
        message: "Failed to generate NFT image. Please try again.",
      });
    }

    // === Ledger Entry: DEBIT (COMPLETED) + update ===
    await LedgerEntry.updateOne({ _id: ledgerEntry[0]._id }, { $set: { status: "completed", memo: "Mint NFT - completed" } }, { session });

    // === Wallet balance deduction (+ unlock wallet) ===
    wallet.balance -= finalPriceCredits;
    wallet.locked = false;
    wallet.lockReason = null;
    await wallet.save({ session });

    // === Mint Receipt ===
    const mintReceipt = await MintReceipt.create([{
      userId,
      nftId,
      prompt: prompt.trim(),
      imageUrl,
      theme, 
      category,
      traits,
      creditsSpent: finalPriceCredits,
      idempotencyKey: idemKey,
      createdAt: new Date(),
    }], { session });

    // === Ledger Entry: CREDIT (offset back if failed, not needed here) ===

    // === Audit Event: MINT_SUCCESS ===
    await AuditEvent.create([{
      userId,
      eventType: "NFT_MINT_SUCCESS",
      eventSource: "nft.routes.ts",
      details: {
        nftId,
        prompt: prompt.trim(),
        creditsSpent: finalPriceCredits,
        receiptId: mintReceipt[0]._id
      },
      refId: idemKey,
      timestamp: new Date()
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      ok: true,
      receipt: mintReceipt[0],
      imageUrl
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
