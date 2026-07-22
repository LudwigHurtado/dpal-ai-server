import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import type {
  ReedyRiverAiNarrative,
  ReedyRiverReportDraft,
  ReedyRiverSourceType,
} from "../features/reedyRiver/reedyRiver.types.js";
import { SOURCE_STATES } from "./reedyRiver.service.shared.js";

export function unavailableSourceMessages(): Partial<Record<ReedyRiverSourceType, string>> {
  const out: Partial<Record<ReedyRiverSourceType, string>> = {};
  for (const [sourceType, status] of SOURCE_STATES.entries()) {
    if (status.state === "unavailable") out[sourceType] = status.message;
  }
  return out;
}

export function deterministicNarrative(draft: ReedyRiverReportDraft, error?: string): ReedyRiverAiNarrative {
  const highPriority = draft.findings.filter((finding) => ["high", "critical"].includes(finding.severity));
  return {
    used: false,
    provider: "deterministic",
    generatedAt: new Date().toISOString(),
    executiveSummary: draft.deterministicSummary,
    operatingNotes: [
      highPriority.length
        ? `${highPriority.length} high-priority evidence finding(s) require review.`
        : "No high-priority deterministic finding was produced in this window.",
      `${draft.actionDrafts.length} workflow action(s) were generated from the evidence rules.`,
      "Machine candidates remain separated from expert-confirmed records.",
    ],
    error,
  };
}

function stripCodeFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function safeNarrativeText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.trim().slice(0, max) : "";
  if (/[-+]?\d{1,3}\.\d{3,}\s*,\s*[-+]?\d{1,3}\.\d{3,}/.test(text)) {
    throw new Error("AI narrative contained exact coordinates");
  }
  return text;
}

export async function generateAiNarrative(draft: ReedyRiverReportDraft): Promise<ReedyRiverAiNarrative> {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return deterministicNarrative(draft, "GEMINI_API_KEY is not configured");
  const model = String(process.env.REEDY_RIVER_GEMINI_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
  const evidenceEnvelope = {
    windowStart: draft.windowStart,
    windowEnd: draft.windowEnd,
    status: draft.status,
    metrics: draft.metrics,
    sourceStatus: draft.sourceStatus.map((source) => ({
      sourceType: source.sourceType,
      state: source.state,
      recordCount: source.recordCount,
      freshnessMinutes: source.freshnessMinutes,
      message: source.message,
    })),
    findings: draft.findings.map((finding) => ({
      category: finding.category,
      state: finding.state,
      severity: finding.severity,
      title: finding.title,
      summary: finding.summary,
      siteCount: finding.siteIds.length,
      evidenceCount: finding.evidenceObservationIds.length,
      limitations: finding.limitations,
    })),
    actions: draft.actionDrafts.map((action) => ({
      title: action.title,
      priority: action.priority,
      ownerRole: action.ownerRole,
      nextStep: action.nextStep,
      approvalRequired: action.approvalRequired,
      safeToExecute: action.safeToExecute,
    })),
    projectRecommendations: draft.projectRecommendations.map((recommendation) => ({
      title: recommendation.title,
      recommendationType: recommendation.recommendationType,
      evidenceGate: recommendation.evidenceGate,
      rationale: recommendation.rationale,
      evidenceCount: recommendation.evidenceObservationIds.length,
      requiresExpertApproval: recommendation.requiresExpertApproval,
      implementationStatus: recommendation.implementationStatus,
      nextDecision: recommendation.nextDecision,
    })),
    deterministicSummary: draft.deterministicSummary,
  };
  const prompt = [
    "You are the DPAL Reedy River operations briefing assistant.",
    "Return JSON only with executiveSummary (string) and operatingNotes (array of 2-5 strings).",
    "Use only the supplied deterministic evidence. Do not add a species, site, threshold exceedance, cause, violation, project, or action.",
    "Never convert a machine candidate into a confirmation. Never imply regulatory compliance or noncompliance.",
    "Do not include coordinates, people names, contact details, URLs, or restricted evidence locations.",
    "Clearly identify data gaps and approval gates. Keep the executive summary under 900 characters.",
    JSON.stringify(evidenceEnvelope),
  ].join("\n");
  const promptHash = crypto.createHash("sha256").update(prompt, "utf8").digest("hex");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.1 },
    } as any);
    const parsed = JSON.parse(stripCodeFence(String(response.text || ""))) as Record<string, unknown>;
    const executiveSummary = safeNarrativeText(parsed.executiveSummary, 900);
    const operatingNotes = Array.isArray(parsed.operatingNotes)
      ? parsed.operatingNotes.map((item) => safeNarrativeText(item, 350)).filter(Boolean).slice(0, 5)
      : [];
    if (!executiveSummary || operatingNotes.length < 2) throw new Error("AI response did not match the required schema");
    return {
      used: true,
      provider: "gemini",
      model,
      generatedAt: new Date().toISOString(),
      executiveSummary,
      operatingNotes,
      promptHash,
    };
  } catch (error: unknown) {
    return deterministicNarrative(draft, error instanceof Error ? error.message : String(error));
  }
}
