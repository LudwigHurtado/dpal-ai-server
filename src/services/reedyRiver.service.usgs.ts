import {
  type ReedyRiverObservationInput,
} from "../features/reedyRiver/reedyRiver.types.js";
import { ingestReedyRiverObservations } from "./reedyRiver.service.observations.js";
import {
  SOURCE_STATES,
  boolEnv,
  dateIso,
  intEnv,
  stableId,
} from "./reedyRiver.service.shared.js";

interface UsgsFeature {
  id?: string;
  geometry?: { coordinates?: unknown[] };
  properties?: Record<string, unknown>;
}

const DEFAULT_USGS_STATIONS = ["USGS-02164000", "USGS-02164110", "USGS-021650905"];
const USGS_LABELS: Record<string, string> = {
  "USGS-02164000": "Reedy River near Greenville, South Carolina",
  "USGS-02164110": "Reedy River above Fork Shoals, South Carolina",
  "USGS-021650905": "Reedy River near Waterloo, South Carolina",
};

function usgsParameterName(code: string): string {
  const labels: Record<string, string> = {
    "00060": "Discharge",
    "00065": "Gage height",
    "00010": "Water temperature",
    "00095": "Specific conductance",
    "00300": "Dissolved oxygen",
    "00400": "pH",
  };
  return labels[code] || `USGS parameter ${code}`;
}

function normalizeStationId(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return "";
  return trimmed.startsWith("USGS-") ? trimmed : `USGS-${trimmed}`;
}

function configuredStationIds(): string[] {
  const multi = String(process.env.REEDY_RIVER_USGS_STATION_IDS || "")
    .split(",")
    .map(normalizeStationId)
    .filter(Boolean);
  if (multi.length) return [...new Set(multi)].slice(0, 20);
  const legacySingle = normalizeStationId(String(process.env.REEDY_RIVER_USGS_STATION_ID || ""));
  return legacySingle ? [legacySingle] : DEFAULT_USGS_STATIONS;
}

export async function pollUsgsReedyRiver(): Promise<{
  ok: boolean;
  stationIds: string[];
  records: number;
  inserted: number;
  message: string;
}> {
  const stationIds = configuredStationIds();
  if (!boolEnv("REEDY_RIVER_USGS_ENABLED", true)) {
    const message = "USGS ingestion is disabled by REEDY_RIVER_USGS_ENABLED";
    SOURCE_STATES.set("hydrology_public_api", { state: "unavailable", message, checkedAt: new Date().toISOString() });
    return { ok: false, stationIds, records: 0, inserted: 0, message };
  }
  const parameters = String(process.env.REEDY_RIVER_USGS_PARAMETERS || "00060,00065")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);
  const url = new URL("https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items");
  url.searchParams.set("f", "json");
  url.searchParams.set("lang", "en-US");
  url.searchParams.set("limit", "500");
  url.searchParams.set("monitoring_location_id", stationIds.join(","));
  if (parameters.length) url.searchParams.set("parameter_code", parameters.join(","));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), intEnv("REEDY_RIVER_USGS_TIMEOUT_MS", 15_000, 2_000, 60_000));
  try {
    const headers: Record<string, string> = { Accept: "application/geo+json, application/json" };
    const apiKey = String(process.env.USGS_API_KEY || "").trim();
    if (apiKey) headers["X-Api-Key"] = apiKey;
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
    const body = (await response.json()) as { features?: UsgsFeature[] };
    const features = Array.isArray(body.features) ? body.features : [];
    if (!features.length) throw new Error(`No latest-continuous records returned for ${stationIds.join(", ")}`);

    const observations: ReedyRiverObservationInput[] = features.flatMap((feature) => {
      const properties = feature.properties || {};
      const observedAt = dateIso(properties.time);
      const code = String(properties.parameter_code || "").trim();
      const value = properties.value;
      const featureStationId = normalizeStationId(String(properties.monitoring_location_id || ""));
      if (!observedAt || !code || value === undefined || value === null || !featureStationId) return [];
      const approvalsRaw = properties.approval_status || properties.approvals_status;
      const approvals = Array.isArray(approvalsRaw) ? approvalsRaw.map(String) : [String(approvalsRaw || "")];
      const approved = approvals.some((item) => /approved/i.test(item));
      const coordinates = Array.isArray(feature.geometry?.coordinates) ? feature.geometry?.coordinates : [];
      const longitude = typeof coordinates?.[0] === "number" ? coordinates[0] : undefined;
      const latitude = typeof coordinates?.[1] === "number" ? coordinates[1] : undefined;
      const featureId = String(
        feature.id ||
          stableId("usgs-feature", `${featureStationId}|${code}|${observedAt}|${String(properties.time_series_id || properties.timeseries_id || "")}`),
      );
      return [
        {
          idempotencyKey: `usgs:${featureId}`,
          dataMode: "live" as const,
          sourceType: "hydrology_public_api" as const,
          sourceId: "usgs-water-data",
          siteId: featureStationId,
          observedAt,
          kind: "hydrology_context_measurement",
          reviewStatus: approved ? ("qa_passed" as const) : ("qa_pending" as const),
          data: {
            value,
            parameterCode: code,
            parameterName: usgsParameterName(code),
            unit: properties.unit_of_measure,
            approvalStatus: approvals,
            qualifier: properties.qualifier,
            timeSeriesId: properties.time_series_id || properties.timeseries_id,
            lastModified: properties.last_modified,
            contextClassification: "hydrology_context_only",
            doesNotMeasure: ["E. coli", "current TMDL compliance", "pollution source attribution"],
          },
          evidence: [],
          location: {
            publicLabel: `${USGS_LABELS[featureStationId] || "Reedy River USGS monitoring location"} — ${featureStationId}`,
            latitude,
            longitude,
            precisionMeters: 100,
          },
          provenance: {
            provider: "U.S. Geological Survey Water Data for the Nation",
            method: "Modern USGS OGC latest-continuous API; hydrology context only",
            sourceUrl: url.toString(),
            license: "U.S. Government public data",
            retrievedAt: new Date().toISOString(),
          },
        },
      ];
    });
    const result = await ingestReedyRiverObservations(observations);
    const receivedStations = [...new Set(observations.map((observation) => observation.siteId))];
    const message = `Received ${observations.length} latest-continuous hydrology record(s) for ${receivedStations.join(", ")}. These values do not measure E. coli or compliance.`;
    SOURCE_STATES.set("hydrology_public_api", { state: "live", message, checkedAt: new Date().toISOString() });
    return { ok: true, stationIds, records: observations.length, inserted: result.inserted, message };
  } catch (error: unknown) {
    const message = `USGS live ingest failed: ${error instanceof Error ? error.message : String(error)}`;
    SOURCE_STATES.set("hydrology_public_api", { state: "unavailable", message, checkedAt: new Date().toISOString() });
    return { ok: false, stationIds, records: 0, inserted: 0, message };
  } finally {
    clearTimeout(timeout);
  }
}
