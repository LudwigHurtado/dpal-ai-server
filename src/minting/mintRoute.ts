// src/minting/mintRoute.ts
// Express route handler for Railway backend.
// No breaking changes. New endpoint is additive.
//
// POST /api/mint
// Required headers:
// x-dpal-timestamp: unix seconds or ms
// x-dpal-nonce: unique per request
// x-dpal-signature: hex HMAC SHA256
// x-dpal-caller: optional, enforced if DPAL_MINT_ALLOWED_CALLERS is set
//
// Body:
// {
//   "mintId": "string",
//   "recipientId": "string",
//   "amount": 123,
//   "reason": "REPORT_REWARD",
//   "category": "optional",
//   "externalRef": "optional"
// }

import type { Request, Response } from "express";
import { mintTokens } from "./mintTokens";

function readRawBodyBuffer(req: Request): Buffer {
  const anyReq = req as any;
  const raw = anyReq.rawBody;

  if (Buffer.isBuffer(raw)) return raw;

  // If your server does not capture rawBody, add the middleware shown below.
  // Fallback. This can change hashing if body parser modified content.
  return Buffer.from(JSON.stringify(req.body || {}), "utf8");
}

export async function mintRoute(req: Request, res: Response): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    return;
  }

  const timestamp = String(req.header("x-dpal-timestamp") || "");
  const nonce = String(req.header("x-dpal-nonce") || "");
  const signature = String(req.header("x-dpal-signature") || "");
  const caller = req.header("x-dpal-caller") || undefined;

  const rawBody = readRawBodyBuffer(req);

  const result = await mintTokens({
    auth: { timestamp, nonce, signature, caller, rawBody },
    body: req.body,
  });

  if (result.ok) {
    res.status(200).json(result);
    return;
  }

  if (result.error === "UNAUTHORIZED") {
    res.status(401).json(result);
    return;
  }

  if (result.error === "VALIDATION_ERROR") {
    res.status(400).json(result);
    return;
  }

  if (result.error === "SUPPLY_CAP_EXCEEDED") {
    res.status(409).json(result);
    return;
  }

  if (result.error === "CONCURRENT_MINT_TRY_AGAIN") {
    res.status(409).json(result);
    return;
  }

  if (result.error === "REPLAY_DETECTED") {
    res.status(409).json(result);
    return;
  }

  if (result.error === "SERVER_MISCONFIGURED") {
    res.status(500).json(result);
    return;
  }

  res.status(500).json(result);
}
