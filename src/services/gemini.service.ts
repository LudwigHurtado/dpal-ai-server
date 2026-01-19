import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export async function runGemini(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: MODEL });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return text || "";
}
