import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertAgentSchedule } from "../runtime-repository";
import type { AgentScheduleConfig, AgentScheduleFrequency } from "../runtime-types";
import { deriveScheduleStatus } from "./compute-next-run";
import { normalizeAgentTimezone } from "./timezone";
import { validateAndComputeNextRun } from "./validate-schedule";

export function scheduleFrequencyFromConfig(
  schedule: AgentScheduleConfig
): AgentScheduleFrequency {
  if (schedule.when === "weekly") return "weekly";
  if (schedule.when === "daily" || schedule.when === "at_time") return "daily";
  if (schedule.when === "on_event") return "custom";
  return "manual";
}

export async function syncAgentSchedule(
  supabase: SupabaseClient,
  params: {
    agentId: string;
    userId: string;
    organizationId: string;
    schedule: AgentScheduleConfig;
    scheduleSummary?: string;
    timezone: string;
    /** When false (agent paused), schedule row stays disabled until resumed. */
    agentActive?: boolean;
  }
) {
  const timezone = normalizeAgentTimezone(params.timezone);
  const frequency = scheduleFrequencyFromConfig(params.schedule);
  const scheduleEnabled = params.schedule.when !== "manual";
  const agentActive = params.agentActive ?? true;
  const enabled = scheduleEnabled && agentActive;
  const computedNextRunAt = scheduleEnabled
    ? validateAndComputeNextRun({
        frequency,
        schedule: params.schedule,
        timezone,
      })
    : null;
  const nextRunAt = enabled ? computedNextRunAt : null;
  const status = deriveScheduleStatus(frequency, params.schedule, enabled);

  console.log("[scheduler] schedule synced", {
    agentId: params.agentId,
    timezone,
    time: params.schedule.time,
    when: params.schedule.when,
    agentActive,
    enabled,
    nextRunAt,
    previewNextRunAt: computedNextRunAt,
  });

  const record = await upsertAgentSchedule(supabase, {
    agentId: params.agentId,
    userId: params.userId,
    organizationId: params.organizationId,
    frequency,
    timezone,
    scheduleConfig: {
      ...(params.schedule as Record<string, unknown>),
      ...(params.scheduleSummary ? { summary: params.scheduleSummary } : {}),
    },
    nextRunAt,
    enabled,
    status,
  });

  return {
    ...record,
    previewNextRunAt: computedNextRunAt,
  };
}
