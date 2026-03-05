import { Router, type Request, type Response } from "express";
import { generatePersonaImagePng } from "../services/gemini.service.js";
import { Hero } from "../models/Hero.js";
import { connectDb } from "../config/db.js";

const router = Router();

/**
 * POST /api/persona/generate-image
 * Generate a persona/hero image
 * Optional: If heroId is provided, automatically saves to hero's avatarUrl
 * Body: { prompt: string, archetype: string, heroId?: string }
 */
router.post("/generate-image", async (req: Request, res: Response) => {
  try {
    const { prompt, archetype, heroId } = req.body;

    if (!prompt || !archetype) {
      return res.status(400).json({ error: "prompt and archetype are required" });
    }

    // Generate the image
    const pngBytes = await generatePersonaImagePng({
      description: String(prompt),
      archetype: String(archetype),
    });

    const base64 = pngBytes.toString("base64");
    const imageUrl = `data:image/png;base64,${base64}`;

    // If heroId is provided, save to hero's avatarUrl
    if (heroId) {
      try {
        await connectDb();
        await Hero.findOneAndUpdate(
          { heroId: String(heroId) },
          {
            $set: { avatarUrl: imageUrl },
            $setOnInsert: {},
          },
          { new: true, upsert: true }
        );
        console.log(`✅ Saved persona image to hero ${heroId}'s avatarUrl`);
      } catch (dbError: any) {
        console.error("Failed to save to hero:", dbError);
        // Don't fail the request if DB save fails, just log it
      }
    }

    return res.status(200).json({
      ok: true,
      imageUrl,
      savedToHero: Boolean(heroId),
    });
  } catch (e: any) {
    console.error("Persona image generation error:", e);
    return res.status(500).json({
      error: "persona image generation failed",
      message: String(e?.message || e),
    });
  }
});


/**
 * POST /api/persona/generate-details
 * Generate persona details (name, backstory, combatStyle) from prompt and archetype
 * Body: { prompt: string, archetype: string }
 */
router.post("/generate-details", async (req: Request, res: Response) => {
  try {
    const { prompt, archetype } = req.body;

    if (!prompt || !archetype) {
      return res.status(400).json({ error: "prompt and archetype are required" });
    }

    const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    const model = String(process.env.GEMINI_MODEL || "gemini-3-flash-preview").trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const geminiPrompt = `Persona details for ${archetype}: ${prompt}.`;
    // This is where the generationConfig for Gemini is constructed, specifying we want a JSON response with name, backstory, combatStyle.
    // The requestBody is defined immediately after this block

    const requestBody = {
      contents: [{ parts: [{ text: geminiPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            backstory: { type: "string" },
            combatStyle: { type: "string" }
          },
          required: ["name", "backstory", "combatStyle"]
        }
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return res.status(response.status).json({
        error: "persona details generation failed",
        message: `Gemini API error: ${response.status}`,
      });
    }

    const json: any = await response.json();
    const candidates = json?.candidates || [];
    
    if (candidates.length === 0) {
      return res.status(500).json({
        error: "persona details generation failed",
        message: "No response from Gemini API",
      });
    }

    const parts = candidates[0]?.content?.parts || [];
    const textPart = parts.find((p: any) => p?.text);

    if (!textPart?.text) {
      return res.status(500).json({
        error: "persona details generation failed",
        message: "No text in Gemini response",
      });
    }

    // Parse the JSON response
    let details;
    try {
      details = JSON.parse(textPart.text);
    } catch (parseError) {
      console.error("Failed to parse JSON from Gemini:", parseError);
      // Fallback to structured response
      details = {
        name: `Agent ${archetype}`,
        backstory: textPart.text || `A ${archetype} operative with a mysterious past.`,
        combatStyle: "Tactical"
      };
    }

    // Ensure all required fields are present
    if (!details.name) details.name = `Agent ${archetype}`;
    if (!details.backstory) details.backstory = `A ${archetype} operative with a mysterious past.`;
    if (!details.combatStyle) details.combatStyle = "Tactical";

    return res.status(200).json(details);

  } catch (e: any) {
    console.error("Persona details generation error:", e);
    return res.status(500).json({
      error: "persona details generation failed",
      message: String(e?.message || e),
    });
  }
});

export default router;