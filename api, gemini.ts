import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

type ReqBody = {
  model: string;
  contents: any;
  config?: any;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "SERVER_KEY_MISSING" });
      return;
    }

    const body = (req.body || {}) as ReqBody;
    const model = body.model || "gemini-1.5-flash";

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: body.contents,
      config: body.config,
    });

    res.status(200).json({
      text: response.text || "",
      response,
    });
  } catch (err: any) {
    const msg = String(err?.message || err || "");
    const code =
      msg.includes("API_KEY_INVALID") || msg.includes("permission")
        ? "API_KEY_INVALID"
        : msg.includes("429") || msg.toLowerCase().includes("quota")
        ? "RATE_LIMITED"
        : "UPSTREAM_ERROR";

    res.status(500).json({ error: code, message: msg });
  }
}
