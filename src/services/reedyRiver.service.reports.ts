import { isDbConnected } from "../config/db.js";
import {
  REEDY_RIVER_PROJECT_ID,
  REEDY_RIVER_REPORT_INTERVAL_MS,
  type ReedyRiverActionDraft,
  type ReedyRiverActionRecord,
  type ReedyRiverActionStatus,
  type ReedyRiverReportRecord,
  type ReedyRiverSeverity,
  type ReedyRiverSourceType,
} from "../features/reedyRiver/reedyRiver.types.js";
import {
  alignToThreeHourWindow,
  analyzeReedyRiverWindow,
  lastCompletedThreeHourWindow,
} from "../features/reedyRiver/reedyRiver.analysis.js";
import {
  canTransitionReedyRiverAction,
  nextWorkflowInstruction,
} from "../features/reedyRiver/reedyRiver.workflow.js";
import { ReedyRiverObservationModel } from "../models/ReedyRiverObservation.js";
import { ReedyRiverReportModel } from "../models/ReedyRiverReport.js";
import { ReedyRiverActionModel } from "../models/ReedyRiverAction.js";
import { generateAiNarrative, unavailableSourceMessages } from "./reedyRiver.service.ai.js";
import {
  SEVERITY_RANK,
  TERMINAL_ACTION_STATUSES,
  expectedSources,
  intEnv,
  mapAction,
  mapObservation,
  mapReport,
  stableId,
} from "./reedyRiver.service.shared.js";

export function higherPriority(left: ReedyRiverSeverity, right: ReedyRiverSeverity): ReedyRiverSeverity {
  return SEVERITY_RANK[left] >= SEVERITY_RANK[right] ? left : right;
}

export async function upsertReportActions(
  reportId: string,
  windowStart: string,
  drafts: ReedyRiverActionDraft[],
): Promise<string[]> {
  const actionIds: string[] = [];
  for (const draft of drafts) {
    let fingerprint = draft.fingerprint;
    let existing = await ReedyRiverActionModel.findOne({ projectId: REEDY_RIVER_PROJECT_ID, fingerprint });
    if (existing && TERMINAL_ACTION_STATUSES.has(existing.status) && !existing.sourceReportIds.includes(reportId)) {
      fingerprint = `${draft.fingerprint}:recurrence:${windowStart}`;
      existing = await ReedyRiverActionModel.findOne({ projectId: REEDY_RIVER_PROJECT_ID, fingerprint });
    }

    if (!existing) {
      const actionId = stableId("rra", `${REEDY_RIVER_PROJECT_ID}|${fingerprint}`);
      const status = draft.recommendedInitialStatus;
      const nextStep = nextWorkflowInstruction({
        status,
        ownerRole: draft.ownerRole,
        safeToExecute: draft.safeToExecute,
        approvalRequired: draft.approvalRequired,
      });
      const created = await ReedyRiverActionModel.create({
        actionId,
        projectId: REEDY_RIVER_PROJECT_ID,
        fingerprint,
        category: draft.category,
        priority: draft.priority,
        title: draft.title,
        rationale: draft.rationale,
        steps: draft.steps,
        ownerRole: draft.ownerRole,
        dueAt: new Date(draft.dueAt),
        evidenceObservationIds: draft.evidenceObservationIds,
        dependsOn: draft.dependsOn,
        approvalRequired: draft.approvalRequired,
        safeToExecute: draft.safeToExecute,
        status,
        nextStep: draft.nextStep || nextStep,
        sourceReportIds: [reportId],
        history: [
          {
            at: new Date().toISOString(),
            actorId: "reedy-river-scheduler",
            actorLabel: "DPAL Reedy River evidence engine",
            toStatus: status,
            note: `Created from three-hour report ${reportId}.`,
          },
        ],
      });
      actionIds.push(created.actionId);
      continue;
    }

    existing.priority = higherPriority(existing.priority, draft.priority);
    existing.title = draft.title;
    existing.rationale = draft.rationale;
    existing.steps = draft.steps;
    existing.ownerRole = draft.ownerRole;
    existing.dueAt = new Date(Math.min(existing.dueAt.getTime(), new Date(draft.dueAt).getTime()));
    existing.evidenceObservationIds = [...new Set([...existing.evidenceObservationIds, ...draft.evidenceObservationIds])];
    existing.dependsOn = [...new Set([...existing.dependsOn, ...draft.dependsOn])];
    existing.approvalRequired = existing.approvalRequired || draft.approvalRequired;
    existing.safeToExecute = existing.safeToExecute && draft.safeToExecute;
    existing.sourceReportIds = [...new Set([...existing.sourceReportIds, reportId])];
    existing.nextStep = nextWorkflowInstruction({
      status: existing.status,
      ownerRole: existing.ownerRole,
      safeToExecute: existing.safeToExecute,
      approvalRequired: existing.approvalRequired,
      assignedToLabel: existing.assignedToLabel,
    });
    await existing.save();
    actionIds.push(existing.actionId);
  }
  return actionIds;
}

export async function generateReedyRiverReport(input: {
  windowEnd?: Date;
  force?: boolean;
} = {}): Promise<ReedyRiverReportRecord> {
  if (!isDbConnected()) throw new Error("database_unavailable");
  const now = new Date();
  const latestAllowedEnd = alignToThreeHourWindow(now);
  const windowEnd = input.windowEnd ? alignToThreeHourWindow(input.windowEnd) : lastCompletedThreeHourWindow(now).windowEnd;
  if (windowEnd.getTime() > latestAllowedEnd.getTime()) throw new Error("report_window_is_in_the_future");
  const windowStart = new Date(windowEnd.getTime() - REEDY_RIVER_REPORT_INTERVAL_MS);
  const reportId = stableId("rrr", `${REEDY_RIVER_PROJECT_ID}|${windowStart.toISOString()}|${windowEnd.toISOString()}`);

  if (!input.force) {
    const existing = await ReedyRiverReportModel.findOne({ reportId }).lean();
    if (existing) return mapReport(existing);
  }

  const observationRows = await ReedyRiverObservationModel.find({
    projectId: REEDY_RIVER_PROJECT_ID,
    observedAt: { $gte: windowStart, $lt: windowEnd },
  })
    .sort({ observedAt: 1 })
    .lean();
  const draft = analyzeReedyRiverWindow({
    observations: observationRows.map(mapObservation),
    windowStart,
    windowEnd,
    now,
    expectedSources: expectedSources(),
    unavailableSources: unavailableSourceMessages(),
    staleAfterMinutes: intEnv("REEDY_RIVER_STALE_AFTER_MINUTES", 240, 15, 10_080),
  });
  const aiNarrative = await generateAiNarrative(draft);
  const actionIds = await upsertReportActions(reportId, windowStart.toISOString(), draft.actionDrafts);
  const stored = await ReedyRiverReportModel.findOneAndUpdate(
    { reportId },
    {
      $set: {
        projectId: REEDY_RIVER_PROJECT_ID,
        windowStart,
        windowEnd,
        generatedAt: now,
        status: draft.status,
        dataPolicy: "live_only",
        metrics: draft.metrics,
        sourceStatus: draft.sourceStatus,
        findings: draft.findings,
        actionIds,
        projectRecommendations: draft.projectRecommendations,
        deterministicSummary: draft.deterministicSummary,
        aiNarrative,
        caveats: draft.caveats,
      },
      $setOnInsert: { reportId },
    },
    { upsert: true, new: true },
  );
  if (!stored) throw new Error("report_persistence_failed");
  return mapReport(stored);
}

export async function getLatestReedyRiverReport(publicSafe = true): Promise<ReedyRiverReportRecord | null> {
  if (!isDbConnected()) return null;
  const row = await ReedyRiverReportModel.findOne({ projectId: REEDY_RIVER_PROJECT_ID })
    .sort({ windowEnd: -1 })
    .lean();
  return row ? mapReport(row, publicSafe) : null;
}

export async function getReedyRiverReport(reportId: string, publicSafe = true): Promise<ReedyRiverReportRecord | null> {
  if (!isDbConnected()) return null;
  const row = await ReedyRiverReportModel.findOne({ projectId: REEDY_RIVER_PROJECT_ID, reportId }).lean();
  return row ? mapReport(row, publicSafe) : null;
}

export async function listReedyRiverReports(limit = 20, publicSafe = true): Promise<ReedyRiverReportRecord[]> {
  if (!isDbConnected()) return [];
  const rows = await ReedyRiverReportModel.find({ projectId: REEDY_RIVER_PROJECT_ID })
    .sort({ windowEnd: -1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .lean();
  return rows.map((row: unknown) => mapReport(row, publicSafe));
}

export async function listReedyRiverActions(input: {
  status?: ReedyRiverActionStatus;
  limit?: number;
  includeTerminal?: boolean;
  publicSafe?: boolean;
} = {}): Promise<ReedyRiverActionRecord[]> {
  if (!isDbConnected()) return [];
  const filter: Record<string, unknown> = { projectId: REEDY_RIVER_PROJECT_ID };
  if (input.status) filter.status = input.status;
  else if (!input.includeTerminal) filter.status = { $nin: ["completed", "dismissed"] };
  const rows = await ReedyRiverActionModel.find(filter)
    .sort({ priority: -1, dueAt: 1, createdAt: -1 })
    .limit(Math.max(1, Math.min(input.limit || 100, 500)))
    .lean();
  return rows
    .map((row: unknown) => mapAction(row, input.publicSafe !== false))
    .sort((a: ReedyRiverActionRecord, b: ReedyRiverActionRecord) => SEVERITY_RANK[b.priority] - SEVERITY_RANK[a.priority] || Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export async function transitionReedyRiverAction(input: {
  actionId: string;
  toStatus: ReedyRiverActionStatus;
  actorId: string;
  actorLabel: string;
  assignedTo?: string;
  assignedToLabel?: string;
  note: string;
}): Promise<ReedyRiverActionRecord> {
  if (!isDbConnected()) throw new Error("database_unavailable");
  const row = await ReedyRiverActionModel.findOne({
    projectId: REEDY_RIVER_PROJECT_ID,
    actionId: input.actionId,
  });
  if (!row) throw new Error("action_not_found");
  const fromStatus = row.status;
  if (!canTransitionReedyRiverAction(fromStatus, input.toStatus)) {
    throw new Error(`invalid_action_transition:${fromStatus}:${input.toStatus}`);
  }
  if (input.toStatus === "assigned" && !input.assignedTo && !row.assignedTo) {
    throw new Error("assigned_status_requires_assignedTo");
  }
  if (["completed", "dismissed"].includes(input.toStatus) && input.note.trim().length < 8) {
    throw new Error("terminal_status_requires_resolution_note");
  }

  row.status = input.toStatus;
  if (input.assignedTo) row.assignedTo = input.assignedTo;
  if (input.assignedToLabel) row.assignedToLabel = input.assignedToLabel;
  if (TERMINAL_ACTION_STATUSES.has(input.toStatus)) row.resolutionNote = input.note;
  row.nextStep = nextWorkflowInstruction({
    status: input.toStatus,
    ownerRole: row.ownerRole,
    safeToExecute: row.safeToExecute,
    approvalRequired: row.approvalRequired,
    assignedToLabel: row.assignedToLabel,
  });
  row.history.push({
    at: new Date().toISOString(),
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    fromStatus,
    toStatus: input.toStatus,
    note: input.note,
  });
  await row.save();
  return mapAction(row, false);
}
