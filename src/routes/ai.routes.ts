import { Router, type Request, type Response } from "express";
import { runGemini } from "../services/gemini.service.js";

console.log("runGemini is:", typeof runGemini);
const router = Router();

/**
 * GET /api/ai/health
 * Light check by default (fast, no model call).
 * Deep check when ?deep=1 (pings Gemini).
 */
router.get("/health", async (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);

  // Light mode: confirm server + env is wired (no external call)
  if (req.query.deep !== "1") {
    return res.status(200).json({
      ok: true,
      service: "ai",
      mode: "light",
      provider: "gemini",
      hasKey,
      model: process.env.GEMINI_MODEL || "unknown",
      ts: Date.now(),
    });
  }

  // Deep mode: actually call Gemini with a tiny prompt
  if (!hasKey) {
    return res.status(200).json({
      ok: false,
      service: "ai",
      mode: "deep",
      provider: "gemini",
      hasKey: false,
      error: "missing_GEMINI_API_KEY",
      ts: Date.now(),
    });
  }

  try {
    const sample = await runGemini("ping");
    return res.status(200).json({
      ok: true,
      service: "ai",
      mode: "deep",
      provider: "gemini",
      hasKey: true,
      model: process.env.GEMINI_MODEL || "unknown",
      sample: String(sample || "").slice(0, 80),
      ts: Date.now(),
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      service: "ai",
      mode: "deep",
      provider: "gemini",
      hasKey: true,
      error: "gemini_call_failed",
      details: String(err?.message || err),
      ts: Date.now(),
    });
  }
});

/**
 * POST /api/ai/ask
 * Body: { prompt: string }
 */
router.post("/ask", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt required" });
    }

    const answer = await runGemini(prompt);
    return res.json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI failure" });
  }
});

export default router;
