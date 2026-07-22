import crypto from "crypto";
import type { Request } from "express";

export interface ReedyRiverIngestPrincipal {
  sourceId: string;
  hmacVerified: boolean;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function parseReedyRiverIngestKeys(raw = process.env.REEDY_RIVER_INGEST_KEYS || ""): Map<string, string> {
  const keys = new Map<string, string>();
  const trimmed = raw.trim();
  if (!trimmed) return keys;

  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    for (const [sourceId, value] of Object.entries(parsed)) {
      if (typeof value === "string" && sourceId.trim() && value.trim()) {
        keys.set(sourceId.trim(), value.trim());
      }
    }
    return keys;
  }

  for (const pair of trimmed.split(",")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const sourceId = pair.slice(0, separator).trim();
    const key = pair.slice(separator + 1).trim();
    if (sourceId && key) keys.set(sourceId, key);
  }
  return keys;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readHeader(req: Request, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value.trim() : "";
}

export function authenticateReedyRiverIngest(req: Request): ReedyRiverIngestPrincipal {
  const sourceId = readHeader(req, "x-dpal-source-id");
  const suppliedKey = readHeader(req, "x-dpal-ingest-key");
  if (!sourceId || !suppliedKey) {
    throw new Error("Missing X-DPAL-Source-Id or X-DPAL-Ingest-Key header");
  }

  let configured: Map<string, string>;
  try {
    configured = parseReedyRiverIngestKeys();
  } catch {
    throw new Error("REEDY_RIVER_INGEST_KEYS is not valid JSON or source=key configuration");
  }
  if (!configured.size) {
    throw new Error("Reedy River ingest keys are not configured on the server");
  }
  const expectedKey = configured.get(sourceId);
  if (!expectedKey || !safeEqual(suppliedKey, expectedKey)) {
    throw new Error("Invalid Reedy River ingest credentials");
  }

  const signature = readHeader(req, "x-dpal-signature");
  const timestamp = readHeader(req, "x-dpal-timestamp");
  const requireHmac = parseBoolean(
    process.env.REEDY_RIVER_REQUIRE_HMAC,
    process.env.NODE_ENV === "production",
  );
  if (requireHmac && (!signature || !timestamp)) {
    throw new Error("Signed ingest requires X-DPAL-Timestamp and X-DPAL-Signature headers");
  }

  let hmacVerified = false;
  if (signature || timestamp) {
    if (!signature || !timestamp) throw new Error("Both HMAC headers are required together");
    const timestampMs = Date.parse(timestamp);
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
      throw new Error("Ingest signature timestamp is invalid or outside the five-minute window");
    }
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) throw new Error("Raw request body is unavailable for signature validation");
    const expectedSignature = crypto
      .createHmac("sha256", expectedKey)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest("hex");
    const normalizedSignature = signature.replace(/^sha256=/i, "").toLowerCase();
    if (!safeEqual(normalizedSignature, expectedSignature)) {
      throw new Error("Invalid Reedy River ingest signature");
    }
    hmacVerified = true;
  }

  return { sourceId, hmacVerified };
}

export function assertLiveOnlyPayload(input: {
  dataMode?: unknown;
  sourceId?: unknown;
  provenance?: unknown;
  flags?: Record<string, unknown>;
}): void {
  if (input.dataMode !== "live") {
    throw new Error('dataMode must be exactly "live"');
  }
  const flags = input.flags ?? {};
  if (flags.demo === true || flags.simulated === true || flags.mock === true || flags.testData === true) {
    throw new Error("Demo, simulated, mock, and test-data payloads are rejected by the live ingest API");
  }
  const provenance = input.provenance as Record<string, unknown> | undefined;
  const descriptors = [input.sourceId, provenance?.provider, provenance?.method]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  if (/\b(demo|simulated|mock|placeholder|synthetic)\b/.test(descriptors)) {
    throw new Error("Synthetic/demo provenance is not accepted by the live ingest API");
  }
}

export function configuredReedyRiverSourceIds(): string[] {
  try {
    return [...parseReedyRiverIngestKeys().keys()].sort();
  } catch {
    return [];
  }
}
