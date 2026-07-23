import { isDbConnected } from "../config/db.js";
import {
  REEDY_RIVER_PROJECT_ID,
  REEDY_RIVER_REPORT_INTERVAL_MS,
  type ReedyRiverActionRecord,
  type ReedyRiverReportRecord,
} from "../features/reedyRiver/reedyRiver.types.js";
import { alignToThreeHourWindow, lastCompletedThreeHourWindow } from "../features/reedyRiver/reedyRiver.analysis.js";
import { configuredReedyRiverSourceIds } from "../features/reedyRiver/reedyRiver.security.js";
import { listReedyRiverObservations } from "./reedyRiver.service.observations.js";
import {
  getLatestReedyRiverReport,
  getReedyRiverReport,
  listReedyRiverActions,
} from "./reedyRiver.service.reports.js";
import {
  REEDY_RIVER_RUNTIME,
  SOURCE_STATES,
  boolEnv,
} from "./reedyRiver.service.shared.js";

export function nextReportAt(now = new Date()): string {
  return new Date(alignToThreeHourWindow(now).getTime() + REEDY_RIVER_REPORT_INTERVAL_MS).toISOString();
}

export async function getReedyRiverOverview(input: { publicSafe?: boolean } = {}): Promise<Record<string, unknown>> {
  const publicSafe = input.publicSafe !== false;
  const [latestReport, actions, observations] = await Promise.all([
    getLatestReedyRiverReport(publicSafe),
    listReedyRiverActions({ limit: 100, publicSafe }),
    listReedyRiverObservations({ limit: 100, publicSafe }),
  ]);
  const currentWindow = lastCompletedThreeHourWindow();
  return {
    ok: true,
    project: {
      projectId: REEDY_RIVER_PROJECT_ID,
      name: "Reedy River Live Biodiversity & Operations",
      location: "Reedy River watershed, Greenville County, South Carolina",
      dataPolicy: "live_only",
      reportCadenceHours: 3,
      publicCoordinatePolicy: "zone_labels_only",
    },
    system: {
      databaseConnected: isDbConnected(),
      schedulerEnabled: boolEnv("REEDY_RIVER_ENABLED", true),
      schedulerStarted: REEDY_RIVER_RUNTIME.schedulerStarted,
      nextReportAt: nextReportAt(),
      currentCompletedWindow: {
        start: currentWindow.windowStart.toISOString(),
        end: currentWindow.windowEnd.toISOString(),
      },
      configuredIngestSourceCount: configuredReedyRiverSourceIds().length,
      hmacRequired: boolEnv("REEDY_RIVER_REQUIRE_HMAC", process.env.NODE_ENV === "production"),
      runtimeSources: Object.fromEntries(SOURCE_STATES.entries()),
    },
    latestReport,
    actions,
    recentObservations: observations,
  };
}

export function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function reedyRiverReportToCsv(report: ReedyRiverReportRecord, actions: ReedyRiverActionRecord[]): string {
  const rows: string[][] = [["section", "id", "category", "status", "priority", "title", "summary_or_next_step", "owner", "due_at", "evidence_count"]];
  for (const source of report.sourceStatus) {
    rows.push(["source", source.sourceType, source.label, source.state, "", source.message, source.latestObservedAt || "", source.provider || "", "", String(source.recordCount)]);
  }
  for (const finding of report.findings) {
    rows.push(["finding", finding.findingId, finding.category, finding.state, finding.severity, finding.title, finding.summary, "", "", String(finding.evidenceObservationIds.length)]);
  }
  for (const recommendation of report.projectRecommendations) {
    rows.push(["recommendation", recommendation.recommendationId, recommendation.recommendationType, recommendation.implementationStatus, "", recommendation.title, recommendation.nextDecision, "", "", String(recommendation.evidenceObservationIds.length)]);
  }
  for (const action of actions.filter((item) => report.actionIds.includes(item.actionId))) {
    rows.push(["action", action.actionId, action.category, action.status, action.priority, action.title, action.nextStep, action.ownerRole, action.dueAt, String(action.evidenceObservationIds.length)]);
  }
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function markdownTable(headers: string[], rows: string[][]): string {
  const clean = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${headers.map(clean).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(clean).join(" | ")} |`),
  ].join("\n");
}

export function reedyRiverReportToMarkdown(report: ReedyRiverReportRecord, actions: ReedyRiverActionRecord[]): string {
  const reportActions = actions.filter((item) => report.actionIds.includes(item.actionId));
  return [
    `# DPAL Reedy River three-hour operations report`,
    "",
    `**Report ID:** ${report.reportId}  `,
    `**Window:** ${report.windowStart} to ${report.windowEnd}  `,
    `**Generated:** ${report.generatedAt}  `,
    `**Status:** ${report.status}  `,
    `**Data policy:** LIVE ONLY — no demo or simulated records`,
    "",
    "## Executive brief",
    "",
    report.aiNarrative.executiveSummary || report.deterministicSummary,
    "",
    ...report.aiNarrative.operatingNotes.map((note) => `- ${note}`),
    "",
    "## Monitoring-source status",
    "",
    markdownTable(
      ["Source", "State", "Records", "Latest", "Message"],
      report.sourceStatus.map((source) => [source.label, source.state, String(source.recordCount), source.latestObservedAt || "—", source.message]),
    ),
    "",
    "## Evidence findings",
    "",
    report.findings.length
      ? markdownTable(
          ["Priority", "Evidence state", "Category", "Finding", "Evidence records"],
          report.findings.map((finding) => [finding.severity, finding.state, finding.category, `${finding.title}: ${finding.summary}`, String(finding.evidenceObservationIds.length)]),
        )
      : "No deterministic ecological finding was produced.",
    "",
    "## Project recommendations",
    "",
    report.projectRecommendations.length
      ? markdownTable(
          ["Recommendation", "Evidence gate", "Implementation status", "Next decision"],
          report.projectRecommendations.map((item) => [item.title, item.evidenceGate, item.implementationStatus, item.nextDecision]),
        )
      : "No project recommendation was authorized by the available evidence.",
    "",
    "## Action plan — what happens next",
    "",
    reportActions.length
      ? markdownTable(
          ["Priority", "Status", "Action", "Owner role", "Due", "Next step"],
          reportActions.map((action) => [action.priority, action.status, action.title, action.ownerRole, action.dueAt, action.nextStep]),
        )
      : "No actions are linked to this report.",
    "",
    "## Required limitations",
    "",
    ...report.caveats.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

export async function getReedyRiverReportExport(reportId: string, format: "json" | "csv" | "markdown"): Promise<{ contentType: string; filename: string; body: string }> {
  const report = await getReedyRiverReport(reportId);
  if (!report) throw new Error("report_not_found");
  const actions = await listReedyRiverActions({ includeTerminal: true, limit: 500 });
  if (format === "csv") {
    return { contentType: "text/csv; charset=utf-8", filename: `${report.reportId}.csv`, body: reedyRiverReportToCsv(report, actions) };
  }
  if (format === "markdown") {
    return { contentType: "text/markdown; charset=utf-8", filename: `${report.reportId}.md`, body: reedyRiverReportToMarkdown(report, actions) };
  }
  return { contentType: "application/json; charset=utf-8", filename: `${report.reportId}.json`, body: `${JSON.stringify({ report, actions: actions.filter((item) => report.actionIds.includes(item.actionId)) }, null, 2)}\n` };
}
