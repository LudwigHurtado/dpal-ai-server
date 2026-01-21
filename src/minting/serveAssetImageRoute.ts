import type { Request, Response } from "express";
import { getAssetPngByTokenId } from "./testMintService";

export async function serveAssetImageRoute(req: Request, res: Response) {
  try {
    const tokenId = String(req.params?.tokenId || "").trim();
    if (!tokenId) {
      return res.status(400).json({ error: "tokenId is required" });
    }

    const asset = await getAssetPngByTokenId(tokenId);

    if (!asset) {
      return res.status(404).json({ error: "asset not found" });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(asset.imageData);
  } catch (e: any) {
    return res.status(500).json({
      error: "serve asset failed",
      message: String(e?.message || e),
    });
  }
}
