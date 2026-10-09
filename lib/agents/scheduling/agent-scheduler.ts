import { createAdminClient } from "@/lib/supabase/admin";
import { runDueAgentSchedules } from "./run-due-schedules";

let started = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

export function isAgentSchedulerRunning(): boolean {
  return started;
}

export async function tickAgentScheduler(reason = "interval"): Promise<void> {
  if (tickInFlight) {
    console.log("[scheduler] skipping tick — previous tick still running");
    return;
  }

  tickInFlight = true;
  console.log(`[scheduler] checking scheduled agents (${reason})`);

  try {
    const admin = createAdminClient();
    const result = await runDueAgentSchedules(admin, 10);

    if (result.processed === 0) {
      console.log("[scheduler] no due schedules");
    } else {
      console.log(
        `[scheduler] processed=${result.processed} completed=${result.completed} failed=${result.failed} skipped=${result.skipped}`
      );
      for (const run of result.runs) {
        console.log(
          `[scheduler] agent ${run.agentId} schedule=${run.scheduleId} status=${run.status}${run.error ? ` error=${run.error}` : ""}`
        );
      }
    }
  } catch (err) {
    console.error("[scheduler] tick failed:", err);
  } finally {
    tickInFlight = false;
  }
}

/**
 * Starts an in-process scheduler loop while the Node.js server is running.
 * Used for local development and long-lived production Node hosts.
 * Vercel cron remains the source of truth in serverless production.
 */
export function startAgentScheduler(): void {
  if (started) return;
  if (process.env.DISABLE_AGENT_SCHEDULER === "true") {
    console.log("[scheduler] disabled via DISABLE_AGENT_SCHEDULER");
    return;
  }

  const defaultInterval = process.env.NODE_ENV === "development" ? 30_000 : 60_000;
  const intervalMs = Number(process.env.AGENT_SCHEDULER_INTERVAL_MS ?? defaultInterval);
  if (!Number.isFinite(intervalMs) || intervalMs < 15_000) {
    console.warn("[scheduler] invalid AGENT_SCHEDULER_INTERVAL_MS, using 60000");
  }

  const effectiveInterval = Number.isFinite(intervalMs) && intervalMs >= 15_000 ? intervalMs : 60_000;

  console.log(`[scheduler] started (poll every ${effectiveInterval}ms)`);
  started = true;

  void tickAgentScheduler("startup");

  intervalHandle = setInterval(() => {
    void tickAgentScheduler("interval");
  }, effectiveInterval);

  if (typeof intervalHandle.unref === "function") {
    intervalHandle.unref();
  }
}

export function stopAgentScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  started = false;
}
