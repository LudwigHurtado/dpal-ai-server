
import { TutorialMission } from "../types";

export const tutorialReportForDutyMission: TutorialMission = {
  id: "tutorial_report_for_duty",
  kind: "tutorial",
  title: "REPORT FOR DUTY",
  /* FIX: Added required backstory and currentActionIndex properties from the Mission base interface. */
  backstory: "Your first field induction. Sync with the local node and establish your presence on the ledger.",
  currentActionIndex: 0,
  subtitle: "A guided first run that ends with a real report in your feed.",
  approach: "EVIDENCE_FIRST",
  difficulty: "STANDARD",
  goal: "LEARN_SYSTEM",
  actions: [
    {
      id: "tut_mode",
      title: "SELECT MODE",
      objective: "Choose whether this first run creates a practice report or a real report.",
      requiredPrompts: [
        {
          id: "mode_select",
          type: "confirmation",
          promptText: "Select a mode.",
          required: true,
          responseType: "multi-select",
          options: ["PRACTICE", "REAL"],
          storedAs: { entity: "tutorial", field: "mode" },
        },
      ],
    },
    {
      id: "tut_area",
      title: "SET OPERATING AREA",
      objective: "Set where you are operating so the system can filter nearby items.",
      requiredPrompts: [
        {
          id: "area_text",
          type: "observation",
          promptText: "Enter a city or neighborhood name, example, Visalia CA.",
          required: true,
          responseType: "text",
          validationRules: [{ rule: "minLength", value: 3 }],
          storedAs: { entity: "tutorial", field: "operatingArea" },
        },
      ],
    },
    {
      id: "tut_report_shell",
      title: "CREATE REPORT SHELL",
      objective: "Create the core report fields, category and urgency.",
      requiredPrompts: [
        {
          id: "category_pick",
          type: "confirmation",
          promptText: "Pick a category for this first report.",
          required: true,
          responseType: "multi-select",
          options: ["SAFETY", "HOUSING", "EDUCATION", "ENVIRONMENT", "OTHER"],
          storedAs: { entity: "report", field: "category" },
        },
        {
          id: "severity_pick",
          type: "confirmation",
          promptText: "Pick urgency.",
          required: true,
          responseType: "multi-select",
          options: ["INFORMATIONAL", "STANDARD", "CRITICAL"],
          storedAs: { entity: "report", field: "severity" },
        },
      ],
    },
    {
      id: "tut_event_context",
      title: "ADD EVENT CONTEXT",
      objective: "Write a short, factual summary that someone else can understand.",
      requiredPrompts: [
        {
          id: "context_note",
          type: "observation",
          promptText: "Write 1 to 2 sentences. Facts only. Who, what, where. No opinions.",
          required: true,
          responseType: "text",
          validationRules: [{ rule: "minLength", value: 20 }],
          storedAs: { entity: "report", field: "summary" },
        },
      ],
    },
    {
      id: "tut_evidence",
      title: "ATTACH EVIDENCE",
      objective: "Attach one item, a photo, a video, or a short field note.",
      requiredPrompts: [
        {
          id: "evidence_attach",
          type: "evidence",
          promptText: "Attach one media item, or write a short field note.",
          required: true,
          responseType: "photo",
          validationRules: [{ rule: "requireOneOf", value: ["media", "note"] }],
          storedAs: { entity: "evidence", field: "items" },
        },
        {
          id: "evidence_note",
          type: "observation",
          promptText: "Optional. Add a short note about what the evidence shows.",
          required: false,
          responseType: "text",
          storedAs: { entity: "evidence", field: "notes" },
        },
      ],
    },
    {
      id: "tut_safety",
      title: "FIELD SAFETY CHECK",
      objective: "Confirm you stayed safe and did not escalate.",
      requiredPrompts: [
        {
          id: "safe_public",
          type: "safety",
          promptText: "I remained in a safe public area.",
          required: true,
          responseType: "checkbox",
          storedAs: { entity: "riskAssessment", field: "safePublic" },
        },
        {
          id: "no_confront",
          type: "safety",
          promptText: "No confrontation occurred.",
          required: true,
          responseType: "checkbox",
          storedAs: { entity: "riskAssessment", field: "noConfrontation" },
        },
        {
          id: "no_restrict",
          type: "safety",
          promptText: "No restricted access entered.",
          required: true,
          responseType: "checkbox",
          storedAs: { entity: "riskAssessment", field: "noRestrictedAccess" },
        },
      ],
    },
    {
      id: "tut_review",
      title: "REVIEW AND FINALIZE",
      objective: "Confirm what will be recorded, then finalize the report.",
      requiredPrompts: [
        {
          id: "review_ack",
          type: "confirmation",
          promptText: "I reviewed the summary and evidence and want to finalize.",
          required: true,
          responseType: "checkbox",
          storedAs: { entity: "tutorial", field: "reviewAccepted" },
        },
      ],
    },
  ],
};
