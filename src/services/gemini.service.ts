/**
 * @file Gemini AI Service
 * Handles all interactions with Google Gemini API for text and image generation.
 * Uses Node 18+ global fetch (no node-fetch dependency needed on Railway).
 */

// ============================================================================
// Configuration & Types
// ============================================================================

const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type GeneratePersonaImageInput = {
  description: string;
  archetype: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates that the Gemini API key is configured
 */
function ensureApiKey(): void {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }
}

/**
 * Extracts error message from Gemini API response
 */
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    const json = JSON.parse(text);
    return json?.error?.message || json?.error || text || "Unknown error";
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
}

// ============================================================================
// Image Generation
// ============================================================================

/**
 * Generates a PNG image using Gemini's image generation model.
 * 
 * @param input - Object containing description and archetype for the image
 * @returns Promise resolving to a Buffer containing the PNG image data
 * @throws Error if API key is missing, API call fails, or no image data is returned
 * 
 * @example
 * const imageBuffer = await generatePersonaImagePng({
 *   description: "A cyberpunk operative",
 *   archetype: "Shadow"
 * });
 */
export async function generatePersonaImagePng(
  input: GeneratePersonaImageInput
): Promise<Buffer> {
  ensureApiKey();

  const model = String(
    process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview"
  ).trim();
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent`;

  // Construct the prompt with style instructions
  const prompt = [
    input.description,
    `Archetype: ${input.archetype}`,
    "Output: PNG image.",
    "Style: clean vector portrait, centered subject, simple background, 1:1.",
  ].join("\n");

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorMsg = await extractErrorMessage(response);
      throw new Error(`Gemini image generation failed: ${errorMsg}`);
    }

    const json = await response.json() as GeminiResponse;
    const candidates = json?.candidates || [];
    
    if (candidates.length === 0) {
      throw new Error("Gemini returned no candidates in response");
    }

    const parts = candidates[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p?.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      throw new Error("Gemini returned no inline image data in response");
    }

    const base64Data = String(imagePart.inlineData.data);
    return Buffer.from(base64Data, "base64");
  } catch (error: any) {
    // Re-throw with context if it's already our error
    if (error.message?.includes("Gemini") || error.message?.includes("GEMINI")) {
      throw error;
    }
    // Wrap unexpected errors
    throw new Error(`Failed to generate persona image: ${error?.message || String(error)}`);
  }
}

// ============================================================================
// Text Generation
// ============================================================================

/**
 * Generates text content using Gemini's text generation model.
 * 
 * @param prompt - The text prompt to send to Gemini
 * @returns Promise resolving to the generated text response
 * @returns Placeholder string if API key is not configured or on error
 * 
 * @example
 * const response = await runGemini("Generate a hero backstory");
 */
export async function runGemini(prompt: string): Promise<string> {
  // Graceful degradation: return placeholder if API key is missing
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY not configured, returning placeholder");
    return `Gemini placeholder: ${prompt} (API key not configured)`;
  }

  const model = String(
    process.env.GEMINI_MODEL || "gemini-3-flash-preview"
  ).trim();
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errorMsg = await extractErrorMessage(response);
      console.error(`❌ Gemini API error (${response.status}):`, errorMsg);
      return `Gemini placeholder: ${prompt}`;
    }

    const json = await response.json() as GeminiResponse;
    const candidates = json?.candidates || [];
    
    if (candidates.length === 0) {
      console.warn("⚠️ Gemini returned no candidates");
      return `Gemini placeholder: ${prompt}`;
    }

    const parts = candidates[0]?.content?.parts || [];
    const textPart = parts.find((p) => p?.text);

    if (!textPart?.text) {
      console.warn("⚠️ Gemini returned no text in response");
      return `Gemini placeholder: ${prompt}`;
    }

    return textPart.text;
  } catch (error: any) {
    console.error("❌ Gemini API request failed:", error?.message || error);
    return `Gemini placeholder: ${prompt}`;
  }
}