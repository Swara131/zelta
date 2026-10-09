import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapAgentActionRow,
  mapAgentRunRow,
  mapAgentRunStepRow,
  mapAgentScheduleRow,
  mapToolExecutionRow,
  type AgentActionRow,
  type AgentRunRow,
  type AgentRunStepRow,
  type AgentScheduleRow,
  type ToolExecutionRow,
} from "./runtime-mappers";
import type {
  AgentActionRecord,
  AgentActionStatus,
  AgentRunMode,
  AgentRunRecord,
  AgentRunStatus,
  AgentRunStepRecord,
  AgentScheduleRecord,
  AgentScheduleStatus,
  ToolExecutionRecord,
  ToolExecutionStatus,
} from "./runtime-types";

export function isMissingRuntimeTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("schema cache") ||
    message.includes("Could not find the table") ||
    message.includes("Could not find")
  );
}

export async function insertAgentRun(
  supabase: SupabaseClient,
  params: {
    agentId: string;
    userId: string;
    organizationId: string;
    mode: AgentRunMode;
    status?: AgentRunStatus;
    triggerSource?: string | null;
    limits?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): Promise<AgentRunRecord> {
  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      agent_id: params.agentId,
      user_id: params.userId,
      organization_id: params.organizationId,
      mode: params.mode,
      status: params.status ?? "pending",
      trigger_source: params.triggerSource ?? null,
      limits: params.limits ?? {},
      metadata: params.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to insert agent run.");
  }

  return mapAgentRunRow(data as AgentRunRow);
}

export async function updateAgentRun(
  supabase: SupabaseClient,
  params: {
    runId: string;
    userId: string;
    status?: AgentRunStatus;
    summary?: string | null;
    errorMessage?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<AgentRunRecord> {
  const patch: Record<string, unknown> = {};
  if (params.status !== undefined) patch.status = params.status;
  if (params.summary !== undefined) patch.summary = params.summary;
  if (params.errorMessage !== undefined) patch.error_message = params.errorMessage;
  if (params.startedAt !== undefined) patch.started_at = params.startedAt;
  if (params.finishedAt !== undefined) patch.finished_at = params.finishedAt;
  if (params.metadata !== undefined) patch.metadata = params.metadata;

  const { data, error } = await supabase
    .from("agent_runs")
    .update(patch)
    .eq("id", params.runId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update agent run.");
  }

  return mapAgentRunRow(data as AgentRunRow);
}

export async function getAgentRunById(
  supabase: SupabaseClient,
  params: { runId: string; userId: string }
): Promise<AgentRunRecord | null> {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("id", params.runId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load agent run.");
  }

  if (!data) return null;
  return mapAgentRunRow(data as AgentRunRow);
}

export async function listAgentRunsForAgent(
  supabase: SupabaseClient,
  params: { agentId: string; userId: string; limit?: number }
): Promise<AgentRunRecord[]> {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("agent_id", params.agentId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (error) {
    if (isMissingRuntimeTableError(error.message)) {
      return [];
    }
    throw new Error(error.message ?? "Failed to list agent runs.");
  }

  return (data ?? []).map((row) => mapAgentRunRow(row as AgentRunRow));
}

export async function listAgentRunStepsForRun(
  supabase: SupabaseClient,
  params: { runId: string; userId: string }
): Promise<AgentRunStepRecord[]> {
  const { data, error } = await supabase
    .from("agent_run_steps")
    .select("*")
    .eq("agent_run_id", params.runId)
    .eq("user_id", params.userId)
    .order("sequence", { ascending: true });

  if (error) {
    throw new Error(error.message ?? "Failed to list agent run steps.");
  }

  return (data ?? []).map((row) => mapAgentRunStepRow(row as AgentRunStepRow));
}

export async function insertAgentRunStep(
  supabase: SupabaseClient,
  params: {
    agentRunId: string;
    userId: string;
    organizationId: string;
    sequence: number;
    stepKey: string;
    label: string;
    detail?: string | null;
    status?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<AgentRunStepRecord> {
  const { data, error } = await supabase
    .from("agent_run_steps")
    .insert({
      agent_run_id: params.agentRunId,
      user_id: params.userId,
      organization_id: params.organizationId,
      sequence: params.sequence,
      step_key: params.stepKey,
      label: params.label,
      detail: params.detail ?? null,
      status: params.status ?? "pending",
      metadata: params.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to insert agent run step.");
  }

  return mapAgentRunStepRow(data as AgentRunStepRow);
}

export async function insertAgentAction(
  supabase: SupabaseClient,
  params: {
    agentRunId: string;
    agentId: string;
    userId: string;
    organizationId: string;
    sequence: number;
    toolName: string;
    actionType: string;
    summary?: string | null;
    status?: AgentActionStatus;
    actionProposalId?: string | null;
    policyDecision?: "allow" | "review" | "block" | null;
    metadata?: Record<string, unknown>;
  }
): Promise<AgentActionRecord> {
  const { data, error } = await supabase
    .from("agent_actions")
    .insert({
      agent_run_id: params.agentRunId,
      agent_id: params.agentId,
      user_id: params.userId,
      organization_id: params.organizationId,
      sequence: params.sequence,
      tool_name: params.toolName,
      action_type: params.actionType,
      summary: params.summary ?? null,
      status: params.status ?? "proposed",
      action_proposal_id: params.actionProposalId ?? null,
      policy_decision: params.policyDecision ?? null,
      metadata: params.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to insert agent action.");
  }

  return mapAgentActionRow(data as AgentActionRow);
}

export async function insertToolExecution(
  supabase: SupabaseClient,
  params: {
    agentId: string;
    userId: string;
    organizationId: string;
    toolName: string;
    agentRunId?: string | null;
    agentActionId?: string | null;
    actionProposalId?: string | null;
    status?: ToolExecutionStatus;
    input?: Record<string, unknown>;
  }
): Promise<ToolExecutionRecord> {
  const { data, error } = await supabase
    .from("tool_executions")
    .insert({
      agent_id: params.agentId,
      user_id: params.userId,
      organization_id: params.organizationId,
      tool_name: params.toolName,
      agent_run_id: params.agentRunId ?? null,
      agent_action_id: params.agentActionId ?? null,
      action_proposal_id: params.actionProposalId ?? null,
      status: params.status ?? "pending",
      input: params.input ?? {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to insert tool execution.");
  }

  return mapToolExecutionRow(data as ToolExecutionRow);
}

export async function updateToolExecution(
  supabase: SupabaseClient,
  params: {
    executionId: string;
    userId: string;
    status?: ToolExecutionStatus;
    output?: Record<string, unknown> | null;
    error?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  }
): Promise<ToolExecutionRecord> {
  const patch: Record<string, unknown> = {};
  if (params.status !== undefined) patch.status = params.status;
  if (params.output !== undefined) patch.output = params.output;
  if (params.error !== undefined) patch.error = params.error;
  if (params.startedAt !== undefined) patch.started_at = params.startedAt;
  if (params.finishedAt !== undefined) patch.finished_at = params.finishedAt;

  const { data, error } = await supabase
    .from("tool_executions")
    .update(patch)
    .eq("id", params.executionId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update tool execution.");
  }

  return mapToolExecutionRow(data as ToolExecutionRow);
}

export async function upsertAgentSchedule(
  supabase: SupabaseClient,
  params: {
    agentId: string;
    userId: string;
    organizationId: string;
    frequency: AgentScheduleRecord["frequency"];
    timezone?: string;
    scheduleConfig?: Record<string, unknown>;
    cronExpression?: string | null;
    nextRunAt?: string | null;
    enabled?: boolean;
    status?: AgentScheduleStatus;
  }
): Promise<AgentScheduleRecord> {
  const row: Record<string, unknown> = {
    agent_id: params.agentId,
    user_id: params.userId,
    organization_id: params.organizationId,
    frequency: params.frequency,
    timezone: params.timezone ?? "UTC",
    schedule_config: params.scheduleConfig ?? {},
    cron_expression: params.cronExpression ?? null,
    next_run_at: params.nextRunAt ?? null,
    enabled: params.enabled ?? false,
  };

  if (params.status) {
    row.status = params.status;
  }

  const { data, error } = await supabase
    .from("agent_schedules")
    .upsert(row, { onConflict: "agent_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to upsert agent schedule.");
  }

  return mapAgentScheduleRow(data as AgentScheduleRow);
}

export async function getAgentScheduleByAgentId(
  supabase: SupabaseClient,
  params: { agentId: string; userId: string }
): Promise<AgentScheduleRecord | null> {
  const { data, error } = await supabase
    .from("agent_schedules")
    .select("*")
    .eq("agent_id", params.agentId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load agent schedule.");
  }

  if (!data) return null;
  return mapAgentScheduleRow(data as AgentScheduleRow);
}

export async function listDueAgentSchedules(
  supabase: SupabaseClient,
  limit = 10
): Promise<AgentScheduleRecord[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("agent_schedules")
    .select("*")
    .eq("enabled", true)
    .not("next_run_at", "is", null)
    .lte("next_run_at", now)
    .neq("status", "running")
    .order("next_run_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message ?? "Failed to list due agent schedules.");
  }

  return (data ?? []).map((row) => mapAgentScheduleRow(row as AgentScheduleRow));
}

export async function claimDueAgentSchedule(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<AgentScheduleRecord | null> {
  const { data, error } = await supabase
    .from("agent_schedules")
    .update({ status: "running" })
    .eq("id", scheduleId)
    .neq("status", "running")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to claim agent schedule.");
  }

  if (!data) return null;
  return mapAgentScheduleRow(data as AgentScheduleRow);
}

export async function updateAgentScheduleAfterRun(
  supabase: SupabaseClient,
  params: {
    scheduleId: string;
    lastRunAt: string;
    nextRunAt: string | null;
    status: AgentScheduleStatus;
    enabled: boolean;
  }
): Promise<void> {
  const { error } = await supabase
    .from("agent_schedules")
    .update({
      last_run_at: params.lastRunAt,
      next_run_at: params.nextRunAt,
      status: params.status,
      enabled: params.enabled,
    })
    .eq("id", params.scheduleId);

  if (error) {
    throw new Error(error.message ?? "Failed to update agent schedule after run.");
  }
}
