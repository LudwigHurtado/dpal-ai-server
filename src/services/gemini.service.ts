import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);

export async function runGemini(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.0-pro"
  });

  const result = await model.generateContent(prompt);
  const response = result.response;

  return response.text();
}

