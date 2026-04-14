/**
 * DPAL Disaster Intelligence — Real-time global alert feed
 *
 * Sources (all free, no API keys required):
 *   - USGS Earthquake Hazards Program  (GeoJSON, M4.5+ past 7 days)
 *   - NASA EONET Natural Events API v3 (JSON, open events past 7 days)
 *
 * GET /api/disasters/feed         — unified event list, sorted by recency
 * GET /api/disasters/feed?type=earthquake|wildfire|volcano|storm|flood|sea_and_lake_ice|other
 *                                 — filter by event type
 *
 * Responses are cached in-process for 90 seconds to avoid hammering upstream APIs.
 */

import { Router, type Request, type Response } from "express";

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DisasterEvent {
  id: string;
  source: "usgs" | "eonet";
  type: "earthquake" | "wildfire" | "volcano" | "storm" | "flood" | "sea_and_lake_ice" | "other";
  title: string;
  place: string;
  severity: "low" | "moderate" | "high" | "critical";
  mag?: number;         // earthquake magnitude
  depth?: number;       // km below surface (earthquakes)
  alertLevel?: string;  // USGS PAGER alert color
  lat?: number;
  lng?: number;
  time: number;         // Unix ms
  url?: string;
  category?: string;    // raw EONET category label
}

// ── In-process cache (90 s TTL) ───────────────────────────────────────────────

interface CacheEntry { data: DisasterEvent[]; ts: number }
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 90_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function eqSeverity(mag: number): DisasterEvent["severity"] {
  if (mag >= 7.0) return "critical";
  if (mag >= 6.0) return "high";
  if (mag >= 5.0) return "moderate";
  return "low";
}

function eonetCategoryToType(category: string): DisasterEvent["type"] {
  const c = category.toLowerCase();
  if (c.includes("wildfire") || c.includes("fire"))   return "wildfire";
  if (c.includes("volcano"))                           return "volcano";
  if (c.includes("tropical") || c.includes("storm") || c.includes("cyclone")) return "storm";
  if (c.includes("flood"))                             return "flood";
  if (c.includes("sea") || c.includes("ice"))         return "sea_and_lake_ice";
  return "other";
}

function eonetSeverity(category: string): DisasterEvent["severity"] {
  const t = eonetCategoryToType(category);
  if (t === "volcano" || t === "wildfire") return "high";
  if (t === "storm")                       return "moderate";
  return "low";
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchUsgs(): Promise<DisasterEvent[]> {
  const res = await fetch(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson",
    { signal: AbortSignal.timeout(12_000) }
  );
  if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
  const json = (await res.json()) as {
    features: {
      id: string;
      properties: {
        title: string;
        place: string;
        mag: number;
        time: number;
        url: string;
        alert?: string | null;
        depth?: number;
      };
      geometry: { coordinates: [number, number, number] };
    }[];
  };

  return json.features.map((f) => ({
    id:         `usgs-${f.id}`,
    source:     "usgs",
    type:       "earthquake",
    title:      f.properties.title,
    place:      f.properties.place,
    severity:   eqSeverity(f.properties.mag ?? 0),
    mag:        f.properties.mag,
    depth:      f.geometry.coordinates[2],
    alertLevel: f.properties.alert ?? undefined,
    lat:        f.geometry.coordinates[1],
    lng:        f.geometry.coordinates[0],
    time:       f.properties.time,
    url:        f.properties.url,
  }));
}

async function fetchEonet(): Promise<DisasterEvent[]> {
  const res = await fetch(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7&limit=60",
    { signal: AbortSignal.timeout(12_000) }
  );
  if (!res.ok) throw new Error(`EONET HTTP ${res.status}`);
  const json = (await res.json()) as {
    events: {
      id: string;
      title: string;
      categories: { id: string; title: string }[];
      sources: { id: string; url: string }[];
      geometry: { date: string; type: string; coordinates: number[] | number[][] }[];
    }[];
  };

  const events: DisasterEvent[] = [];

  for (const ev of json.events) {
    const cat = ev.categories[0]?.title ?? "Other";
    const type = eonetCategoryToType(cat);
    const geo = ev.geometry[ev.geometry.length - 1]; // most recent geometry
    let lat: number | undefined;
    let lng: number | undefined;

    if (geo) {
      const coords = geo.coordinates;
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        lng = coords[0] as number;
        lat = coords[1] as number;
      }
    }

    const ts = geo?.date ? new Date(geo.date).getTime() : Date.now();

    events.push({
      id:       `eonet-${ev.id}`,
      source:   "eonet",
      type,
      title:    ev.title,
      place:    ev.title,
      severity: eonetSeverity(cat),
      lat,
      lng,
      time:     ts,
      url:      ev.sources[0]?.url,
      category: cat,
    });
  }

  return events;
}

// ── Route ─────────────────────────────────────────────────────────────────────

// GET /api/disasters/feed
router.get("/feed", async (req: Request, res: Response) => {
  try {
    const now = Date.now();

    // Serve from cache if fresh
    if (cache && now - cache.ts < CACHE_TTL_MS) {
      let events = cache.data;
      if (req.query.type) {
        events = events.filter((e) => e.type === req.query.type);
      }
      return res.json({ ok: true, cached: true, count: events.length, events });
    }

    // Fetch both sources in parallel; swallow individual failures
    const [usgsEvents, eonetEvents] = await Promise.all([
      fetchUsgs().catch((err) => {
        console.warn("⚠️  USGS fetch failed:", err instanceof Error ? err.message : err);
        return [] as DisasterEvent[];
      }),
      fetchEonet().catch((err) => {
        console.warn("⚠️  EONET fetch failed:", err instanceof Error ? err.message : err);
        return [] as DisasterEvent[];
      }),
    ]);

    // Merge & sort newest-first; cap at 150
    const all = [...usgsEvents, ...eonetEvents]
      .sort((a, b) => b.time - a.time)
      .slice(0, 150);

    cache = { data: all, ts: now };

    console.log(`🌍 Disaster feed: ${usgsEvents.length} earthquakes + ${eonetEvents.length} EONET events`);

    let events = all;
    if (req.query.type) {
      events = events.filter((e) => e.type === req.query.type);
    }

    return res.json({ ok: true, cached: false, count: events.length, events });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
