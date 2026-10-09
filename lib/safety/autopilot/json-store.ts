import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import type {
  AgentApprovalRuleRecord,
  AgentExecutionLimitRecord,
  AgentSafetyPolicyRecord,
  AgentToolPermissionRecord,
  DataProtectionSettings,
  ProtectionMode,
} from "./types";
import {
  DEFAULT_DATA_PROTECTION,
  defaultApprovalRulesForAgent,
  PROTECTION_PRESETS,
} from "./presets";
import {
  AUTOPILOT_TOOL_CATALOG,
  resolveAgentAutopilotTools,
} from "./tools-catalog";

export interface AutopilotJsonPayload {
  version: 1;
  policy: {
    protectionMode: ProtectionMode;
    dataProtection: DataProtectionSettings;
    lastCheckedAt: string | null;
  };
  permissions: Array<{
    toolId: string;
    toolLabel: string;
    permissionLevel: AgentToolPermissionRecord["permissionLevel"];
    isHighRisk: boolean;
    revokedAt: string | null;
  }>;
  approvalRules: Array<{
    ruleKey: AgentApprovalRuleRecord["ruleKey"];
    enabled: boolean;
    thresholdValue: number | null;
    thresholdUnit: string | null;
  }>;
  limits: {
    maxCostPerRunUsd: number | null;
    dailySpendingCapUsd: number | null;
    maxToolCallsPerRun: number | null;
    maxExecutionTimeSeconds: number | null;
    maxRetries: number | null;
    maxMessagesPerRun: number | null;
  };
}

const STORAGE_KEY = "autopilot";

export function readAutopilotJson(
  safetySettings: Record<string, unknown> | undefined
): AutopilotJsonPayload | null {
  const raw = safetySettings?.[STORAGE_KEY];
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as AutopilotJsonPayload;
  if (payload.version !== 1) return null;
  return payload;
}

export function writeAutopilotJson(
  safetySettings: Record<string, unknown> | undefined,
  payload: AutopilotJsonPayload
): Record<string, unknown> {
  return {
    ...(safetySettings ?? {}),
    [STORAGE_KEY]: payload,
  };
}

export function createDefaultAutopilotPayload(
  agent: BuilderAgentRecord,
  mode: ProtectionMode = "balanced"
): AutopilotJsonPayload {
  const preset = PROTECTION_PRESETS[mode];
  const tools = resolveAgentAutopilotTools(agent);

  return {
    version: 1,
    policy: {
      protectionMode: mode,
      dataProtection: { ...DEFAULT_DATA_PROTECTION },
      lastCheckedAt: null,
    },
    permissions: tools.map((tool) => ({
      toolId: tool.id,
      toolLabel: tool.label,
      permissionLevel: preset.defaultToolPermission(tool),
      isHighRisk: tool.isHighRisk,
      revokedAt: null,
    })),
    approvalRules: defaultApprovalRulesForAgent(agent.id, agent.organizationId, mode).map(
      (rule) => ({
        ruleKey: rule.ruleKey,
        enabled: rule.enabled,
        thresholdValue: rule.thresholdValue,
        thresholdUnit: rule.thresholdUnit,
      })
    ),
    limits: {
      maxCostPerRunUsd: preset.limits.maxCostPerRunUsd ?? null,
      dailySpendingCapUsd: preset.limits.dailySpendingCapUsd ?? null,
      maxToolCallsPerRun: preset.limits.maxToolCallsPerRun ?? null,
      maxExecutionTimeSeconds: preset.limits.maxExecutionTimeSeconds ?? null,
      maxRetries: preset.limits.maxRetries ?? null,
      maxMessagesPerRun: preset.limits.maxMessagesPerRun ?? null,
    },
  };
}

export function jsonToPolicyRecord(
  agent: BuilderAgentRecord,
  json: AutopilotJsonPayload
): AgentSafetyPolicyRecord {
  const now = new Date().toISOString();
  return {
    id: `json-policy-${agent.id}`,
    agentId: agent.id,
    organizationId: agent.organizationId,
    protectionMode: json.policy.protectionMode,
    dataProtection: json.policy.dataProtection,
    lastCheckedAt: json.policy.lastCheckedAt,
    createdAt: now,
    updatedAt: now,
  };
}

export function jsonToPermissions(
  agent: BuilderAgentRecord,
  json: AutopilotJsonPayload
): AgentToolPermissionRecord[] {
  return json.permissions.map((perm, index) => ({
    id: `json-perm-${agent.id}-${index}`,
    agentId: agent.id,
    organizationId: agent.organizationId,
    toolId: perm.toolId,
    toolLabel: perm.toolLabel,
    permissionLevel: perm.permissionLevel,
    isHighRisk: perm.isHighRisk,
    revokedAt: perm.revokedAt,
  }));
}

export function jsonToApprovalRules(
  agent: BuilderAgentRecord,
  json: AutopilotJsonPayload
): AgentApprovalRuleRecord[] {
  return json.approvalRules.map((rule, index) => ({
    id: `json-rule-${agent.id}-${index}`,
    agentId: agent.id,
    organizationId: agent.organizationId,
    ruleKey: rule.ruleKey,
    enabled: rule.enabled,
    thresholdValue: rule.thresholdValue,
    thresholdUnit: rule.thresholdUnit,
  }));
}

export function jsonToLimits(
  agent: BuilderAgentRecord,
  json: AutopilotJsonPayload
): AgentExecutionLimitRecord {
  return {
    id: `json-limits-${agent.id}`,
    agentId: agent.id,
    organizationId: agent.organizationId,
    ...json.limits,
  };
}

export function snapshotToJson(payload: {
  policy: AgentSafetyPolicyRecord;
  permissions: AgentToolPermissionRecord[];
  approvalRules: AgentApprovalRuleRecord[];
  limits: AgentExecutionLimitRecord;
}): AutopilotJsonPayload {
  return {
    version: 1,
    policy: {
      protectionMode: payload.policy.protectionMode,
      dataProtection: payload.policy.dataProtection,
      lastCheckedAt: payload.policy.lastCheckedAt,
    },
    permissions: payload.permissions.map((p) => ({
      toolId: p.toolId,
      toolLabel: p.toolLabel,
      permissionLevel: p.permissionLevel,
      isHighRisk: p.isHighRisk,
      revokedAt: p.revokedAt,
    })),
    approvalRules: payload.approvalRules.map((r) => ({
      ruleKey: r.ruleKey,
      enabled: r.enabled,
      thresholdValue: r.thresholdValue,
      thresholdUnit: r.thresholdUnit,
    })),
    limits: {
      maxCostPerRunUsd: payload.limits.maxCostPerRunUsd,
      dailySpendingCapUsd: payload.limits.dailySpendingCapUsd,
      maxToolCallsPerRun: payload.limits.maxToolCallsPerRun,
      maxExecutionTimeSeconds: payload.limits.maxExecutionTimeSeconds,
      maxRetries: payload.limits.maxRetries,
      maxMessagesPerRun: payload.limits.maxMessagesPerRun,
    },
  };
}

/** Ensure catalog tools exist in permissions list after agent tool changes. */
export function syncPermissionsWithAgentTools(
  agent: BuilderAgentRecord,
  permissions: AgentToolPermissionRecord[],
  mode: ProtectionMode
): AgentToolPermissionRecord[] {
  const preset = PROTECTION_PRESETS[mode];
  const tools = resolveAgentAutopilotTools(agent);
  const byId = new Map(permissions.map((p) => [p.toolId, p]));

  return tools.map((tool, index) => {
    const existing = byId.get(tool.id);
    if (existing) {
      return {
        ...existing,
        toolLabel: tool.label,
        isHighRisk: tool.isHighRisk,
      };
    }
    return {
      id: `json-perm-${agent.id}-${index}`,
      agentId: agent.id,
      organizationId: agent.organizationId,
      toolId: tool.id,
      toolLabel: tool.label,
      permissionLevel: preset.defaultToolPermission(tool),
      isHighRisk: tool.isHighRisk,
      revokedAt: null,
    };
  });
}

export function allCatalogToolIds(): string[] {
  return AUTOPILOT_TOOL_CATALOG.map((t) => t.id);
}
