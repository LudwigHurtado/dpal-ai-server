import { isDbConnected } from "../config/db.js";
import { generateReedyRiverReport } from "./reedyRiver.service.reports.js";
import { pollUsgsReedyRiver } from "./reedyRiver.service.usgs.js";
import { REEDY_RIVER_RUNTIME, boolEnv, intEnv } from "./reedyRiver.service.shared.js";

const SCHEDULER_STATE = { busy: false, lastUsgsPollAt: 0 };

export async function schedulerTick(): Promise<void> {
  if (SCHEDULER_STATE.busy || !isDbConnected()) return;
  SCHEDULER_STATE.busy = true;
  try {
    const pollIntervalMs = intEnv("REEDY_RIVER_USGS_POLL_MINUTES", 15, 5, 1_440) * 60_000;
    if (Date.now() - SCHEDULER_STATE.lastUsgsPollAt >= pollIntervalMs) {
      const poll = await pollUsgsReedyRiver();
      SCHEDULER_STATE.lastUsgsPollAt = Date.now();
      if (!poll.ok) console.warn(`[Reedy River] ${poll.message}`);
    }
    await generateReedyRiverReport();
  } catch (error: unknown) {
    console.error("[Reedy River scheduler]", error instanceof Error ? error.message : String(error));
  } finally {
    SCHEDULER_STATE.busy = false;
  }
}

export function startReedyRiverScheduler(): void {
  if (REEDY_RIVER_RUNTIME.schedulerStarted || !boolEnv("REEDY_RIVER_ENABLED", true) || process.env.NODE_ENV === "test") return;
  REEDY_RIVER_RUNTIME.schedulerStarted = true;
  const initialDelay = intEnv("REEDY_RIVER_SCHEDULER_START_DELAY_MS", 5_000, 0, 60_000);
  const checkInterval = intEnv("REEDY_RIVER_SCHEDULER_CHECK_MINUTES", 5, 1, 60) * 60_000;
  const first = setTimeout(() => void schedulerTick(), initialDelay);
  (first as any).unref?.();
  const interval = setInterval(() => void schedulerTick(), checkInterval);
  (interval as any).unref?.();
  console.log(`✅ Reedy River live scheduler enabled (3-hour reports; ${Math.round(checkInterval / 60_000)}-minute checks)`);
}
