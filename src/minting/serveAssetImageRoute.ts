import type { Request, Response } from "express";
import { serveAssetImage } from "../services/mint.service.js";

export async function serveAssetImageRoute(req: Request, res: Response) {
  try {
    const tokenId = String(req.params?.tokenId || "").trim();
    if (!tokenId) {
      return res.status(400).json({ error: "tokenId is required" });
    }

    const { buffer, mimeType } = await serveAssetImage(tokenId);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).send(buffer);
  } catch (e: any) {
    if (e.message === "SHARD_IDENTIFIER_NOT_FOUND") {
      return res.status(404).json({ error: "asset not found" });
    }
    console.error("Serve asset error:", e);
    return res.status(500).json({
      error: "serve_asset_failed",
      message: String(e?.message || "Failed to serve asset"),
    });
  }
}
