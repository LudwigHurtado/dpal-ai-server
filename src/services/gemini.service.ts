// src/services/gemini.service.ts
// Node 18+ has global fetch. Do not use node-fetch on Railway unless you must.

const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();

type GeneratePersonaImageInput = {
  description: string;
  archetype: string;
};

export type { GeneratePersonaImageInput };

export async function generatePersonaImagePng(
  input: GeneratePersonaImageInput
): Promise<Buffer> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");

  const model = String(process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview").trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const prompt =
    `${input.description}\n` +
    `Archetype: ${input.archetype}\n` +
    `Output: PNG image.\n` +
    `Style: clean vector portrait, centered subject, simple background, 1:1.`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini image failed: ${text}`);
  }

  const json: any = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p: any) => p?.inlineData?.data);

  if (!imgPart?.inlineData?.data) {
    throw new Error("Gemini returned no inline image data");
  }

  return Buffer.from(String(imgPart.inlineData.data), "base64");
}

// ✅ TEMP STUB to unblock build (replace body with real Gemini call later)
export async function runGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    return `Gemini placeholder: ${prompt} (API key not configured)`;
  }

  const model = String(process.env.GEMINI_MODEL || "gemini-3-flash-preview").trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API failed: ${text}`);
    }

    const json: any = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text || `Gemini placeholder: ${prompt}`;
  } catch (error: any) {
    console.error("Gemini API error:", error);
    return `Gemini placeholder: ${prompt}`;
  }
}