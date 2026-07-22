import type { ReedyRiverActionStatus } from "./reedyRiver.types.js";

export const REEDY_RIVER_ACTION_TRANSITIONS: Record<
  ReedyRiverActionStatus,
  readonly ReedyRiverActionStatus[]
> = {
  proposed: ["triaged", "assigned", "awaiting_expert", "blocked", "dismissed"],
  triaged: ["assigned", "in_progress", "awaiting_expert", "blocked", "dismissed"],
  assigned: ["in_progress", "awaiting_expert", "blocked", "dismissed"],
  in_progress: ["awaiting_expert", "blocked", "completed", "dismissed"],
  awaiting_expert: ["triaged", "assigned", "in_progress", "blocked", "completed", "dismissed"],
  blocked: ["triaged", "assigned", "in_progress", "awaiting_expert", "dismissed"],
  completed: [],
  dismissed: [],
};

export function canTransitionReedyRiverAction(
  current: ReedyRiverActionStatus,
  next: ReedyRiverActionStatus,
): boolean {
  return REEDY_RIVER_ACTION_TRANSITIONS[current].includes(next);
}

export function nextWorkflowInstruction(input: {
  status: ReedyRiverActionStatus;
  ownerRole: string;
  safeToExecute: boolean;
  approvalRequired: boolean;
  assignedToLabel?: string;
}): string {
  switch (input.status) {
    case "proposed":
      return `Triage this action, confirm the evidence links, and assign the ${input.ownerRole}.`;
    case "triaged":
      return `Assign a named ${input.ownerRole} and confirm the due date.`;
    case "assigned":
      return input.safeToExecute
        ? `The assigned owner should begin the listed steps and upload field evidence.`
        : "Complete the required expert or approval gate before field treatment begins.";
    case "in_progress":
      return input.approvalRequired
        ? "Finish the approved field steps, preserve evidence, and obtain the required close-out review."
        : "Finish the field steps and attach close-out evidence.";
    case "awaiting_expert":
      return "Assign a qualified reviewer, record the decision and limitations, then return the action to triage or execution.";
    case "blocked":
      return "Record the blocking dependency, assign its owner, and update the action when the dependency is cleared.";
    case "completed":
      return "Monitor the follow-up interval and reopen only with new live evidence.";
    case "dismissed":
      return "No further work is scheduled; retain the rationale and evidence for audit.";
  }
}
