import crypto from "crypto";
import type {
  ReedyRiverActionStatus,
  ReedyRiverCompletionGate,
  ReedyRiverExecutionApprovalStatus,
  ReedyRiverFinding,
} from "./reedyRiver.types.js";

export const REEDY_RIVER_ACTION_TRANSITIONS: Record<
  ReedyRiverActionStatus,
  readonly ReedyRiverActionStatus[]
> = {
  proposed: ["triaged", "assigned", "awaiting_expert", "blocked", "dismissed"],
  triaged: ["assigned", "in_progress", "awaiting_expert", "blocked", "dismissed"],
  assigned: ["in_progress", "awaiting_expert", "blocked", "dismissed"],
  in_progress: ["awaiting_expert", "blocked", "completed", "dismissed"],
  awaiting_expert: ["triaged", "assigned", "blocked", "dismissed"],
  blocked: ["triaged", "assigned", "awaiting_expert", "dismissed"],
  completed: [],
  dismissed: [],
};

export function canTransitionReedyRiverAction(
  current: ReedyRiverActionStatus,
  next: ReedyRiverActionStatus,
): boolean {
  return REEDY_RIVER_ACTION_TRANSITIONS[current].includes(next);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).filter((key) => row[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(row[key])}`).join(",")}}`;
}

export interface ReedyRiverApprovalBasisInput {
  category: ReedyRiverFinding["category"];
  title: string;
  rationale: string;
  steps: string[];
  ownerRole: string;
  assignedTo?: string;
  assignedToLabel?: string;
  evidenceObservationIds: string[];
  dependsOn: string[];
  approvalRequired: boolean;
  safeToExecute: boolean;
  completionGate?: ReedyRiverCompletionGate;
}

export function reedyRiverActionApprovalBasisHash(input: ReedyRiverApprovalBasisInput): string {
  const canonical = stableStringify({
    category: input.category,
    title: input.title,
    rationale: input.rationale,
    steps: input.steps,
    ownerRole: input.ownerRole,
    assignedTo: input.assignedTo,
    assignedToLabel: input.assignedToLabel,
    evidenceObservationIds: [...new Set(input.evidenceObservationIds)].sort(),
    dependsOn: [...new Set(input.dependsOn)].sort(),
    approvalRequired: input.approvalRequired,
    safeToExecute: input.safeToExecute,
    completionGate: input.completionGate || "none",
  });
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function normalizedExecutionApprovalStatus(input: {
  approvalRequired: boolean;
  executionApprovalStatus?: ReedyRiverExecutionApprovalStatus | null;
}): ReedyRiverExecutionApprovalStatus {
  if (!input.approvalRequired) return "not_required";
  return input.executionApprovalStatus || "pending";
}

export function executionGateError(input: ReedyRiverApprovalBasisInput & {
  executionApprovalStatus?: ReedyRiverExecutionApprovalStatus | null;
  executionApprovalBasisHash?: string | null;
}): string | null {
  if (!input.safeToExecute) return "invalid_action_not_safe_to_execute";
  if (!input.approvalRequired) return null;
  if (!input.assignedTo) return "invalid_action_execution_requires_assignment";
  const approvalStatus = normalizedExecutionApprovalStatus(input);
  if (approvalStatus !== "approved") return `invalid_action_execution_approval_${approvalStatus}`;
  const currentBasisHash = reedyRiverActionApprovalBasisHash(input);
  if (!input.executionApprovalBasisHash || input.executionApprovalBasisHash !== currentBasisHash) {
    return "invalid_action_execution_approval_stale";
  }
  return null;
}

export function nextWorkflowInstruction(input: {
  status: ReedyRiverActionStatus;
  ownerRole: string;
  safeToExecute: boolean;
  approvalRequired: boolean;
  executionApprovalStatus?: ReedyRiverExecutionApprovalStatus;
  completionGate?: ReedyRiverCompletionGate;
  assignedToLabel?: string;
}): string {
  const approvalStatus = normalizedExecutionApprovalStatus(input);
  switch (input.status) {
    case "proposed":
      return `Triage this action, confirm the evidence links, and assign the ${input.ownerRole}.`;
    case "triaged":
      return `Assign a named ${input.ownerRole} and confirm the due date.`;
    case "assigned":
      if (!input.safeToExecute) return "Complete the required evidence or safety gate before execution begins.";
      if (input.approvalRequired && approvalStatus !== "approved") {
        return `Obtain explicit execution approval for ${input.assignedToLabel || "the named assignee"} before the listed field steps begin.`;
      }
      return "The assigned owner may begin the approved steps and must upload contemporaneous evidence.";
    case "in_progress":
      if (input.approvalRequired && approvalStatus !== "approved") {
        return "Pause execution immediately; the execution approval is not current and must be renewed before work continues.";
      }
      return input.approvalRequired
        ? "Finish only the approved steps, preserve evidence, and obtain the required close-out review."
        : "Finish the listed steps and attach close-out evidence.";
    case "awaiting_expert":
      return input.completionGate === "expert_confirmation_or_rejection"
        ? "Assign a qualified reviewer, resolve the linked candidate as expert-confirmed or rejected, then return the action to triage for the auditable close-out path."
        : "Assign a qualified reviewer, record the decision and limitations, then return the action to triage or block it with a documented dependency.";
    case "blocked":
      return "Record the blocking dependency, assign its owner, and return the action to triage only when the dependency is cleared.";
    case "completed":
      return "Monitor the follow-up interval and create a new action only from new live evidence.";
    case "dismissed":
      return "No further work is scheduled; retain the rationale and evidence for audit.";
  }
}
