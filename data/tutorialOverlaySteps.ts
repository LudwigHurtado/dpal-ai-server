
import { TutorialOverlayStep } from "../types";

export const tutorialOverlaySteps: TutorialOverlayStep[] = [
  {
    id: "ov_mode",
    title: "SELECT MODE",
    body: "Choose PRACTICE if you want a safe first run. Choose REAL to file a real report now.",
    targetSelector: '[data-tut="mode"]',
    placement: "right",
  },
  {
    id: "ov_area",
    title: "OPERATING AREA",
    body: "Set your area so the feed and missions can focus nearby.",
    targetSelector: '[data-tut="area"]',
    placement: "right",
  },
  {
    id: "ov_category",
    title: "CATEGORY AND URGENCY",
    body: "Pick what this is and how urgent it is. This drives routing and visibility.",
    targetSelector: '[data-tut="category"]',
    placement: "right",
  },
  {
    id: "ov_summary",
    title: "FACTS ONLY",
    body: "Write one short factual summary. Who, what, where. Keep it clean.",
    targetSelector: '[data-tut="summary"]',
    placement: "right",
  },
  {
    id: "ov_evidence",
    title: "ATTACH EVIDENCE",
    body: "Attach one item or add a short note. Evidence increases trust.",
    targetSelector: '[data-tut="evidence"]',
    placement: "left",
  },
  {
    id: "ov_safety",
    title: "FIELD SAFETY",
    body: "Confirm you stayed safe. This keeps missions grounded.",
    targetSelector: '[data-tut="safety"]',
    placement: "left",
  },
  {
    id: "ov_finalize",
    title: "FINALIZE",
    body: "You are about to create a report in your feed. Review, then finalize.",
    targetSelector: '[data-tut="finalize"]',
    placement: "top",
  },
];
