/**
 * DPAL Global Signals Service
 *
 * Ingests public data feeds (USGS, NASA EONET, OpenAQ, GDACS-style) and
 * normalises them into GlobalSignal documents. Optionally enriches each
 * signal with an AI-generated summary and mission suggestion using the
 * existing Gemini provider.
 *
 * All sources are free / open — no API keys required.
 */

import crypto from "crypto";
import { GlobalSignal, type SignalCategory, type RiskLevel } from "../models/GlobalSignal.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return `GSIG-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function eqRisk(mag: number): RiskLevel {
  if (mag >= 7.0) return "critical";
  if (mag >= 6.0) return "high";
  if (mag >= 5.0) return "moderate";
  return "low";
}

function eonetCategory(cat: string): SignalCategory {
  const c = cat.toLowerCase();
  if (c.includes("wildfire") || c.includes("fire")) return "fire_smoke";
  if (c.includes("volcano")) return "environmental_hazard";
  if (c.includes("tropical") || c.includes("storm") || c.includes("cyclone")) return "climate_risk";
  if (c.includes("flood")) return "environmental_hazard";
  if (c.includes("drought")) return "climate_risk";
  return "environmental_hazard";
}

function eonetRisk(cat: string): RiskLevel {
  const c = cat.toLowerCase();
  if (c.includes("wildfire") || c.includes("volcano")) return "high";
  if (c.includes("tropical") || c.includes("cyclone")) return "high";
  if (c.includes("flood")) return "moderate";
  return "low";
}

/** Reverse-geocode country from coords using Nominatim (best-effort, no key). */
async function reverseGeocode(lat: number, lng: number): Promise<{ city?: string; country?: string }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DPAL-GlobalSignals/1.0" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return {};
    const j = await res.json() as { address?: { city?: string; state?: string; country?: string; town?: string; village?: string } };
    return {
      city: j.address?.city ?? j.address?.town ?? j.address?.village ?? j.address?.state,
      country: j.address?.country,
    };
  } catch {
    return {};
  }
}

// ── USGS Earthquake ingestion ─────────────────────────────────────────────────

interface UsgsFeature {
  id: string;
  properties: { title: string; place: string; mag: number; time: number; url: string; alert?: string | null };
  geometry: { coordinates: [number, number, number] };
}

export async function ingestUsgsEarthquakes(): Promise<number> {
  const res = await fetch(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson",
    { signal: AbortSignal.timeout(14_000) }
  );
  if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
  const json = await res.json() as { features: UsgsFeature[] };

  let inserted = 0;
  for (const f of json.features.slice(0, 80)) {
    const existing = await GlobalSignal.findOne({ sourceSignalId: f.id });
    if (existing) continue;

    const mag = f.properties.mag ?? 0;
    const [lng, lat] = [f.geometry.coordinates[0], f.geometry.coordinates[1]];
    const geo = await reverseGeocode(lat, lng);

    await GlobalSignal.create({
      signalId: uid(),
      title: f.properties.title,
      description: `Earthquake of magnitude ${mag} detected ${f.properties.place}. Depth: ${f.geometry.coordinates[2].toFixed(0)} km.`,
      category: "environmental_hazard",
      sourceName: "USGS Earthquake Hazards",
      sourceUrl: f.properties.url,
      latitude: lat,
      longitude: lng,
      city: geo.city,
      country: geo.country,
      riskLevel: eqRisk(mag),
      confidenceScore: 0.95,
      status: "new",
      sourceSignalId: f.id,
      rawData: { mag, place: f.properties.place, depth: f.geometry.coordinates[2], alert: f.properties.alert },
    });
    inserted++;
  }
  console.log(`🌍 USGS ingestion: +${inserted} new earthquake signals`);
  return inserted;
}

// ── NASA EONET ingestion ──────────────────────────────────────────────────────

interface EonetEvent {
  id: string;
  title: string;
  categories: { id: string; title: string }[];
  sources: { id: string; url: string }[];
  geometry: { date: string; type: string; coordinates: number[] | number[][] }[];
}

export async function ingestEonetEvents(): Promise<number> {
  const res = await fetch(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7&limit=60",
    { signal: AbortSignal.timeout(14_000) }
  );
  if (!res.ok) throw new Error(`EONET HTTP ${res.status}`);
  const json = await res.json() as { events: EonetEvent[] };

  let inserted = 0;
  for (const ev of json.events) {
    const existing = await GlobalSignal.findOne({ sourceSignalId: `eonet-${ev.id}` });
    if (existing) continue;

    const cat = ev.categories[0]?.title ?? "Other";
    const geo = ev.geometry[ev.geometry.length - 1];
    let lat: number | undefined, lng: number | undefined;
    if (geo) {
      const c = geo.coordinates;
      if (typeof c[0] === "number") { lng = c[0] as number; lat = c[1] as number; }
    }

    const geoName = lat != null && lng != null ? await reverseGeocode(lat, lng) : {};

    await GlobalSignal.create({
      signalId: uid(),
      title: ev.title,
      description: `Active ${cat} event detected by NASA EONET satellite observation.`,
      category: eonetCategory(cat),
      sourceName: "NASA EONET",
      sourceUrl: ev.sources[0]?.url,
      latitude: lat,
      longitude: lng,
      city: geoName.city,
      country: geoName.country,
      riskLevel: eonetRisk(cat),
      confidenceScore: 0.88,
      status: "new",
      sourceSignalId: `eonet-${ev.id}`,
      rawData: { category: cat, geometry: geo },
    });
    inserted++;
  }
  console.log(`🛰️  EONET ingestion: +${inserted} new natural event signals`);
  return inserted;
}

// ── OpenAQ air quality ingestion ──────────────────────────────────────────────

interface AqObservation {
  location: string;
  city?: string;
  country: string;
  coordinates?: { latitude: number; longitude: number };
  measurements: { parameter: string; value: number; unit: string }[];
}

export async function ingestOpenAQ(): Promise<number> {
  // Fetch PM2.5 readings > 75 µg/m³ (WHO unhealthy threshold)
  const url =
    "https://api.openaq.org/v2/measurements?parameter=pm25&value_from=75&limit=50&order_by=value&sort=desc";
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return 0;
  } catch { return 0; }

  const json = await res.json() as { results?: AqObservation[] };
  if (!json.results?.length) return 0;

  let inserted = 0;
  for (const obs of json.results.slice(0, 20)) {
    const pm25 = obs.measurements.find((m) => m.parameter === "pm25")?.value ?? 0;
    const sigId = `aq-${obs.country}-${obs.location}-${Math.floor(Date.now() / 3_600_000)}`;
    const existing = await GlobalSignal.findOne({ sourceSignalId: sigId });
    if (existing) continue;

    const risk: RiskLevel = pm25 > 250 ? "critical" : pm25 > 150 ? "high" : pm25 > 75 ? "moderate" : "low";

    await GlobalSignal.create({
      signalId: uid(),
      title: `Elevated PM2.5 — ${obs.city || obs.location}, ${obs.country}`,
      description: `PM2.5 reading of ${pm25.toFixed(1)} µg/m³ at ${obs.location}. WHO unhealthy threshold is 75 µg/m³.`,
      category: "pollution",
      sourceName: "OpenAQ",
      sourceUrl: "https://openaq.org",
      latitude: obs.coordinates?.latitude,
      longitude: obs.coordinates?.longitude,
      city: obs.city ?? obs.location,
      country: obs.country,
      riskLevel: risk,
      confidenceScore: 0.82,
      status: "new",
      sourceSignalId: sigId,
      rawData: { pm25, location: obs.location },
    });
    inserted++;
  }
  console.log(`🌫️  OpenAQ ingestion: +${inserted} air quality signals`);
  return inserted;
}

// ── AI enrichment ─────────────────────────────────────────────────────────────

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

export async function enrichSignalWithAI(signalId: string): Promise<void> {
  const signal = await GlobalSignal.findOne({ signalId });
  if (!signal || signal.aiSummary) return;

  const key = process.env.GEMINI_API_KEY;
  if (!key) return; // AI not configured — skip silently

  const prompt = `You are a DPAL community intelligence analyst. A new environmental signal has been detected.

Signal:
- Title: ${signal.title}
- Category: ${signal.category.replace(/_/g, " ")}
- Location: ${[signal.city, signal.country].filter(Boolean).join(", ") || "Unknown"}
- Risk Level: ${signal.riskLevel}
- Description: ${signal.description}

Generate a concise JSON response:
{
  "aiSummary": "2-sentence plain-language summary of the situation and why it matters to local communities",
  "suggestedMissionTitle": "Short mission title e.g. Verify fire conditions near [location]",
  "suggestedMissionDescription": "1-2 sentences describing what a community verifier should do, what evidence to collect"
}

Return ONLY valid JSON.`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 400 },
      }),
    });
    if (!res.ok) return;
    const json = await res.json() as { candidates?: { content: { parts: { text: string }[] } }[] };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;
    const parsed = JSON.parse(match[0]) as { aiSummary?: string; suggestedMissionTitle?: string; suggestedMissionDescription?: string };
    await GlobalSignal.updateOne({ signalId }, {
      $set: {
        aiSummary: parsed.aiSummary,
        suggestedMissionTitle: parsed.suggestedMissionTitle,
        suggestedMissionDescription: parsed.suggestedMissionDescription,
      },
    });
  } catch (err) {
    console.warn(`AI enrichment failed for ${signalId}:`, err instanceof Error ? err.message : err);
  }
}

// ── Full import run ───────────────────────────────────────────────────────────

export async function runFullSignalImport(): Promise<{ usgs: number; eonet: number; aq: number; total: number }> {
  const [usgs, eonet, aq] = await Promise.all([
    ingestUsgsEarthquakes().catch(() => 0),
    ingestEonetEvents().catch(() => 0),
    ingestOpenAQ().catch(() => 0),
  ]);
  const total = usgs + eonet + aq;
  console.log(`✅ Global Signals import complete — ${total} new signals (USGS:${usgs} EONET:${eonet} AQ:${aq})`);
  return { usgs, eonet, aq, total };
}
