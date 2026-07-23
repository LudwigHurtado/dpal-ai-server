import assert from "node:assert/strict";
import {
  canTransitionReedyRiverAction,
  executionGateError,
  nextWorkflowInstruction,
  REEDY_RIVER_ACTION_TRANSITIONS,
  reedyRiverActionApprovalBasisHash,
} from "./reedyRiver.workflow.js";

assert.equal(canTransitionReedyRiverAction("proposed", "triaged"), true);
assert.equal(canTransitionReedyRiverAction("completed", "in_progress"), false);
assert.equal(canTransitionReedyRiverAction("dismissed", "triaged"), false);
assert.equal(REEDY_RIVER_ACTION_TRANSITIONS.awaiting_expert.includes("in_progress"), false);
assert.equal(REEDY_RIVER_ACTION_TRANSITIONS.blocked.includes("in_progress"), false);
assert.match(
  nextWorkflowInstruction({
    status: "assigned",
    ownerRole: "Riparian restoration lead",
    safeToExecute: true,
    approvalRequired: true,
    executionApprovalStatus: "pending",
    assignedToLabel: "Restoration Team A",
  }),
  /explicit execution approval/i,
);

const basis = {
  category: "invasive_plant" as const,
  title: "Approved containment plan",
  rationale: "Expert-confirmed evidence supports planning.",
  steps: ["Map boundary", "Use approved method"],
  ownerRole: "Riparian restoration lead",
  assignedTo: "user-123",
  assignedToLabel: "Restoration Team A",
  evidenceObservationIds: ["obs-2", "obs-1"],
  dependsOn: [],
  approvalRequired: true,
  safeToExecute: true,
  completionGate: "none" as const,
};
const hash = reedyRiverActionApprovalBasisHash(basis);
assert.equal(hash.length, 64);
assert.equal(
  reedyRiverActionApprovalBasisHash({ ...basis, evidenceObservationIds: ["obs-1", "obs-2"] }),
  hash,
  "approval basis must be order-independent for evidence ids",
);
assert.equal(executionGateError({ ...basis, assignedTo: undefined, executionApprovalStatus: "pending" }), "invalid_action_execution_requires_assignment");
assert.equal(executionGateError({ ...basis, executionApprovalStatus: "pending" }), "invalid_action_execution_approval_pending");
assert.equal(executionGateError({ ...basis, executionApprovalStatus: "approved", executionApprovalBasisHash: hash }), null);
assert.equal(
  executionGateError({ ...basis, title: "Changed action", executionApprovalStatus: "approved", executionApprovalBasisHash: hash }),
  "invalid_action_execution_approval_stale",
);
assert.equal(
  executionGateError({ ...basis, assignedTo: "user-999", executionApprovalStatus: "approved", executionApprovalBasisHash: hash }),
  "invalid_action_execution_approval_stale",
);
assert.equal(executionGateError({ ...basis, safeToExecute: false, executionApprovalStatus: "approved", executionApprovalBasisHash: hash }), "invalid_action_not_safe_to_execute");
console.log("reedyRiver.workflow self-test passed");
