import type {
  AgentActionRecord,
  AgentActionStatus,
  AgentCapabilityEntry,
  AgentRecordStatus,
  AgentRunLimits,
  AgentRunMode,
  AgentRunRecord,
  AgentRunStatus,
  AgentRunStepRecord,
  AgentSafetySettings,
  AgentScheduleConfig,
  AgentScheduleFrequency,
  AgentScheduleRecord,
  BuilderAgentRecord,
  ToolExecutionRecord,
  ToolExecutionStatus,
} from "./runtime-types";

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseCapabilities(value: unknown): AgentCapabilityEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is AgentCapabilityEntry =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as AgentCapabilityEntry).id === "string" &&
      typeof (item as AgentCapabilityEntry).label === "string"
  );
}

function parseSchedule(value: unknown): AgentScheduleConfig {
  return parseJsonObject(value) as AgentScheduleConfig;
}

function parseSafetySettings(value: unknown): AgentSafetySettings {
  return parseJsonObject(value) as AgentSafetySettings;
}

function parseRunLimits(value: unknown): AgentRunLimits {
  return parseJsonObject(value) as AgentRunLimits;
}

const AGENT_RECORD_STATUSES: readonly AgentRecordStatus[] = [
  "draft",
  "active",
  "archived",
  "testing",
  "published",
  "paused",
];

export interface AgentRow {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string;
  goal?: string | null;
  instructions?: string | null;
  model?: string | null;
  source: string;
  tools: string[] | unknown;
  capabilities?: unknown;
  trigger_type: string;
  schedule?: unknown;
  timezone?: string;
  memory_enabled?: boolean;
  safety_settings?: unknown;
  suggested_threshold: number | null;
  status: AgentRecordStatus;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

function readStringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function isAgentRecordStatus(value: unknown): value is AgentRecordStatus {
  return (
    typeof value === "string" &&
    (AGENT_RECORD_STATUSES as readonly string[]).includes(value)
  );
}

/** Validate a generic Supabase agents row before mapping. */
export function parseAgentRow(value: unknown): AgentRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = readStringField(row, "id");
  const userId = readStringField(row, "user_id");
  const organizationId = readStringField(row, "organization_id");
  const name = readStringField(row, "name");
  const slug = readStringField(row, "slug");
  const source = readStringField(row, "source");
  const createdAt = readStringField(row, "created_at");
  const updatedAt = readStringField(row, "updated_at");
  if (
    !id ||
    !userId ||
    !organizationId ||
    !name ||
    !slug ||
    !source ||
    !createdAt ||
    !updatedAt ||
    !isAgentRecordStatus(row.status)
  ) {
    return null;
  }

  const description = typeof row.description === "string" ? row.description : "";
  const triggerType = typeof row.trigger_type === "string" && row.trigger_type.trim()
    ? row.trigger_type
    : "webhook";
  const suggestedThreshold =
    typeof row.suggested_threshold === "number"
      ? row.suggested_threshold
      : row.suggested_threshold === null || row.suggested_threshold === undefined
        ? null
        : null;

  return {
    id,
    user_id: userId,
    organization_id: organizationId,
    name,
    slug,
    description,
    goal: typeof row.goal === "string" || row.goal === null ? row.goal : null,
    instructions:
      typeof row.instructions === "string" || row.instructions === null
        ? row.instructions
        : null,
    model: typeof row.model === "string" || row.model === null ? row.model : null,
    source,
    tools: row.tools,
    capabilities: row.capabilities,
    trigger_type: triggerType,
    schedule: row.schedule,
    timezone: typeof row.timezone === "string" ? row.timezone : undefined,
    memory_enabled: typeof row.memory_enabled === "boolean" ? row.memory_enabled : undefined,
    safety_settings: row.safety_settings,
    suggested_threshold: suggestedThreshold,
    status: row.status,
    published_at:
      typeof row.published_at === "string" || row.published_at === null
        ? row.published_at
        : null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function mapUnknownAgentRow(value: unknown): BuilderAgentRecord | null {
  const parsed = parseAgentRow(value);
  return parsed ? mapAgentRow(parsed) : null;
}

export function mapAgentRowOrThrow(value: unknown, fallbackMessage: string): BuilderAgentRecord {
  const mapped = mapUnknownAgentRow(value);
  if (!mapped) {
    throw new Error(fallbackMessage);
  }
  return mapped;
}

export function mapAgentRow(row: AgentRow): BuilderAgentRecord {
  const tools = Array.isArray(row.tools)
    ? row.tools.filter((tool): tool is string => typeof tool === "string")
    : [];

  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    goal: row.goal ?? null,
    instructions: row.instructions ?? null,
    model: row.model ?? null,
    source: row.source,
    tools,
    capabilities: parseCapabilities(row.capabilities),
    triggerType: row.trigger_type as BuilderAgentRecord["triggerType"],
    schedule: parseSchedule(row.schedule),
    timezone: row.timezone ?? "UTC",
    memoryEnabled: row.memory_enabled ?? false,
    safetySettings: parseSafetySettings(row.safety_settings),
    suggestedThreshold: row.suggested_threshold,
    status: row.status,
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AgentRunRow {
  id: string;
  agent_id: string;
  user_id: string;
  organization_id: string;
  status: AgentRunStatus;
  mode: AgentRunMode;
  trigger_source: string | null;
  summary: string | null;
  error_message: string | null;
  limits: unknown;
  metadata: unknown;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapAgentRunRow(row: AgentRunRow): AgentRunRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    status: row.status,
    mode: row.mode,
    triggerSource: row.trigger_source,
    summary: row.summary,
    errorMessage: row.error_message,
    limits: parseRunLimits(row.limits),
    metadata: parseJsonObject(row.metadata),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AgentRunStepRow {
  id: string;
  agent_run_id: string;
  organization_id: string;
  user_id: string;
  sequence: number;
  step_key: string;
  label: string;
  detail: string | null;
  status: string;
  metadata: unknown;
  created_at: string;
}

export function mapAgentRunStepRow(row: AgentRunStepRow): AgentRunStepRecord {
  return {
    id: row.id,
    agentRunId: row.agent_run_id,
    organizationId: row.organization_id,
    userId: row.user_id,
    sequence: row.sequence,
    stepKey: row.step_key,
    label: row.label,
    detail: row.detail,
    status: row.status,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
  };
}

export interface AgentActionRow {
  id: string;
  agent_run_id: string;
  agent_id: string;
  user_id: string;
  organization_id: string;
  action_proposal_id: string | null;
  sequence: number;
  tool_name: string;
  action_type: string;
  summary: string | null;
  status: AgentActionStatus;
  policy_decision: "allow" | "review" | "block" | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

export function mapAgentActionRow(row: AgentActionRow): AgentActionRecord {
  return {
    id: row.id,
    agentRunId: row.agent_run_id,
    agentId: row.agent_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    actionProposalId: row.action_proposal_id,
    sequence: row.sequence,
    toolName: row.tool_name,
    actionType: row.action_type,
    summary: row.summary,
    status: row.status,
    policyDecision: row.policy_decision,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ToolExecutionRow {
  id: string;
  agent_run_id: string | null;
  agent_action_id: string | null;
  action_proposal_id: string | null;
  agent_id: string;
  user_id: string;
  organization_id: string;
  tool_name: string;
  status: ToolExecutionStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapToolExecutionRow(row: ToolExecutionRow): ToolExecutionRecord {
  const output = row.output;
  return {
    id: row.id,
    agentRunId: row.agent_run_id,
    agentActionId: row.agent_action_id,
    actionProposalId: row.action_proposal_id,
    agentId: row.agent_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    toolName: row.tool_name,
    status: row.status,
    input: parseJsonObject(row.input),
    output:
      typeof output === "object" && output !== null && !Array.isArray(output)
        ? (output as Record<string, unknown>)
        : null,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AgentScheduleRow {
  id: string;
  agent_id: string;
  user_id: string;
  organization_id: string;
  frequency: AgentScheduleFrequency;
  timezone: string;
  schedule_config: unknown;
  cron_expression: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  enabled: boolean;
  status?: string | null;
  created_at: string;
  updated_at: string;
}

export function mapAgentScheduleRow(row: AgentScheduleRow): AgentScheduleRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    frequency: row.frequency,
    timezone: row.timezone,
    scheduleConfig: parseSchedule(row.schedule_config),
    cronExpression: row.cron_expression,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    enabled: row.enabled,
    status: (row.status as AgentScheduleRecord["status"]) ?? "idle",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
