import crypto from "crypto";
import mongoose, { Schema, model } from "mongoose";
import { generatePersonaImagePng } from "../services/gemini.service.js";

const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();

let connected = false;

async function ensureMongo() {
  if (connected) return;
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(MONGODB_URI);
  connected = true;
}

type TestAssetDoc = {
  tokenId: string;
  prompt: string;
  archetype: string;
  mimeType: "image/png";
  imageData: Buffer;
  isTest: boolean;
  createdAt: Date;
};

const TestAssetSchema = new Schema<TestAssetDoc>({
  tokenId: { type: String, required: true, unique: true, index: true },
  prompt: { type: String, required: true },
  archetype: { type: String, required: true },
  mimeType: { type: String, required: true, default: "image/png" },
  imageData: { type: Buffer, required: true },
  isTest: { type: Boolean, required: true, default: true },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

const TestAsset = model<TestAssetDoc>("TestMintAsset", TestAssetSchema);

function newTokenId() {
  return crypto.randomBytes(12).toString("hex");
}

export async function mintTestDraft(input: { prompt: string; archetype: string }) {
  await ensureMongo();

  const tokenId = newTokenId();

  const pngBytes = await generatePersonaImagePng({
    description: input.prompt,
    archetype: input.archetype,
  });

  await TestAsset.create({
    tokenId,
    prompt: input.prompt,
    archetype: input.archetype,
    mimeType: "image/png",
    imageData: Buffer.from(pngBytes),
    isTest: true,
  });

  return {
    ok: true,
    tokenId,
    imageUrl: `/api/assets/${tokenId}.png`,
  };
}

export async function getAssetPngByTokenId(tokenId: string) {
  await ensureMongo();
  return TestAsset.findOne({ tokenId }).select({ imageData: 1 }).lean();
}
