import { Router } from "express";
import { runGemini } from "../services/gemini.service";

const router = Router();

router.post("/ask", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const answer = await runGemini(prompt);
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI failure" });
  }
});

export default router;
