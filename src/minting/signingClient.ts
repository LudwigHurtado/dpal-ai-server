// src/minting/signingClient.ts
// Helper for authorized backend callers.
// This code must run on the backend only, never in the browser.

import crypto from "crypto";

function sha256Hex(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmacSha256Hex(secret: string, input: string): string {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

export function signMintRequest(args: {
  secret: string;
  timestampMs?: number;
  nonce: string;
  rawBody: Buffer;
}): { timestamp: string; signature: string } {
  const ts = String(args.timestampMs ?? Date.now());
  const bodyHash = sha256Hex(args.rawBody);
  const payload = `${ts}.${args.nonce}.${bodyHash}`;
  const signature = hmacSha256Hex(args.secret, payload);
  return { timestamp: ts, signature };
}
