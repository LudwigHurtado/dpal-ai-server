import assert from "node:assert/strict";
import {
  canTransitionReedyRiverAction,
  nextWorkflowInstruction,
  REEDY_RIVER_ACTION_TRANSITIONS,
} from "./reedyRiver.workflow.js";

assert.equal(canTransitionReedyRiverAction("proposed", "triaged"), true);
assert.equal(canTransitionReedyRiverAction("completed", "in_progress"), false);
assert.equal(canTransitionReedyRiverAction("dismissed", "triaged"), false);
assert.ok(REEDY_RIVER_ACTION_TRANSITIONS.awaiting_expert.includes("in_progress"));
assert.match(
  nextWorkflowInstruction({
    status: "assigned",
    ownerRole: "Botanical reviewer",
    safeToExecute: false,
    approvalRequired: true,
  }),
  /before field treatment/i,
);
console.log("reedyRiver.workflow self-test passed");
