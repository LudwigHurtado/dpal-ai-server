import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);

export async function runGemini(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "models/gemini-1.5-pro"
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}
