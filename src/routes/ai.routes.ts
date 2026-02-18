import { Router, type Request, type Response } from "express";
import { runGemini } from "../services/gemini.service.js";

console.log("runGemini is:", typeof runGemini);
const router = Router();

type OpsStatus = "New" | "Investigating" | "Action Taken" | "Resolved";

type TriageResult = {
  severitySuggested: "Low" | "Moderate" | "High";
  routeTo: string;
  slaHours: number;
  rationale: string;
  nextActions: Array<{ label: string; status: OpsStatus; note: string }>;
};

function heuristicTriage(input: {
  title?: string;
  summary?: string;
  severity?: string;
  category?: string;
  tenantType?: string;
}): TriageResult {
  const text = `${input.title || ""} ${input.summary || ""} ${input.category || ""}`.toLowerCase();

  let severitySuggested: TriageResult["severitySuggested"] = "Moderate";
  if (/critical|urgent|hazard|threat|illegal|severe|violence|fire|outage|medical/.test(text)) severitySuggested = "High";
  if (/minor|information|question|low risk/.test(text)) severitySuggested = "Low";

  const routeByTenant: Record<string, string> = {
    city: "City Operations Desk",
    county: "County Response Unit",
    state: "State Oversight Desk",
    hospital: "Clinical Risk Team",
    school: "Student Safety Team",
  };

  const tenantKey = String(input.tenantType || "").toLowerCase();
  const routeTo =
    Object.entries(routeByTenant).find(([k]) => tenantKey.includes(k))?.[1] ||
    (severitySuggested === "High" ? "Rapid Response Team" : "Operations Desk");

  const slaHours = severitySuggested === "High" ? 2 : severitySuggested === "Moderate" ? 8 : 24;

  return {
    severitySuggested,
    routeTo,
    slaHours,
    rationale:
      severitySuggested === "High"
        ? "Detected high-risk language and urgency indicators; immediate triage and assignment recommended."
        : "Standard risk profile based on available report details and category context.",
    nextActions: [
      {
        label: `Assign to ${routeTo}`,
        status: "Investigating",
        note: `AI triage recommends routing to ${routeTo}.`,
      },
      {
        label: "Request supporting evidence",
        status: "Action Taken",
        note: "Request additional documents/media and confirm timeline details.",
      },
      {
        label: "Set follow-up and resolve when complete",
        status: "Resolved",
        note: "Close only after verification checklist and final note are completed.",
      },
    ],
  };
}

function overlapScore(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3));
  const tb = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3));
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
  return overlap / Math.max(ta.size, tb.size);
}

/**
 * GET /api/ai/health
 * Light check by default (fast, no model call).
 * Deep check when ?deep=1 (pings Gemini).
 */
router.get("/health", async (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);

  // Light mode: confirm server + env is wired (no external call)
  if (req.query.deep !== "1") {
    return res.status(200).json({
      ok: true,
      service: "ai",
      mode: "light",
      provider: "gemini",
      hasKey,
      model: process.env.GEMINI_MODEL || "unknown",
      ts: Date.now(),
    });
  }

  // Deep mode: actually call Gemini with a tiny prompt
  if (!hasKey) {
    return res.status(200).json({
      ok: false,
      service: "ai",
      mode: "deep",
      provider: "gemini",
      hasKey: false,
      error: "missing_GEMINI_API_KEY",
      ts: Date.now(),
    });
  }

  try {
    const sample = await runGemini("ping");
    return res.status(200).json({
      ok: true,
      service: "ai",
      mode: "deep",
      provider: "gemini",
      hasKey: true,
      model: process.env.GEMINI_MODEL || "unknown",
      sample: String(sample || "").slice(0, 80),
      ts: Date.now(),
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      service: "ai",
      mode: "deep",
      provider: "gemini",
      hasKey: true,
      error: "gemini_call_failed",
      details: String(err?.message || err),
      ts: Date.now(),
    });
  }
});

/**
 * POST /api/ai/ask
 * Body: { prompt: string }
 */
router.post("/ask", async (req, res) => {
  try {
    const { prompt, tier, model } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt required" });
    }

    const modelFromTier =
      tier === "cheap"
        ? String(process.env.GEMINI_MODEL_CHEAP || "gemini-1.5-flash").trim()
        : undefined;

    const answer = await runGemini(prompt, typeof model === "string" ? model : modelFromTier);
    return res.json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI failure" });
  }
});

router.post("/triage", async (req: Request, res: Response) => {
  try {
    const report = req.body?.report || {};
    const fallback = heuristicTriage({
      title: report?.title,
      summary: report?.summary,
      severity: report?.severity,
      category: req.body?.category,
      tenantType: req.body?.tenantType,
    });

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ ok: true, provider: "heuristic", triage: fallback });
    }

    const prompt = `You are an operations triage assistant. Return ONLY valid JSON with this exact shape:
{"severitySuggested":"Low|Moderate|High","routeTo":"string","slaHours":number,"rationale":"string","nextActions":[{"label":"string","status":"New|Investigating|Action Taken|Resolved","note":"string"}]}

Tenant type: ${String(req.body?.tenantType || "")}
Tenant name: ${String(req.body?.tenantName || "")}
Category: ${String(req.body?.category || "")}
Report title: ${String(report?.title || "")}
Report summary: ${String(report?.summary || "")}
Report severity: ${String(report?.severity || "")}
Report location: ${String(report?.location || "")}`;

    const raw = await runGemini(prompt, String(process.env.GEMINI_MODEL_CHEAP || "gemini-1.5-flash").trim());
    const text = String(raw || "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed) {
      return res.json({ ok: true, provider: "heuristic_fallback", triage: fallback });
    }

    return res.json({ ok: true, provider: "gemini", triage: { ...fallback, ...parsed } });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: "triage_failed", message: String(error?.message || error) });
  }
});

router.post("/similar-cases", async (req: Request, res: Response) => {
  try {
    const report = req.body?.report || {};
    const candidates = Array.isArray(req.body?.candidates) ? req.body.candidates : [];

    const basis = `${String(report?.title || "")} ${String(report?.summary || "")} ${String(report?.location || "")}`;
    const scored = candidates
      .map((c: any) => {
        const text = `${String(c?.title || "")} ${String(c?.summary || "")} ${String(c?.location || "")}`;
        const score = overlapScore(basis, text) + (String(c?.severity || "") === String(report?.severity || "") ? 0.2 : 0);
        return {
          id: String(c?.id || c?.reportId || ""),
          title: String(c?.title || "Untitled"),
          severity: String(c?.severity || "Moderate"),
          score: Number(score.toFixed(3)),
        };
      })
      .filter((x: any) => x.id)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5);

    return res.json({ ok: true, similar: scored });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: "similar_failed", message: String(error?.message || error) });
  }
});

export default router;
