import { buildPolicyEvaluationContext } from "@/lib/gateway/policy/context";
import type { LoadedAgent } from "@/lib/agents/runtime/types";
import type { AgentMission, MissionRestriction } from "@/lib/agents/runtime-types";
import {
  hasExplicitMissionLock,
  isFinancialTool,
  isReadOnlyTool,
  resolveAgentMission,
} from "./mission";

export interface MissionValidationInput {
  agent: LoadedAgent;
  tool: string;
  action: string;
  parameters: Record<string, unknown>;
}

export interface MissionValidationResult {
  allowed: boolean;
  reason: string;
  violatedRule?: string;
  /** When set, mission lock escalates to approval instead of hard block. */
  requiresApproval?: boolean;
}

const OUTSIDE_MISSION_MESSAGE =
  "This action is outside the agent's configured mission.";

function logMission(
  phase: "checked" | "allowed" | "blocked",
  params: {
    agentId: string;
    tool: string;
    action: string;
    reason: string;
    violatedRule?: string;
  }
): void {
  const label =
    phase === "checked"
      ? "action checked"
      : phase === "allowed"
        ? "action allowed"
        : "action blocked";

  console.info(`[safety][mission] ${label}`, {
    agentId: params.agentId,
    tool: params.tool,
    action: params.action,
    violatedRule: params.violatedRule ?? null,
    reason: params.reason.slice(0, 200),
  });
}

function blockResult(violatedRule: string, detail: string): MissionValidationResult {
  return {
    allowed: false,
    reason: `${OUTSIDE_MISSION_MESSAGE} ${detail}`,
    violatedRule,
  };
}

function checkResourceRestrictions(
  mission: AgentMission,
  context: ReturnType<typeof buildPolicyEvaluationContext>,
  tool: string
): MissionValidationResult | null {
  const resources = mission.resourceRestrictions;
  if (!resources) return null;

  const resourceType = context.resourceType?.toLowerCase();
  const environment = context.environment?.toLowerCase();

  if (
    resources.blockedResourceTypes?.length &&
    resourceType &&
    resources.blockedResourceTypes.some(
      (blocked) => blocked.toLowerCase() === resourceType
    )
  ) {
    return blockResult(
      "mission.resource.blocked_type",
      `Resource type "${resourceType}" is not permitted for this mission.`
    );
  }

  if (
    resources.allowedResourceTypes?.length &&
    resourceType &&
    !resources.allowedResourceTypes.some(
      (allowed) => allowed.toLowerCase() === resourceType
    )
  ) {
    return blockResult(
      "mission.resource.allowed_types",
      `Resource type "${resourceType}" is not in the mission allowlist.`
    );
  }

  if (
    resources.blockedEnvironments?.length &&
    environment &&
    resources.blockedEnvironments.some(
      (blocked) => blocked.toLowerCase() === environment
    )
  ) {
    return blockResult(
      "mission.resource.blocked_environment",
      `Environment "${environment}" is not permitted for this mission.`
    );
  }

  if (
    resources.allowedEnvironments?.length &&
    environment &&
    !resources.allowedEnvironments.some(
      (allowed) => allowed.toLowerCase() === environment
    )
  ) {
    return blockResult(
      "mission.resource.allowed_environments",
      `Environment "${environment}" is not in the mission allowlist.`
    );
  }

  if (
    resources.maxEmailRecipients !== undefined &&
    tool === "send_email" &&
    context.dataExportSize !== undefined &&
    context.dataExportSize > resources.maxEmailRecipients
  ) {
    return blockResult(
      "mission.resource.max_email_recipients",
      `Email recipient count exceeds the mission limit of ${resources.maxEmailRecipients}.`
    );
  }

  return null;
}

function checkRestriction(
  restriction: MissionRestriction,
  params: {
    tool: string;
    action: string;
    parameters: Record<string, unknown>;
    context: ReturnType<typeof buildPolicyEvaluationContext>;
  }
): MissionValidationResult | null {
  const { tool, action, parameters, context } = params;

  switch (restriction) {
    case "no_destructive_operations":
    case "no_file_deletion":
      if (context.destructiveOperation) {
        return blockResult(
          `mission.restriction.${restriction}`,
          "Destructive operations are restricted by this mission."
        );
      }
      break;

    case "no_financial_actions":
    case "no_payments":
      if (isFinancialTool(tool)) {
        return blockResult(
          `mission.restriction.${restriction}`,
          "Financial or payment actions are restricted by this mission."
        );
      }
      break;

    case "no_database_modifications": {
      const resourceType = context.resourceType?.toLowerCase();
      const isDatabase =
        resourceType === "database" ||
        tool === "query_supabase" ||
        action.includes("database");
      const method =
        typeof parameters.method === "string"
          ? parameters.method.trim().toUpperCase()
          : undefined;

      if (
        isDatabase &&
        (context.destructiveOperation ||
          method === "POST" ||
          method === "PUT" ||
          method === "PATCH" ||
          method === "DELETE")
      ) {
        return blockResult(
          "mission.restriction.no_database_modifications",
          "Database modifications are restricted by this mission."
        );
      }
      break;
    }

    case "no_unrelated_communications":
      if (
        tool === "send_email" &&
        context.dataExportSize !== undefined &&
        context.dataExportSize > 1
      ) {
        return blockResult(
          "mission.restriction.no_unrelated_communications",
          "Bulk or multi-recipient email is restricted by this mission."
        );
      }
      break;

    case "read_only_tools_only":
      if (!isReadOnlyTool(tool)) {
        return {
          allowed: false,
          reason:
            "This action requires approval because the mission is limited to read-only capabilities.",
          violatedRule: "mission.restriction.read_only_tools_only",
          requiresApproval: true,
        };
      }
      break;
  }

  return null;
}

/**
 * Server-side mission lock validation.
 * Agents without an explicit mission configuration pass through (backward compatible).
 */
export function validateMissionAction(
  input: MissionValidationInput
): MissionValidationResult {
  const tool = input.tool.trim();
  const action = input.action.trim();
  const agentId = input.agent.record.id;

  logMission("checked", {
    agentId,
    tool,
    action,
    reason: hasExplicitMissionLock(input.agent)
      ? "explicit mission lock active"
      : "no explicit mission lock",
  });

  if (!hasExplicitMissionLock(input.agent)) {
    const pass: MissionValidationResult = {
      allowed: true,
      reason: "No explicit mission lock configured.",
    };
    logMission("allowed", { agentId, tool, action, reason: pass.reason });
    return pass;
  }

  const mission = resolveAgentMission(input.agent);
  const context = buildPolicyEvaluationContext({
    toolName: tool,
    actionType: action,
    payload: input.parameters,
  });

  if (mission.allowedTools.length > 0 && !mission.allowedTools.includes(tool)) {
    const result = blockResult(
      "mission.allowed_tools",
      `Tool "${tool}" is not in the mission allowlist.`
    );
    logMission("blocked", {
      agentId,
      tool,
      action,
      reason: result.reason,
      violatedRule: result.violatedRule,
    });
    return result;
  }

  if (
    mission.allowedActions &&
    mission.allowedActions.length > 0 &&
    !mission.allowedActions.includes(action)
  ) {
    const result = blockResult(
      "mission.allowed_actions",
      `Action "${action}" is not in the mission allowlist.`
    );
    logMission("blocked", {
      agentId,
      tool,
      action,
      reason: result.reason,
      violatedRule: result.violatedRule,
    });
    return result;
  }

  const resourceViolation = checkResourceRestrictions(mission, context, tool);
  if (resourceViolation) {
    logMission("blocked", {
      agentId,
      tool,
      action,
      reason: resourceViolation.reason,
      violatedRule: resourceViolation.violatedRule,
    });
    return resourceViolation;
  }

  for (const restriction of mission.restrictions) {
    const violation = checkRestriction(restriction, {
      tool,
      action,
      parameters: input.parameters,
      context,
    });
    if (violation) {
      logMission("blocked", {
        agentId,
        tool,
        action,
        reason: violation.reason,
        violatedRule: violation.violatedRule,
      });
      return violation;
    }
  }

  const pass: MissionValidationResult = {
    allowed: true,
    reason: "Action is within the agent mission scope.",
  };
  logMission("allowed", { agentId, tool, action, reason: pass.reason });
  return pass;
}
