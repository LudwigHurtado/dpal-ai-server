import { isDbConnected } from "../config/db.js";
import type {
  ReedyRiverActionRecord,
  ReedyRiverReviewStatus,
} from "../features/reedyRiver/reedyRiver.types.js";
import {
  executionGateError,
  nextWorkflowInstruction,
  reedyRiverActionApprovalBasisHash,
} from "../features/reedyRiver/reedyRiver.workflow.js";
import { ReedyRiverActionModel, type IReedyRiverAction } from "../models/ReedyRiverAction.js";
import { ReedyRiverObservationModel } from "../models/ReedyRiverObservation.js";
import { mapAction, TERMINAL_ACTION_STATUSES } from "./reedyRiver.service.shared.js";

function approvalBasisHash(action: IReedyRiverAction): string {
  return reedyRiverActionApprovalBasisHash({
    category: action.category,
    title: action.title,
    rationale: action.rationale,
    steps: action.steps,
    ownerRole: action.ownerRole,
    assignedTo: action.assignedTo,
    assignedToLabel: action.assignedToLabel,
    evidenceObservationIds: action.evidenceObservationIds,
    dependsOn: action.dependsOn,
    approvalRequired: action.approvalRequired,
    safeToExecute: action.safeToExecute,
    completionGate: action.completionGate,
  });
}

async function linkedReviewStatuses(action: IReedyRiverAction): Promise<ReedyRiverReviewStatus[]> {
  const ids = [...new Set(action.evidenceObservationIds || [])];
  if (!ids.length) return [];
  const rows = await ReedyRiverObservationModel.find({
    projectId: action.projectId,
    observationId: { $in: ids },
  }).select("reviewStatus").lean();
  return rows.map((row: any) => row.reviewStatus as ReedyRiverReviewStatus);
}

async function assertDependenciesCompleted(action: IReedyRiverAction): Promise<void> {
  const dependencyIds = [...new Set(action.dependsOn || [])];
  if (!dependencyIds.length) return;
  const completed = await ReedyRiverActionModel.find({
    projectId: action.projectId,
    actionId: { $in: dependencyIds },
    status: "completed",
  }).select("actionId").lean();
  const completedIds = new Set(completed.map((row: any) => String(row.actionId)));
  const incomplete = dependencyIds.filter((id) => !completedIds.has(id));
  if (incomplete.length) throw new Error(`invalid_action_dependencies_incomplete:${incomplete.join(",")}`);
}

async function assertApprovalEvidenceGate(action: IReedyRiverAction): Promise<void> {
  const statuses = await linkedReviewStatuses(action);
  if (!statuses.length) throw new Error("action_approval_requires_linked_evidence");
  if (["invasive_plant", "bioacoustic"].includes(action.category)) {
    if (!statuses.includes("expert_confirmed")) {
      throw new Error("action_approval_requires_expert_confirmed_evidence");
    }
    return;
  }
  if (action.category === "water") {
    if (statuses.some((status) => !["qa_passed", "expert_confirmed"].includes(status))) {
      throw new Error("action_approval_requires_qa_passed_water_evidence");
    }
    return;
  }
  if (action.category === "activity") {
    if (!statuses.some((status) => ["field_observed", "qa_passed", "expert_confirmed"].includes(status))) {
      throw new Error("action_approval_requires_reviewed_activity_evidence");
    }
  }
}

export async function assertReedyRiverActionExecutionGate(action: IReedyRiverAction): Promise<void> {
  await assertDependenciesCompleted(action);
  const error = executionGateError({
    category: action.category,
    title: action.title,
    rationale: action.rationale,
    steps: action.steps,
    ownerRole: action.ownerRole,
    assignedTo: action.assignedTo,
    assignedToLabel: action.assignedToLabel,
    evidenceObservationIds: action.evidenceObservationIds,
    dependsOn: action.dependsOn,
    approvalRequired: action.approvalRequired,
    safeToExecute: action.safeToExecute,
    completionGate: action.completionGate,
    executionApprovalStatus: action.executionApprovalStatus,
    executionApprovalBasisHash: action.executionApprovalBasisHash,
  });
  if (error) throw new Error(error);
  if (action.approvalRequired) await assertApprovalEvidenceGate(action);
}

export async function assertReedyRiverActionCompletionGate(action: IReedyRiverAction): Promise<void> {
  if (action.completionGate === "none") return;
  const statuses = await linkedReviewStatuses(action);
  if (!statuses.length) throw new Error("action_completion_requires_linked_evidence");
  if (action.completionGate === "expert_confirmation_or_rejection") {
    if (statuses.some((status) => !["expert_confirmed", "rejected"].includes(status))) {
      throw new Error("action_completion_requires_expert_confirmation_or_rejection");
    }
    return;
  }
  if (statuses.some((status) => !["qa_passed", "expert_confirmed", "rejected"].includes(status))) {
    throw new Error("action_completion_requires_resolved_evidence_review");
  }
}

export async function approveReedyRiverAction(input: {
  actionId: string;
  decision: "approved" | "rejected";
  actorId: string;
  actorLabel: string;
  note: string;
}): Promise<ReedyRiverActionRecord> {
  if (!isDbConnected()) throw new Error("database_unavailable");
  if (input.note.trim().length < 12) throw new Error("execution_approval_requires_rationale");
  const action = await ReedyRiverActionModel.findOne({ actionId: input.actionId });
  if (!action) throw new Error("action_not_found");
  if (TERMINAL_ACTION_STATUSES.has(action.status)) throw new Error("invalid_terminal_action_cannot_be_approved");
  if (!action.approvalRequired) throw new Error("invalid_action_does_not_require_execution_approval");

  const fromStatus = action.status;
  const basisHash = approvalBasisHash(action);
  if (input.decision === "approved") {
    if (!action.assignedTo) throw new Error("action_approval_requires_assignment");
    if (!action.safeToExecute) throw new Error("invalid_action_not_safe_to_execute");
    await assertDependenciesCompleted(action);
    await assertApprovalEvidenceGate(action);
    action.executionApprovalStatus = "approved";
    action.executionApprovalBasisHash = basisHash;
    action.executionApprovedAt = new Date();
    action.executionApprovedBy = input.actorId;
    action.executionApprovedByLabel = input.actorLabel;
    action.executionApprovalNote = input.note.trim();
    action.history.push({
      at: new Date().toISOString(),
      actorId: input.actorId,
      actorLabel: input.actorLabel,
      eventType: "execution_approval",
      fromStatus,
      toStatus: action.status,
      approvalDecision: "approved",
      approvalBasisHash: basisHash,
      note: input.note.trim(),
    });
  } else {
    action.executionApprovalStatus = "rejected";
    action.executionApprovalBasisHash = basisHash;
    action.executionApprovedAt = undefined;
    action.executionApprovedBy = undefined;
    action.executionApprovedByLabel = undefined;
    action.executionApprovalNote = input.note.trim();
    if (action.status !== "blocked") action.status = "blocked";
    action.history.push({
      at: new Date().toISOString(),
      actorId: input.actorId,
      actorLabel: input.actorLabel,
      eventType: "execution_approval",
      fromStatus,
      toStatus: action.status,
      approvalDecision: "rejected",
      approvalBasisHash: basisHash,
      note: input.note.trim(),
    });
  }

  action.nextStep = nextWorkflowInstruction({
    status: action.status,
    ownerRole: action.ownerRole,
    safeToExecute: action.safeToExecute,
    approvalRequired: action.approvalRequired,
    executionApprovalStatus: action.executionApprovalStatus,
    completionGate: action.completionGate,
    assignedToLabel: action.assignedToLabel,
  });
  await action.save();
  return mapAction(action, false);
}
