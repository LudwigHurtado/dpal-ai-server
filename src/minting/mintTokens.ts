// src/minting/mintTokens.ts
// DPAL Utility Coin Phase I Minting
// Production hardened, idempotent, auditable, replay resistant.
// Backend only. No frontend minting.
// MongoDB required.
// Mongoose required.

import crypto from "crypto";
import mongoose, { Schema, model, type ClientSession } from "mongoose";

const ENV = {
  MONGODB_URI: process.env.MONGODB_URI || "",
  DPAL_MINT_SUPPLY_CAP: process.env.DPAL_MINT_SUPPLY_CAP || "",

  // Required for authorized backend calls and replay resistance.
  // Calls MUST include headers:
  // x-dpal-timestamp, x-dpal-nonce, x-dpal-signature
  // Signature = HMAC_SHA256(secret, `${timestamp}.${nonce}.${sha256(rawBody)}`)
  DPAL_MINT_HMAC_SECRET: process.env.DPAL_MINT_HMAC_SECRET || "",

  // Optional, allow only known backend service IDs.
  // Header: x-dpal-caller must be in this comma list.
  DPAL_MINT_ALLOWED_CALLERS: process.env.DPAL_MINT_ALLOWED_CALLERS || "",

  // Safety window for replay prevention.
  DPAL_MINT_MAX_SKEW_SECONDS: process.env.DPAL_MINT_MAX_SKEW_SECONDS || "120",
};

function mustEnv(name: keyof typeof ENV): string {
  const v = ENV[name];
  if (!v) throw new Error(`SERVER_MISCONFIGURED_MISSING_ENV_${name}`);
  return v;
}

function toIntStrict(value: string, name: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`INVALID_ENV_${name}`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`INVALID_ENV_${name}`);
  return n;
}

function sha256Hex(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmacSha256Hex(secret: string, input: string): string {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export type MintReason =
  | "REPORT_REWARD"
  | "BADGE_REWARD"
  | "ADMIN_ADJUSTMENT"
  | "MIGRATION"
  | "OTHER";

export type MintRequest = {
  recipientId: string;
  amount: number;
  reason: MintReason;
  category?: string;
  externalRef?: string;

  // Idempotency key supplied by the caller.
  // If the same mintId is used again, the function returns the existing record.
  mintId: string;
};

export type MintResult = {
  ok: true;
  mintId: string;
  timestamp: string;
  recipientId: string;
  amount: number;
  reason: MintReason;
  category?: string;
  externalRef?: string;
  checksum: string;
  supplyCap: number;
  totalMintedAfter: number;
} | {
  ok: false;
  error: string;
  message?: string;
  mintId?: string;
};

type MintEventDoc = {
  mintId: string;
  createdAt: Date;

  recipientId: string;
  amount: number;
  reason: MintReason;
  category?: string;
  externalRef?: string;

  caller?: string;

  // Replay and audit fields.
  requestTimestamp: number;
  nonce: string;

  // Verification checksum for public audit.
  // checksum = sha256(`${mintId}.${createdAtISO}.${recipientId}.${amount}.${reason}.${categoryOrEmpty}.${externalRefOrEmpty}`)
  checksum: string;
};

type SupplyDoc = {
  _id: "DPAL_UTILITY_COIN_PHASE_I";
  supplyCap: number;
  totalMinted: number;
  updatedAt: Date;
};

const MintEventSchema = new Schema<MintEventDoc>(
  {
    mintId: { type: String, required: true, trim: true },
    createdAt: { type: Date, required: true },

    recipientId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    category: { type: String, required: false },
    externalRef: { type: String, required: false },

    caller: { type: String, required: false },

    requestTimestamp: { type: Number, required: true },
    nonce: { type: String, required: true, trim: true },

    checksum: { type: String, required: true, trim: true },
  },
  {
    collection: "dpal_mint_events",
    versionKey: false,
  }
);

const SupplySchema = new Schema<SupplyDoc>(
  {
    _id: { type: String, required: true },
    supplyCap: { type: Number, required: true },
    totalMinted: { type: Number, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    collection: "dpal_mint_supply",
    versionKey: false,
  }
);

MintEventSchema.index({ mintId: 1 }, { unique: true, name: "uniq_mintId" });
MintEventSchema.index({ recipientId: 1, createdAt: -1 }, { name: "by_recipient_time" });
MintEventSchema.index({ nonce: 1 }, { unique: true, name: "uniq_nonce" });
MintEventSchema.index({ createdAt: -1 }, { name: "by_time" });

SupplySchema.index({ _id: 1 }, { unique: true, name: "uniq_supply_doc" });

const MintEventModel =
  mongoose.models.DpalMintEvent || model<MintEventDoc>("DpalMintEvent", MintEventSchema);

const SupplyModel =
  mongoose.models.DpalMintSupply || model<SupplyDoc>("DpalMintSupply", SupplySchema);

function requireString(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== "string") throw new Error(`INVALID_${field}`);
  const s = value.trim();
  if (!s) throw new Error(`INVALID_${field}`);
  if (s.length > maxLen) throw new Error(`INVALID_${field}_TOO_LONG`);
  return s;
}

function requireAmount(value: unknown): number {
  if (typeof value !== "number") throw new Error("INVALID_amount");
  if (!Number.isFinite(value)) throw new Error("INVALID_amount");
  if (!Number.isSafeInteger(value)) throw new Error("INVALID_amount");
  if (value <= 0) throw new Error("INVALID_amount");
  return value;
}

function requireReason(value: unknown): MintReason {
  if (typeof value !== "string") throw new Error("INVALID_reason");
  const r = value.trim();
  const allowed: MintReason[] = [
    "REPORT_REWARD",
    "BADGE_REWARD",
    "ADMIN_ADJUSTMENT",
    "MIGRATION",
    "OTHER",
  ];
  if (!allowed.includes(r as MintReason)) throw new Error("INVALID_reason");
  return r as MintReason;
}

function parseAllowedCallers(csv: string): Set<string> {
  const set = new Set<string>();
  csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => set.add(s));
  return set;
}

export type MintAuthHeaders = {
  timestamp: string;
  nonce: string;
  signature: string;
  caller?: string;
  rawBody: Buffer;
};

export function verifyMintAuthHeaders(h: MintAuthHeaders): void {
  const secret = mustEnv("DPAL_MINT_HMAC_SECRET");
  const maxSkew = toIntStrict(mustEnv("DPAL_MINT_MAX_SKEW_SECONDS"), "DPAL_MINT_MAX_SKEW_SECONDS");

  const ts = requireString(h.timestamp, "timestamp", 32);
  if (!/^\d{10,13}$/.test(ts)) throw new Error("UNAUTHORIZED_INVALID_TIMESTAMP");

  const tsNum = Number(ts);
  const nowMs = Date.now();
  const tsMs = ts.length === 10 ? tsNum * 1000 : tsNum;

  const skewSeconds = Math.abs(nowMs - tsMs) / 1000;
  if (skewSeconds > maxSkew) throw new Error("UNAUTHORIZED_STALE_REQUEST");

  const nonce = requireString(h.nonce, "nonce", 128);
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(nonce)) throw new Error("UNAUTHORIZED_INVALID_NONCE");

  const sig = requireString(h.signature, "signature", 128);
  if (!/^[a-f0-9]{64}$/.test(sig)) throw new Error("UNAUTHORIZED_INVALID_SIGNATURE");

  const allowedCallers = parseAllowedCallers(ENV.DPAL_MINT_ALLOWED_CALLERS || "");
  if (allowedCallers.size > 0) {
    const caller = (h.caller || "").trim();
    if (!caller) throw new Error("UNAUTHORIZED_CALLER_MISSING");
    if (!allowedCallers.has(caller)) throw new Error("UNAUTHORIZED_CALLER_NOT_ALLOWED");
  }

  const bodyHash = sha256Hex(h.rawBody);
  const payload = `${ts}.${nonce}.${bodyHash}`;
  const expected = hmacSha256Hex(secret, payload);

  if (!timingSafeEqualHex(expected, sig)) throw new Error("UNAUTHORIZED_BAD_SIGNATURE");
}

async function ensureMongoConnected(): Promise<void> {
  const uri = mustEnv("MONGODB_URI");
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri, {
    autoIndex: true,
  });
}

async function ensureSupplyDoc(session: ClientSession): Promise<SupplyDoc> {
  const cap = toIntStrict(mustEnv("DPAL_MINT_SUPPLY_CAP"), "DPAL_MINT_SUPPLY_CAP");
  const now = new Date();

  const existing = await SupplyModel.findById("DPAL_UTILITY_COIN_PHASE_I").session(session);
  if (existing) {
    if (!Number.isSafeInteger(existing.supplyCap) || existing.supplyCap <= 0) {
      throw new Error("SUPPLY_DOC_INVALID");
    }
    if (existing.supplyCap !== cap) {
      // Migration safe. Do not silently lower cap. Only allow raising cap.
      if (cap < existing.supplyCap) throw new Error("SUPPLY_CAP_CANNOT_DECREASE");
      existing.supplyCap = cap;
      existing.updatedAt = now;
      await existing.save({ session });
    }
    return existing.toObject() as SupplyDoc;
  }

  const created = await SupplyModel.create(
    [
      {
        _id: "DPAL_UTILITY_COIN_PHASE_I",
        supplyCap: cap,
        totalMinted: 0,
        updatedAt: now,
      },
    ],
    { session }
  );

  return created[0].toObject() as SupplyDoc;
}

function computeChecksum(args: {
  mintId: string;
  createdAtISO: string;
  recipientId: string;
  amount: number;
  reason: string;
  category?: string;
  externalRef?: string;
}): string {
  const category = (args.category || "").trim();
  const externalRef = (args.externalRef || "").trim();

  const payload = [
    args.mintId,
    args.createdAtISO,
    args.recipientId,
    String(args.amount),
    args.reason,
    category,
    externalRef,
  ].join(".");

  return sha256Hex(payload);
}

function normalizeMintRequest(input: unknown): MintRequest {
  const obj = (input || {}) as Record<string, unknown>;

  const mintId = requireString(obj.mintId, "mintId", 96);
  if (!/^[A-Za-z0-9._:-]{20,96}$/.test(mintId)) throw new Error("INVALID_mintId");

  const recipientId = requireString(obj.recipientId, "recipientId", 128);
  if (!/^[A-Za-z0-9._:@-]{6,128}$/.test(recipientId)) throw new Error("INVALID_recipientId");

  const amount = requireAmount(obj.amount);

  const reason = requireReason(obj.reason);

  const categoryRaw = obj.category === undefined ? undefined : requireString(obj.category, "category", 64);
  const category = categoryRaw ? categoryRaw : undefined;

  const externalRefRaw =
    obj.externalRef === undefined ? undefined : requireString(obj.externalRef, "externalRef", 128);
  const externalRef = externalRefRaw ? externalRefRaw : undefined;

  return { mintId, recipientId, amount, reason, category, externalRef };
}

export async function mintTokens(params: {
  auth: MintAuthHeaders;
  body: unknown;
}): Promise<MintResult> {
  try {
    await ensureMongoConnected();

    verifyMintAuthHeaders(params.auth);

    const req = normalizeMintRequest(params.body);

    const requestTimestamp = Number(params.auth.timestamp.length === 10
      ? Number(params.auth.timestamp) * 1000
      : Number(params.auth.timestamp));

    const nonce = params.auth.nonce.trim();
    const caller = (params.auth.caller || "").trim() || undefined;

    const session = await mongoose.startSession();

    let result: MintResult | null = null;

    await session.withTransaction(async () => {
      const existing = await MintEventModel.findOne({ mintId: req.mintId }).session(session);
      if (existing) {
        const supply = await SupplyModel.findById("DPAL_UTILITY_COIN_PHASE_I").session(session);
        const supplyCap = supply?.supplyCap ?? toIntStrict(mustEnv("DPAL_MINT_SUPPLY_CAP"), "DPAL_MINT_SUPPLY_CAP");
        const totalAfter = supply?.totalMinted ?? 0;

        result = {
          ok: true,
          mintId: existing.mintId,
          timestamp: existing.createdAt.toISOString(),
          recipientId: existing.recipientId,
          amount: existing.amount,
          reason: existing.reason,
          category: existing.category,
          externalRef: existing.externalRef,
          checksum: existing.checksum,
          supplyCap,
          totalMintedAfter: totalAfter,
        };
        return;
      }

      const supply = await ensureSupplyDoc(session);

      const newTotal = supply.totalMinted + req.amount;
      if (newTotal > supply.supplyCap) {
        result = { ok: false, error: "SUPPLY_CAP_EXCEEDED", mintId: req.mintId };
        return;
      }

      // Strong cap enforcement at DB level using conditional update.
      const now = new Date();
      const updated = await SupplyModel.findOneAndUpdate(
        {
          _id: "DPAL_UTILITY_COIN_PHASE_I",
          totalMinted: supply.totalMinted,
        },
        {
          $set: { updatedAt: now },
          $inc: { totalMinted: req.amount },
        },
        {
          new: true,
          session,
        }
      );

      if (!updated) {
        // Concurrent mint changed the supply doc. Safe retry behavior for caller.
        result = { ok: false, error: "CONCURRENT_MINT_TRY_AGAIN", mintId: req.mintId };
        return;
      }

      // Replay defense at DB level. Nonce is unique.
      const createdAtISO = now.toISOString();
      const checksum = computeChecksum({
        mintId: req.mintId,
        createdAtISO,
        recipientId: req.recipientId,
        amount: req.amount,
        reason: req.reason,
        category: req.category,
        externalRef: req.externalRef,
      });

      try {
        await MintEventModel.create(
          [
            {
              mintId: req.mintId,
              createdAt: now,

              recipientId: req.recipientId,
              amount: req.amount,
              reason: req.reason,
              category: req.category,
              externalRef: req.externalRef,

              caller,

              requestTimestamp,
              nonce,

              checksum,
            },
          ],
          { session }
        );
      } catch (e: any) {
        // If mintId or nonce already exists, treat as idempotent or replay.
        // If mintId exists, return that record.
        if (e?.code === 11000) {
          const again = await MintEventModel.findOne({ mintId: req.mintId }).session(session);
          if (again) {
            result = {
              ok: true,
              mintId: again.mintId,
              timestamp: again.createdAt.toISOString(),
              recipientId: again.recipientId,
              amount: again.amount,
              reason: again.reason,
              category: again.category,
              externalRef: again.externalRef,
              checksum: again.checksum,
              supplyCap: updated.supplyCap,
              totalMintedAfter: updated.totalMinted,
            };
            return;
          }
          result = { ok: false, error: "REPLAY_DETECTED", mintId: req.mintId };
          return;
        }
        throw e;
      }

      result = {
        ok: true,
        mintId: req.mintId,
        timestamp: now.toISOString(),
        recipientId: req.recipientId,
        amount: req.amount,
        reason: req.reason,
        category: req.category,
        externalRef: req.externalRef,
        checksum,
        supplyCap: updated.supplyCap,
        totalMintedAfter: updated.totalMinted,
      };
    });

    session.endSession();

    if (!result) return { ok: false, error: "UNKNOWN_ERROR" };
    return result;
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    if (msg.startsWith("SERVER_MISCONFIGURED_MISSING_ENV_")) return { ok: false, error: "SERVER_MISCONFIGURED", message: msg };
    if (msg.startsWith("INVALID_")) return { ok: false, error: "VALIDATION_ERROR", message: msg };
    if (msg.startsWith("UNAUTHORIZED_")) return { ok: false, error: "UNAUTHORIZED", message: msg };
    if (msg === "SUPPLY_CAP_CANNOT_DECREASE") return { ok: false, error: "SERVER_MISCONFIGURED", message: msg };
    return { ok: false, error: "MINT_FAILED", message: msg };
  }
}
