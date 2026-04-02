import { createHash } from "crypto";

let anchorCounter = 0;
const DPAL_EPOCH = 1700000000;

export interface AnchorResult {
  reportHash: string;
  txHash: string;
  blockNumber: number;
  chain: string;
  anchoredAt: Date;
}

export function anchorPayload(payload: Record<string, any>): AnchorResult {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  const reportHash = createHash("sha256").update(stable).digest("hex");
  const counter = ++anchorCounter;
  const now = Date.now();
  const txHash = createHash("sha256").update(`${reportHash}:${now}:${counter}`).digest("hex");
  const blockNumber = Math.floor(now / 1000) - DPAL_EPOCH + counter;
  return { reportHash, txHash, blockNumber, chain: "DPAL_INTERNAL", anchoredAt: new Date(now) };
}
