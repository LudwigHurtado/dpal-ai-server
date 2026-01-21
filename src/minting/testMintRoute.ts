import type { Request, Response } from "express";
import { mintTestDraft } from "./testMintService";

export async function testMintRoute(req: Request, res: Response) {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const archetype = String(req.body?.archetype || "").trim();

    if (!prompt || !archetype) {
      return res.status(400).json({ error: "prompt and archetype are required" });
    }

    const receipt = await mintTestDraft({ prompt, archetype });

    return res.status(200).json(receipt);
  } catch (e: any) {
    return res.status(500).json({
      error: "test mint failed",
      message: String(e?.message || e),
    });
  }
}
