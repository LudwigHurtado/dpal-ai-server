import { isDbConnected } from "../config/db.js";
import {
  REEDY_RIVER_PROJECT_ID,
  type ReedyRiverObservation,
  type ReedyRiverObservationInput,
  type ReedyRiverReviewStatus,
  type ReedyRiverSourceType,
} from "../features/reedyRiver/reedyRiver.types.js";
import { ReedyRiverObservationModel } from "../models/ReedyRiverObservation.js";
import {
  mapObservation,
  sanitizePublicReedyRiverObservation,
  stableId,
} from "./reedyRiver.service.shared.js";

export async function ingestReedyRiverObservations(
  observations: ReedyRiverObservationInput[],
): Promise<{ accepted: number; inserted: number; duplicates: number; observationIds: string[] }> {
  if (!isDbConnected()) throw new Error("database_unavailable");
  if (!observations.length) throw new Error("No observations supplied");
  if (observations.length > 500) throw new Error("At most 500 observations may be ingested per request");

  const now = new Date();
  const normalized = observations.map((observation) => {
    if (observation.dataMode !== "live") throw new Error("Only live observations are accepted");
    if (observation.projectId && observation.projectId !== REEDY_RIVER_PROJECT_ID) {
      throw new Error(`projectId must be ${REEDY_RIVER_PROJECT_ID}`);
    }
    const observationId = observation.observationId || stableId(
      "rro",
      `${REEDY_RIVER_PROJECT_ID}|${observation.sourceId}|${observation.idempotencyKey}`,
    );
    return {
      ...observation,
      observationId,
      projectId: REEDY_RIVER_PROJECT_ID,
      observedAt: new Date(observation.observedAt),
      receivedAt: now,
      evidence: observation.evidence || [],
    };
  });

  const operations = normalized.map((observation) => ({
    updateOne: {
      filter: {
        projectId: REEDY_RIVER_PROJECT_ID,
        sourceId: observation.sourceId,
        idempotencyKey: observation.idempotencyKey,
      },
      update: { $setOnInsert: observation },
      upsert: true,
    },
  }));
  const result = await ReedyRiverObservationModel.bulkWrite(operations as any, { ordered: false });
  const inserted = Number((result as any).upsertedCount || 0);
  return {
    accepted: normalized.length,
    inserted,
    duplicates: normalized.length - inserted,
    observationIds: normalized.map((observation) => observation.observationId),
  };
}

export async function listReedyRiverObservations(input: {
  limit?: number;
  sourceType?: ReedyRiverSourceType;
  reviewStatus?: ReedyRiverReviewStatus;
  siteId?: string;
  since?: string;
  before?: string;
  publicSafe?: boolean;
} = {}): Promise<ReedyRiverObservation[]> {
  if (!isDbConnected()) return [];
  const filter: Record<string, unknown> = { projectId: REEDY_RIVER_PROJECT_ID };
  if (input.sourceType) filter.sourceType = input.sourceType;
  if (input.reviewStatus) filter.reviewStatus = input.reviewStatus;
  if (input.siteId) filter.siteId = input.siteId;
  if (input.since || input.before) {
    const dateFilter: Record<string, Date> = {};
    if (input.since) dateFilter.$gte = new Date(input.since);
    if (input.before) dateFilter.$lt = new Date(input.before);
    filter.observedAt = dateFilter;
  }
  const rows = await ReedyRiverObservationModel.find(filter)
    .sort({ observedAt: -1 })
    .limit(Math.max(1, Math.min(input.limit || 100, 500)))
    .lean();
  const mapped = rows.map(mapObservation);
  return input.publicSafe === false ? mapped : mapped.map(sanitizePublicReedyRiverObservation);
}

export async function getReedyRiverObservation(
  observationId: string,
  publicSafe = true,
): Promise<ReedyRiverObservation | null> {
  if (!isDbConnected()) return null;
  const row = await ReedyRiverObservationModel.findOne({
    projectId: REEDY_RIVER_PROJECT_ID,
    observationId,
  }).lean();
  if (!row) return null;
  const mapped = mapObservation(row);
  return publicSafe ? sanitizePublicReedyRiverObservation(mapped) : mapped;
}

const REVIEW_TRANSITIONS: Record<ReedyRiverReviewStatus, ReedyRiverReviewStatus[]> = {
  machine_candidate: ["qa_pending", "expert_confirmed", "rejected"],
  field_observed: ["qa_pending", "qa_passed", "expert_confirmed", "rejected"],
  qa_pending: ["qa_passed", "expert_confirmed", "rejected"],
  qa_passed: ["expert_confirmed", "rejected"],
  expert_confirmed: ["rejected"],
  rejected: ["qa_pending", "expert_confirmed"],
};

export async function reviewReedyRiverObservation(input: {
  observationId: string;
  toStatus: ReedyRiverReviewStatus;
  actorId: string;
  actorLabel: string;
  note: string;
}): Promise<ReedyRiverObservation> {
  if (!isDbConnected()) throw new Error("database_unavailable");
  const row = await ReedyRiverObservationModel.findOne({
    projectId: REEDY_RIVER_PROJECT_ID,
    observationId: input.observationId,
  });
  if (!row) throw new Error("observation_not_found");
  const fromStatus = row.reviewStatus as ReedyRiverReviewStatus;
  if (!REVIEW_TRANSITIONS[fromStatus].includes(input.toStatus)) {
    throw new Error(`invalid_review_transition:${fromStatus}:${input.toStatus}`);
  }
  row.reviewStatus = input.toStatus;
  row.reviewHistory.push({
    at: new Date(),
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    fromStatus,
    toStatus: input.toStatus,
    note: input.note,
  });
  await row.save();
  return mapObservation(row);
}
