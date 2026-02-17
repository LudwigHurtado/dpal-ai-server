export const REPORT_LIFECYCLE_STATES = ["draft", "submitted", "verified", "anchored", "certified"] as const;
export type ReportLifecycleState = (typeof REPORT_LIFECYCLE_STATES)[number];

const ORDER: Record<ReportLifecycleState, number> = {
  draft: 0,
  submitted: 1,
  verified: 2,
  anchored: 3,
  certified: 4,
};

export function canTransitionLifecycle(from: ReportLifecycleState, to: ReportLifecycleState): boolean {
  return ORDER[to] === ORDER[from] + 1;
}

export function assertTransition(from: ReportLifecycleState, to: ReportLifecycleState): void {
  if (!canTransitionLifecycle(from, to)) {
    throw new Error(`invalid_lifecycle_transition:${from}->${to}`);
  }
}
