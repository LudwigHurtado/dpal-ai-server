/**
 * @file Mint Service
 * Handles the full NFT minting flow with wallet checks, transactions, and audit logging.
 */

import mongoose from "mongoose";
import { Buffer } from "buffer";
import { GoogleGenAI } from "@google/genai";
import { CreditWallet } from "../models/CreditWallet.js";
import { CreditLedger } from "../models/CreditLedger.js";
import { MintRequest } from "../models/MintRequest.js";
import { MintReceipt } from "../models/MintReceipt.js";
import { NftAsset } from "../models/NftAsset.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { connectDb } from "../config/db.js";

const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();

/**
 * Executes the full NFT minting transaction on the server.
 * Includes wallet balance checking, credit locking, transaction management, and audit logging.
 */
export async function executeMintFlow(userId: string, payload: any) {
  const { idempotencyKey, prompt, theme, category, priceCredits, nonce, timestamp, traits } = payload;

  console.log(`[BACKEND] Materializing Shard for Operative #${userId}...`);

  // Ensure database connection
  await connectDb();

  // 1. Idempotency Guard - Check MintRequest first (faster lookup)
  if (idempotencyKey) {
    const existingRequest = await MintRequest.findOne({ userId, idempotencyKey });
    if (existingRequest) {
      // If request exists and is completed, find the receipt
      if (existingRequest.status === "COMPLETED") {
        const existingReceipt = await MintReceipt.findOne({ mintRequestId: existingRequest._id });
        if (existingReceipt) {
          console.log(`[BACKEND] Shard already materialized for key: ${idempotencyKey}`);
          return {
            ok: true,
            tokenId: existingReceipt.tokenId,
            imageUrl: `/api/assets/${existingReceipt.tokenId}.png`,
            txHash: existingReceipt.txHash,
            priceCredits: existingReceipt.priceCredits,
            mintedAt: existingReceipt.createdAt,
          };
        }
      } else if (existingRequest.status === "PROCESSING") {
        // Request is still processing, return error to prevent duplicate
        throw new Error("MINT_ALREADY_IN_PROGRESS");
      }
    }
  }

  // 2. Ensure Wallet Exists (Provision if missing)
  await CreditWallet.updateOne(
    { userId },
    { $setOnInsert: { balance: 10000, lockedBalance: 0 } },
    { upsert: true }
  );

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 3. Lock Credits
    const wallet = await CreditWallet.findOneAndUpdate(
      { userId, balance: { $gte: priceCredits } },
      {
        $inc: { balance: -priceCredits, lockedBalance: priceCredits },
        $set: { updatedAt: new Date() },
      },
      { session, new: true }
    );

    if (!wallet) {
      throw new Error("INSUFFICIENT_RESOURCE_BALANCE");
    }

    // 4. Record Request
    const request = await MintRequest.create(
      [
        {
          userId,
          assetDraftId: `DRAFT-${Date.now()}`,
          collectionId: "GENESIS_01",
          chain: "DPAL_INTERNAL",
          priceCredits,
          idempotencyKey: idempotencyKey || `mint-${userId}-${Date.now()}`,
          nonce: nonce || `nonce-${Date.now()}`,
          timestamp: timestamp || Date.now(),
          status: "PROCESSING",
        },
      ],
      { session }
    );

    // 5. Generate Visual Telemetry (Gemini Oracle)
    console.log(`[BACKEND] Invoking Gemini Oracle for: ${prompt}`);

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const imageModel = String(process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview").trim();
    
    const imageResponse = await ai.models.generateContent({
      model: imageModel,
      contents: {
        parts: [
          {
            text: `A futuristic holographic accountability artifact for a decentralized ledger. Concept: ${prompt}. Visual Theme: ${theme || "artifact"}. Category: ${category || "general"}. Cinematic lighting, 8k resolution, detailed glass and metal surfaces.`,
          },
        ],
      },
      config: {
        imageConfig: { aspectRatio: "1:1" },
      },
    });

    let base64Image = "";
    for (const part of imageResponse.candidates[0].content.parts) {
      if (part.inlineData) {
        base64Image = part.inlineData.data;
        break;
      }
    }

    if (!base64Image) {
      throw new Error("ORACLE_VISUAL_GENERATION_FAILED");
    }

    // 6. Generate Shard Identifiers
    const tokenId = `DPAL-${Date.now()}-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`;
    const txHash = `0x${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;

    // 7. Persist Shard Artifact
    const asset = await NftAsset.create(
      [
        {
          tokenId,
          collectionId: "GENESIS_01",
          chain: "DPAL_INTERNAL",
          metadataUri: `dpal://metadata/${tokenId}`,
          imageUri: `/api/assets/${tokenId}.png`,
          attributes: traits || [],
          createdByUserId: userId,
          status: "MINTED",
          imageData: Buffer.from(base64Image, "base64"),
        },
      ],
      { session }
    );

    // 8. Settlement
    await CreditWallet.updateOne({ userId }, { $inc: { lockedBalance: -priceCredits } }, { session });

    const ledgerEntry = await CreditLedger.create(
      [
        {
          userId,
          type: "CREDIT_SPEND",
          amount: priceCredits,
          direction: "DEBIT",
          referenceId: request[0]._id.toString(),
          idempotencyKey: `spend-${idempotencyKey || request[0].idempotencyKey}`,
        },
      ],
      { session }
    );

    const receipt = await MintReceipt.create(
      [
        {
          mintRequestId: request[0]._id,
          userId,
          tokenId,
          txHash,
          chain: "DPAL_INTERNAL",
          metadataUri: asset[0].metadataUri,
          priceCredits,
          ledgerEntryId: ledgerEntry[0]._id,
        },
      ],
      { session }
    );

    await MintRequest.updateOne({ _id: request[0]._id }, { status: "COMPLETED" }, { session });

    // 9. Permanent Audit
    await AuditEvent.create(
      [
        {
          actorUserId: userId,
          action: "NFT_MINT",
          entityType: "NftAsset",
          entityId: asset[0]._id.toString(),
          hash: txHash,
          meta: { priceCredits, tokenId, prompt, theme, category },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    console.log(`[BACKEND] Shard ${tokenId} successfully committed to ledger.`);

    return {
      ok: true,
      tokenId,
      imageUrl: `/api/assets/${tokenId}.png`,
      txHash,
      priceCredits,
      mintedAt: receipt[0].createdAt,
    };
  } catch (error: any) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error(`[BACKEND] Materialization Failure: ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Serves an asset image by tokenId
 */
export async function serveAssetImage(tokenId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  await connectDb();
  const asset = await NftAsset.findOne({ tokenId });
  if (!asset || !asset.imageData) {
    throw new Error("SHARD_IDENTIFIER_NOT_FOUND");
  }
  return { buffer: asset.imageData as Buffer, mimeType: "image/png" };
}
