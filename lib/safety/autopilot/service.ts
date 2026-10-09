import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAgentDbDisplayStatus } from "@/lib/agents/agent-mode";
import { updateBuilderAgent } from "@/lib/agents/repository";
import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import { insertAuditLog } from "@/lib/audit/repository";
import {
  buildPolicySummary,
  evaluateSafetyPolicy,
} from "./evaluate-safety-policy";
import {
  createDefaultAutopilotPayload,
  jsonToApprovalRules,
  jsonToLimits,
  jsonToPermissions,
  jsonToPolicyRecord,
  readAutopilotJson,
  snapshotToJson,
  syncPermissionsWithAgentTools,
  writeAutopilotJson,
} from "./json-store";
import {
  DEFAULT_DATA_PROTECTION,
  PROTECTION_PRESETS,
  protectionModeIncreasesRisk,
} from "./presets";
import {
  deleteSampleIncidents,
  insertSafetyIncident,
  listSafetyIncidents,
} from "./repository";
import { getAutopilotTool } from "./tools-catalog";
import { buildSampleIncidents } from "./sample-incidents";
import type {
  AgentApprovalRuleRecord,
  AgentExecutionLimitRecord,
  AgentSafetyPolicyRecord,
  AgentToolPermissionRecord,
  ApprovalRuleKey,
  DataProtectionSettings,
  EmergencyAction,
  ProtectionMode,
  SafetyAutopilotSnapshot,
  SafetyRecommendation,
  ToolPermissionLevel,
} from "./types";

async function persistAutopilot(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  snapshot: {
    policy: AgentSafetyPolicyRecord;
    permissions: AgentToolPermissionRecord[];
    approvalRules: AgentApprovalRuleRecord[];
    limits: AgentExecutionLimitRecord;
  }
): Promise<BuilderAgentRecord> {
  const json = snapshotToJson(snapshot);
  json.policy.lastCheckedAt = new Date().toISOString();

  return updateBuilderAgent(supabase, {
    agentId: agent.id,
    userId: agent.userId,
    patch: {
      safetySettings: writeAutopilotJson(
        agent.safetySettings as Record<string, unknown>,
        json
      ),
    },
  });
}

async function loadSnapshotParts(agent: BuilderAgentRecord): Promise<{
  policy: AgentSafetyPolicyRecord;
  permissions: AgentToolPermissionRecord[];
  approvalRules: AgentApprovalRuleRecord[];
  limits: AgentExecutionLimitRecord;
}> {
  let json = readAutopilotJson(agent.safetySettings as Record<string, unknown>);
  if (!json) {
    json = createDefaultAutopilotPayload(agent, "balanced");
  }

  const policy = jsonToPolicyRecord(agent, json);
  const permissions = syncPermissionsWithAgentTools(
    agent,
    jsonToPermissions(agent, json),
    policy.protectionMode
  );
  const approvalRules = jsonToApprovalRules(agent, json);
  const limits = jsonToLimits(agent, json);

  return { policy, permissions, approvalRules, limits };
}

export async function loadSafetyAutopilot(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  filters?: { severity?: string; tool?: string; from?: string; to?: string }
): Promise<SafetyAutopilotSnapshot> {
  const parts = await loadSnapshotParts(agent);
  const evaluation = evaluateSafetyPolicy(parts);

  const { incidents, tableAvailable } = await listSafetyIncidents(supabase, {
    agentId: agent.id,
    organizationId: agent.organizationId,
    severity: filters?.severity as never,
    tool: filters?.tool,
    from: filters?.from,
    to: filters?.to,
  });

  let resolvedIncidents = incidents;
  let hasSampleIncidents = false;

  if (!tableAvailable || incidents.length === 0) {
    resolvedIncidents = buildSampleIncidents(agent.id, agent.organizationId);
    hasSampleIncidents = true;
  } else {
    hasSampleIncidents = incidents.some((i) => i.isSample);
  }

  return {
    agent: {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      status: agent.status,
      displayStatus: resolveAgentDbDisplayStatus(agent.status),
    },
    policy: {
      ...parts.policy,
      lastCheckedAt: new Date().toISOString(),
    },
    permissions: parts.permissions,
    approvalRules: parts.approvalRules,
    limits: parts.limits,
    evaluation,
    policySummary: buildPolicySummary(parts.approvalRules, parts.limits),
    incidents: resolvedIncidents,
    hasSampleIncidents,
  };
}

export async function updateProtectionMode(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  mode: ProtectionMode,
  confirmRiskIncrease?: boolean
): Promise<SafetyAutopilotSnapshot> {
  const parts = await loadSnapshotParts(agent);
  if (
    protectionModeIncreasesRisk(parts.policy.protectionMode, mode) &&
    !confirmRiskIncrease
  ) {
    throw new ProtectionModeConfirmRequiredError(parts.policy.protectionMode, mode);
  }

  const preset = PROTECTION_PRESETS[mode];
  parts.policy.protectionMode = mode;
  parts.permissions = parts.permissions.map((perm) => {
    const tool = getAutopilotTool(perm.toolId);
    return {
      ...perm,
      permissionLevel: tool ? preset.defaultToolPermission(tool) : perm.permissionLevel,
      revokedAt: null,
    };
  });

  await persistAutopilot(supabase, agent, parts);
  const updatedAgent = { ...agent, safetySettings: writeAutopilotJson(agent.safetySettings as Record<string, unknown>, snapshotToJson(parts)) };
  return loadSafetyAutopilot(supabase, updatedAgent as BuilderAgentRecord);
}

export class ProtectionModeConfirmRequiredError extends Error {
  constructor(
    public readonly from: ProtectionMode,
    public readonly to: ProtectionMode
  ) {
    super("Confirm risk increase before switching protection mode.");
    this.name = "ProtectionModeConfirmRequiredError";
  }
}

export async function updateToolPermission(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  toolId: string,
  permissionLevel: ToolPermissionLevel,
  confirmAutomatic?: boolean
): Promise<SafetyAutopilotSnapshot> {
  const parts = await loadSnapshotParts(agent);
  const perm = parts.permissions.find((p) => p.toolId === toolId);
  if (!perm) throw new Error("Tool not found for this agent.");

  if (permissionLevel === "automatic" && perm.isHighRisk && !confirmAutomatic) {
    throw new AutomaticPermissionConfirmRequiredError(toolId);
  }

  perm.permissionLevel = permissionLevel;
  if (permissionLevel === "disabled") {
    perm.revokedAt = new Date().toISOString();
  } else {
    perm.revokedAt = null;
  }

  await persistAutopilot(supabase, agent, parts);
  return loadSafetyAutopilot(supabase, agent);
}

export class AutomaticPermissionConfirmRequiredError extends Error {
  constructor(public readonly toolId: string) {
    super("Confirm automatic permission for high-risk tool.");
    this.name = "AutomaticPermissionConfirmRequiredError";
  }
}

export async function updateApprovalRules(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  rules: Array<{
    ruleKey: ApprovalRuleKey;
    enabled: boolean;
    thresholdValue?: number | null;
    thresholdUnit?: string | null;
  }>
): Promise<SafetyAutopilotSnapshot> {
  const parts = await loadSnapshotParts(agent);
  for (const incoming of rules) {
    const rule = parts.approvalRules.find((r) => r.ruleKey === incoming.ruleKey);
    if (!rule) continue;
    rule.enabled = incoming.enabled;
    if (incoming.thresholdValue !== undefined) rule.thresholdValue = incoming.thresholdValue;
    if (incoming.thresholdUnit !== undefined) rule.thresholdUnit = incoming.thresholdUnit;
  }
  await persistAutopilot(supabase, agent, parts);
  return loadSafetyAutopilot(supabase, agent);
}

export async function updateDataProtection(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  settings: DataProtectionSettings
): Promise<SafetyAutopilotSnapshot> {
  const parts = await loadSnapshotParts(agent);
  parts.policy.dataProtection = settings;
  await persistAutopilot(supabase, agent, parts);
  return loadSafetyAutopilot(supabase, agent);
}

export async function updateExecutionLimits(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  limits: Partial<AgentExecutionLimitRecord>
): Promise<SafetyAutopilotSnapshot> {
  const parts = await loadSnapshotParts(agent);
  parts.limits = { ...parts.limits, ...limits };
  await persistAutopilot(supabase, agent, parts);
  return loadSafetyAutopilot(supabase, agent);
}

export async function applyRecommendationFix(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  recommendation: SafetyRecommendation
): Promise<SafetyAutopilotSnapshot> {
  const parts = await loadSnapshotParts(agent);

  switch (recommendation.fixAction) {
    case "set_tool_permission": {
      const toolId = recommendation.fixPayload?.toolId as string;
      const level = recommendation.fixPayload?.permissionLevel as ToolPermissionLevel;
      const perm = parts.permissions.find((p) => p.toolId === toolId);
      if (perm) perm.permissionLevel = level;
      break;
    }
    case "enable_data_protection": {
      const key = recommendation.fixPayload?.key as keyof DataProtectionSettings;
      parts.policy.dataProtection = {
        ...parts.policy.dataProtection,
        [key]: true,
      };
      break;
    }
    case "enable_approval_rule": {
      const ruleKey = recommendation.fixPayload?.ruleKey as ApprovalRuleKey;
      const rule = parts.approvalRules.find((r) => r.ruleKey === ruleKey);
      if (rule) rule.enabled = true;
      break;
    }
    case "set_limit": {
      const field = recommendation.fixPayload?.field;
      const value = recommendation.fixPayload?.value;
      if (typeof field !== "string" || typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("Unknown fix action.");
      }
      if (field === "maxCostPerRunUsd") parts.limits.maxCostPerRunUsd = value;
      else if (field === "dailySpendingCapUsd") parts.limits.dailySpendingCapUsd = value;
      else if (field === "maxToolCallsPerRun") parts.limits.maxToolCallsPerRun = value;
      else if (field === "maxExecutionTimeSeconds") parts.limits.maxExecutionTimeSeconds = value;
      else if (field === "maxRetries") parts.limits.maxRetries = value;
      else if (field === "maxMessagesPerRun") parts.limits.maxMessagesPerRun = value;
      else throw new Error("Unknown fix action.");
      break;
    }
    default:
      throw new Error("Unknown fix action.");
  }

  await persistAutopilot(supabase, agent, parts);
  return loadSafetyAutopilot(supabase, agent);
}

export async function fixAllRecommendations(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord
): Promise<SafetyAutopilotSnapshot> {
  const parts = await loadSnapshotParts(agent);
  const evaluation = evaluateSafetyPolicy(parts);

  for (const rec of evaluation.recommendations) {
    try {
      await applyRecommendationFix(supabase, agent, rec);
    } catch {
      // continue with remaining fixes
    }
  }

  return loadSafetyAutopilot(supabase, agent);
}

export async function executeEmergencyAction(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  action: EmergencyAction,
  userId: string,
  ipAddress?: string | null
): Promise<SafetyAutopilotSnapshot> {
  const parts = await loadSnapshotParts(agent);

  switch (action) {
    case "pause_agent":
      await updateBuilderAgent(supabase, {
        agentId: agent.id,
        userId: agent.userId,
        patch: { status: "paused" },
      });
      break;
    case "resume_agent":
      await updateBuilderAgent(supabase, {
        agentId: agent.id,
        userId: agent.userId,
        patch: { status: "active" },
      });
      break;
    case "revoke_permissions":
      parts.permissions = parts.permissions.map((p) => ({
        ...p,
        permissionLevel: "disabled",
        revokedAt: new Date().toISOString(),
      }));
      await persistAutopilot(supabase, agent, parts);
      break;
    case "kill_active_runs": {
      await supabase
        .from("agent_runs")
        .update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("agent_id", agent.id)
        .in("status", ["pending", "running", "awaiting_approval"]);
      break;
    }
  }

  await insertAuditLog(supabase, {
    organizationId: agent.organizationId,
    userId,
    action: "update",
    entityType: "agent_safety_emergency",
    entityId: agent.id,
    metadata: {
      title: `Emergency: ${action.replace(/_/g, " ")}`,
      description: `Emergency control "${action}" applied to agent ${agent.name}.`,
      agentSlug: agent.slug,
      emergencyAction: action,
    },
    ipAddress: ipAddress ?? null,
  });

  await insertSafetyIncident(supabase, {
    agentId: agent.id,
    organizationId: agent.organizationId,
    userId,
    severity: action === "kill_active_runs" ? "critical" : "warning",
    title: `Emergency: ${action.replace(/_/g, " ")}`,
    explanation: `An authorized user triggered the ${action.replace(/_/g, " ")} control.`,
    relatedTool: null,
    runId: null,
    actionTaken: action,
    isSample: false,
  });

  return loadSafetyAutopilot(supabase, agent);
}

export async function ensureDefaultAutopilot(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord
): Promise<void> {
  if (readAutopilotJson(agent.safetySettings as Record<string, unknown>)) return;
  const parts = await loadSnapshotParts(agent);
  parts.policy.dataProtection = { ...DEFAULT_DATA_PROTECTION };
  await persistAutopilot(supabase, agent, parts);
}

export { deleteSampleIncidents };
