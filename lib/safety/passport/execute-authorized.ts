import type { SupabaseClient } from "@supabase/supabase-js";
import { executeRegisteredTool } from "@/lib/agents/tools/registry";
import type { ToolExecutionOutcome, ToolHandlerContext } from "@/lib/agents/runtime/types";
import type { SafetyDecision } from "@/lib/safety/types";
import {
  consumeActionPassport,
  createActionPassport,
  verifyActionPassport,
} from "./service";
import {
  ACTION_HASH_MISMATCH_MESSAGE,
  PASSPORT_MISMATCH_MESSAGE,
} from "./constants";

export interface ExecuteAuthorizedToolParams {
  admin: SupabaseClient;
  toolName: string;
  toolInput: Record<string, unknown>;
  actionType: string;
  context: ToolHandlerContext;
  safetyDecision: SafetyDecision;
  missionGoal?: string | null;
  agentActionId?: string | null;
}

function blockedOutcome(reason: string): ToolExecutionOutcome {
  return {
    executed: false,
    error: reason,
    output: { blocked: true, reason: "action_passport" },
  };
}

/**
 * Creates an Action Passport, verifies it, consumes it single-use, then executes the tool.
 * REQUIRE_APPROVAL paths must not call this until approval exists (safetyDecision === ALLOW).
 */
export async function executeAuthorizedTool(
  params: ExecuteAuthorizedToolParams
): Promise<ToolExecutionOutcome> {
  if (params.safetyDecision !== "ALLOW") {
    return blockedOutcome("Tool execution requires an ALLOW safety decision.");
  }

  const passport = await createActionPassport(
    {
      organizationId: params.context.organizationId,
      builderAgentId: params.context.agent.record.id,
      gatewayAgentId: params.context.agent.gatewayAgentId,
      agentRunId: params.context.runId,
      agentActionId: params.agentActionId ?? null,
      tool: params.toolName,
      action: params.actionType,
      parameters: params.toolInput,
      missionGoal: params.missionGoal ?? null,
      safetyDecision: "ALLOW",
    },
    params.admin
  );

  const verifyInput = {
    passportId: passport.passportId,
    organizationId: params.context.organizationId,
    builderAgentId: params.context.agent.record.id,
    gatewayAgentId: params.context.agent.gatewayAgentId,
    agentRunId: params.context.runId,
    missionGoal: params.missionGoal ?? null,
    safetyDecision: params.safetyDecision,
    tool: params.toolName,
    action: params.actionType,
    parameters: params.toolInput,
  };

  const verified = await verifyActionPassport(verifyInput, params.admin);
  if (!verified.valid) {
    return blockedOutcome(
      verified.reason || ACTION_HASH_MISMATCH_MESSAGE || PASSPORT_MISMATCH_MESSAGE
    );
  }

  const consumed = await consumeActionPassport(verifyInput, params.admin);
  if (!consumed.valid) {
    return blockedOutcome(consumed.reason || PASSPORT_MISMATCH_MESSAGE);
  }

  return executeRegisteredTool(params.toolName, params.toolInput, params.context);
}
