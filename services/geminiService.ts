/**
 * Gemini AI service for DPAL.
 * Client calls a server endpoint, so no API key is shipped to the browser.
 */

import {
  Category,
  NftTheme,
  type Report,
  IntelItem,
  type Hero,
  type TrainingScenario,
  SimulationMode,
  SimulationDifficulty,
  type IntelAnalysis,
  type AiDirective,
  Archetype,
  TacticalIntel,
  MissionApproach,
  MissionGoal,
} from "../types";

import {
  OFFLINE_DIRECTIVES,
  OFFLINE_INTEL,
  OFFLINE_TRAINING,
  OFFLINE_MISSION_TEMPLATES,
} from "./offlineAiData";

const FLASH_TEXT_MODEL = "gemini-1.5-flash";
const IMAGE_GEN_MODEL = "gemini-1.5-flash";

const GEMINI_ENDPOINT = "/api/gemini";

export type AiErrorType = "NOT_CONFIGURED" | "TEMPORARY_FAILURE" | "RATE_LIMITED";

export class AiError extends Error {
  public type: AiErrorType;

  constructor(type: AiErrorType, message: string) {
    super(message);
    this.type = type;
    this.name = "AiError";
  }
}

async function callGemini(params: {
  model: string;
  contents: any;
  config?: any;
}): Promise<{ text: string; raw: any }> {
  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    const msg = String(data?.message || data?.error || "Unknown AI error");

    if (data?.error === "SERVER_KEY_MISSING") {
      throw new AiError("NOT_CONFIGURED", "AI is off. Server key not configured.");
    }
    if (data?.error === "API_KEY_INVALID") {
      throw new AiError("NOT_CONFIGURED", "AI is off. Server key invalid.");
    }
    if (data?.error === "RATE_LIMITED") {
      throw new AiError("RATE_LIMITED", "Rate limited. Try again soon.");
    }

    throw new AiError("TEMPORARY_FAILURE", msg);
  }

  return { text: String(data?.text || ""), raw: data?.response };
}

export async function isAiEnabled(): Promise<boolean> {
  try {
    await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: "ping",
      config: { temperature: 0 },
    });
    return true;
  } catch (e: any) {
    if (e instanceof AiError && e.type === "NOT_CONFIGURED") return false;
    return false;
  }
}

function parseJsonOr<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function extractVisualDescriptors(base64Image: string): Promise<string> {
  const imageData = base64Image.split(",")[1] || base64Image;

  try {
    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageData,
            },
          },
          {
            text:
              "Extract key visual attributes for a uniform character generator. Focus on hair style, hair color, glasses, primary outfit colors. Output JSON with key descriptors as a comma separated string.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    const data = parseJsonOr<{ descriptors?: string }>(text, {});
    return data.descriptors || "standard operative";
  } catch (e) {
    return "standard operative";
  }
}

export async function generateAiDirectives(
  location: string,
  workCategory: Category,
  count: number = 3,
): Promise<AiDirective[]> {
  try {
    const prompt =
      "ACT AS DPAL Tactical Dispatcher. " +
      "TARGET LOCATION " +
      location +
      ". SECTOR " +
      String(workCategory) +
      ". TASK Generate " +
      String(count) +
      " structured directives for field operatives. Return JSON array.";

    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: prompt,
      config: {
        temperature: 0.85,
        responseMimeType: "application/json",
      },
    });

    const items = parseJsonOr<any[]>(text, []);
    return items.map((item: any) => ({
      ...item,
      status: "available",
      timestamp: Date.now(),
      recommendedNextAction: "Escalate to Investigative Mission",
    }));
  } catch (e) {
    return OFFLINE_DIRECTIVES[workCategory] || OFFLINE_DIRECTIVES[Category.Environment];
  }
}

export async function generateMissionFromIntel(
  intel: IntelItem,
  approach: MissionApproach,
  goal: MissionGoal,
): Promise<any> {
  try {
    const prompt =
      "ARCHITECT A MISSION. " +
      "INTEL " +
      JSON.stringify(intel) +
      ". APPROACH " +
      String(approach) +
      ". GOAL " +
      String(goal) +
      ". Generate 5 steps. Each step must include 1 to 3 field prompts. Return JSON.";

    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: prompt,
      config: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    });

    const m = parseJsonOr<any>(text, {});
    return { ...m, approach, goal, category: intel.category, successProbability: 0.9 };
  } catch (e) {
    const template = OFFLINE_MISSION_TEMPLATES[approach];
    return {
      title: "OFFLINE " + intel.title,
      backstory: intel.summary,
      category: intel.category,
      approach,
      goal,
      successProbability: 0.85,
      steps: template.map((t) => ({ ...t, isComplete: false })),
      finalReward: { hc: 200, nft: { name: "Offline Shard", icon: "💾" } },
    };
  }
}

export async function analyzeIntelSource(intel: IntelItem): Promise<IntelAnalysis> {
  try {
    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: "Deep scan " + JSON.stringify(intel),
      config: {
        responseMimeType: "application/json",
      },
    });

    return parseJsonOr<IntelAnalysis>(text, {
      threatScore: 42,
      communityImpact: "Moderate",
      investigativeComplexity: "Low",
      verificationDifficulty: "Simple",
      aiAssessment: "Fallback",
      targetEntity: "LOCAL",
    } as any);
  } catch (e) {
    return {
      threatScore: 42,
      communityImpact: "Moderate",
      investigativeComplexity: "Low",
      verificationDifficulty: "Simple",
      aiAssessment: "Cached Analysis",
      targetEntity: "LOCAL",
    } as any;
  }
}

export async function fetchLiveIntelligence(categories: Category[], location: string): Promise<any> {
  try {
    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: "Accountability incidents in " + location + ". Return JSON list.",
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    return parseJsonOr<any[]>(text, []);
  } catch (e) {
    return OFFLINE_INTEL;
  }
}

export async function generateTrainingScenario(
  hero: Hero,
  mode: SimulationMode,
  category: Category,
  difficulty: SimulationDifficulty,
): Promise<TrainingScenario> {
  try {
    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: "Holodeck sim for " + String(mode) + " in " + String(category) + ". Return JSON.",
      config: {
        responseMimeType: "application/json",
      },
    });

    return parseJsonOr<TrainingScenario>(text, OFFLINE_TRAINING[0]);
  } catch (e) {
    return OFFLINE_TRAINING[0];
  }
}

export async function performIAReview(report: Report): Promise<{ findings: any[]; outcome: string }> {
  try {
    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: "IA review for " + report.title + ". Return JSON.",
      config: {
        responseMimeType: "application/json",
      },
    });

    return parseJsonOr<{ findings: any[]; outcome: string }>(text, {
      findings: [{ id: "1", title: "Offline", value: "Manual check", status: "VERIFIED", hash: "LOCAL" }],
      outcome: "Local Buffer",
    });
  } catch (e) {
    return {
      findings: [{ id: "1", title: "Offline", value: "Manual check", status: "VERIFIED", hash: "LOCAL" }],
      outcome: "Local Buffer",
    };
  }
}

export async function generateNftImage(
  hero: Hero,
  reportContext: any,
  prompt: string,
  theme?: NftTheme,
): Promise<string> {
  try {
    const { raw } = await callGemini({
      model: IMAGE_GEN_MODEL,
      contents: "Artifact " + prompt + ". Theme " + String(theme || "") + ".",
      config: {
        imageConfig: { aspectRatio: "3:4", imageSize: "1K" },
      },
    });

    const parts = raw?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) return "data:image/png;base64," + part.inlineData.data;
    }

    return "https://picsum.photos/seed/" + prompt.substring(0, 5) + "/400/600";
  } catch (e) {
    return "https://picsum.photos/seed/" + prompt.substring(0, 5) + "/400/600";
  }
}

export async function generateNftDetails(description: string): Promise<{ nftTitle: string; nftDescription: string }> {
  try {
    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: "NFT title and description for " + description + ". Return JSON.",
      config: {
        responseMimeType: "application/json",
      },
    });

    return parseJsonOr<{ nftTitle: string; nftDescription: string }>(text, {
      nftTitle: "Heroic Shard",
      nftDescription: "A record",
    });
  } catch (e) {
    return { nftTitle: "Heroic Shard", nftDescription: "A record" };
  }
}

export async function generateNftPromptIdeas(hero: Hero, theme: NftTheme, dpalCategory: Category): Promise<string[]> {
  try {
    const prompt =
      "Generate 3 short phrases, max 5 words each, for an NFT artifact. " +
      "Theme " +
      String(theme) +
      ". Category " +
      String(dpalCategory) +
      ". Role " +
      String(hero.title) +
      ". Return JSON array of strings.";

    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return parseJsonOr<string[]>(text, [
      "Decentralized Oversight Shard",
      "Truth Network Artifact",
      "Community Governance Token",
    ]);
  } catch (e) {
    return ["Decentralized Oversight Shard", "Truth Network Artifact", "Community Governance Token"];
  }
}

export async function generateHeroBackstory(hero: Hero): Promise<string> {
  try {
    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: "Background for " + hero.name + ".",
      config: { temperature: 0.8 },
    });

    return String(text || "").trim() || "Redacted";
  } catch (e) {
    return "Redacted";
  }
}

export async function getMissionTaskAdvice(
  title: string,
  backstory: string,
  name: string,
  task: string,
): Promise<TacticalIntel> {
  try {
    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: "Advice for mission " + title + ", step " + name + ". Return JSON.",
      config: {
        responseMimeType: "application/json",
      },
    });

    return parseJsonOr<TacticalIntel>(text, {
      objective: name,
      threatLevel: "Medium",
      keyInsight: "Offline Analysis",
      protocol: "Default",
    } as any);
  } catch (e) {
    return { objective: name, threatLevel: "Medium", keyInsight: "Offline Analysis", protocol: "Default" } as any;
  }
}

export async function getLiveIntelligenceUpdate(currentState: any): Promise<any> {
  try {
    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: "Co pilot update for " + JSON.stringify(currentState) + ". Return JSON.",
      config: {
        responseMimeType: "application/json",
      },
    });

    return parseJsonOr<any>(text, { ui: { next: "Offline", why: "Unavailable", need: [], risk: "Low", eta: 0, score: 0 }, patch: {} });
  } catch (e) {
    return { ui: { next: "Offline Analysis", why: "Neural link unconfigured", need: [], risk: "Low", eta: 0, score: 0 }, patch: {} };
  }
}

export async function generateHeroPersonaDetails(prompt: string, arch: Archetype): Promise<any> {
  try {
    const { text } = await callGemini({
      model: FLASH_TEXT_MODEL,
      contents: "Persona details for " + String(arch) + ". " + prompt + ". Return JSON.",
      config: {
        responseMimeType: "application/json",
      },
    });

    return parseJsonOr<any>(text, { name: "Agent Shadow", backstory: "Local node operative", combatStyle: "Tactical" });
  } catch (e) {
    return { name: "Agent Shadow", backstory: "Local node operative", combatStyle: "Tactical" };
  }
}

export async function generateHeroPersonaImage(
  visualDescriptors: string,
  arch: Archetype,
  prop: string = "tablet",
  stance: string = "calm",
): Promise<string> {
  try {
    const stanceTokens =
      stance === "alert" ? "alert upright posture" : stance === "thoughtful" ? "reflective posture with head tilted" : "relaxed calm posture";

    const propTokens =
      prop === "clipboard"
        ? "holding a digital clipboard"
        : prop === "camera"
        ? "holding a small tactical body cam"
        : "holding a holographic data tablet";

    const template =
      "Uniform hero portrait, full body, standing upright, facing camera, slight three quarter angle. " +
      "Stance " +
      stanceTokens +
      ". Expression neutral confident. Equipment " +
      propTokens +
      ". Clothing modern civic responder style, no weapons, no police uniform, no military gear. " +
      "Visual identity " +
      visualDescriptors +
      ". Background dark neutral gradient with subtle cyan grid. Digital painting, high detail, no text.";

    const { raw } = await callGemini({
      model: IMAGE_GEN_MODEL,
      contents: template,
      config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
    });

    const parts = raw?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) return "data:image/png;base64," + part.inlineData.data;
    }

    return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + String(Date.now());
  } catch (e) {
    return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + String(Date.now());
  }
}

export async function formatTranscript(text: string): Promise<string> {
  return text;
}
