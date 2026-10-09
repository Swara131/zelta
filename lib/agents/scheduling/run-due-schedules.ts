import type { SupabaseClient } from "@supabase/supabase-js";
import { runAgentEngine } from "../runtime/engine";
import {
  computeNextRunAt,
  deriveScheduleStatus,
} from "./compute-next-run";
import { isAgentDbStatusPaused } from "../agent-mode";
import { getBuilderAgentById } from "../repository";
import {
  claimDueAgentSchedule,
  listDueAgentSchedules,
  updateAgentScheduleAfterRun,
} from "../runtime-repository";

export interface ScheduledRunBatchResult {
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
  runs: Array<{
    scheduleId: string;
    agentId: string;
    status: string;
    error?: string;
  }>;
}

async function loadUserEmail(
  admin: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await admin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  return data?.email?.trim() || "scheduled@zelta.local";
}

export async function runDueAgentSchedules(
  admin: SupabaseClient,
  limit = 10
): Promise<ScheduledRunBatchResult> {
  const now = new Date().toISOString();
  console.log("[scheduler] listing due schedules", { now, limit });

  const due = await listDueAgentSchedules(admin, limit);

  if (due.length > 0) {
    for (const item of due) {
      console.log("[scheduler] due schedule found", {
        scheduleId: item.id,
        agentId: item.agentId,
        nextRunAt: item.nextRunAt,
        timezone: item.timezone,
        status: item.status,
      });
    }
  }
  const result: ScheduledRunBatchResult = {
    processed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    runs: [],
  };

  for (const schedule of due) {
    result.processed += 1;

    const claimed = await claimDueAgentSchedule(admin, schedule.id);
    if (!claimed) {
      result.skipped += 1;
      continue;
    }

    const agent = await getBuilderAgentById(admin, {
      agentId: schedule.agentId,
      userId: schedule.userId,
    });

    if (!agent || isAgentDbStatusPaused(agent.status) || schedule.status === "paused") {
      result.skipped += 1;
      result.runs.push({
        scheduleId: schedule.id,
        agentId: schedule.agentId,
        status: "skipped",
        error: "Agent is paused.",
      });
      continue;
    }

    const userEmail = await loadUserEmail(admin, schedule.userId);
    const configMeta = schedule.scheduleConfig as Record<string, unknown>;
    const summary =
      typeof configMeta.summary === "string"
        ? configMeta.summary
        : "Scheduled agent run";

    try {
      console.log(
        `[scheduler] triggering agent ${schedule.agentId} (schedule ${schedule.id}, due ${schedule.nextRunAt})`
      );

      const runResult = await runAgentEngine(admin, {
        agentDbId: schedule.agentId,
        userId: schedule.userId,
        userEmail,
        task: `Scheduled run: ${summary}`,
        mode: "scheduled",
        triggerSource: "cron:agent-schedules",
      });

      console.log("[scheduler] run finished", {
        agentId: schedule.agentId,
        runId: runResult.runId,
        runStatus: runResult.status,
        deliveryStatus: runResult.delivery?.status ?? "n/a",
        deliveryDestination: runResult.delivery?.destination ?? null,
        deliveryError: runResult.delivery?.error ?? null,
        providerMessageId: runResult.delivery?.email?.providerMessageId ?? null,
      });

      const nextRunAt = computeNextRunAt(
        schedule.frequency,
        schedule.scheduleConfig,
        schedule.timezone,
        new Date()
      );
      const status = deriveScheduleStatus(
        schedule.frequency,
        schedule.scheduleConfig,
        schedule.enabled
      );

      await updateAgentScheduleAfterRun(admin, {
        scheduleId: schedule.id,
        lastRunAt: new Date().toISOString(),
        nextRunAt,
        status: runResult.status === "failed" ? "error" : status,
        enabled: schedule.enabled,
      });

      if (runResult.status === "failed") {
        result.failed += 1;
      } else {
        result.completed += 1;
      }

      result.runs.push({
        scheduleId: schedule.id,
        agentId: schedule.agentId,
        status: runResult.status,
        error: runResult.error ?? undefined,
      });
    } catch (err) {
      result.failed += 1;
      const message = err instanceof Error ? err.message : "Scheduled run failed.";

      await updateAgentScheduleAfterRun(admin, {
        scheduleId: schedule.id,
        lastRunAt: new Date().toISOString(),
        nextRunAt: schedule.nextRunAt,
        status: "error",
        enabled: schedule.enabled,
      });

      result.runs.push({
        scheduleId: schedule.id,
        agentId: schedule.agentId,
        status: "failed",
        error: message,
      });
    }
  }

  return result;
}
