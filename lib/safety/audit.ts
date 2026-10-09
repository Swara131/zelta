import type { SupabaseClient } from "@supabase/supabase-js";
import {
  recordRuntimeAuditEventAsync,
  type RuntimeAuditEventName,
} from "@/lib/gateway/audit/runtime-events";
import type { SafetyDecision, SafetyEvaluationContext, SafetyEvaluationResult } from "./types";

function runtimeEventForDecision(decision: SafetyDecision): RuntimeAuditEventName {
  switch (decision) {
    case "ALLOW":
      return "policy.allow";
    case "BLOCK":
      return "policy.block";
    case "REQUIRE_APPROVAL":
      return "policy.review";
  }
}

export function recordSafetyDecisionAudit(
  admin: SupabaseClient,
  context: SafetyEvaluationContext,
  result: SafetyEvaluationResult,
  params: {
    organizationId: string;
    proposalId?: string | null;
  }
): void {
  recordRuntimeAuditEventAsync(admin, {
    organizationId: params.organizationId,
    proposalId: params.proposalId ?? null,
    event: runtimeEventForDecision(result.decision),
    agentId: context.agent.gatewayAgentId,
    metadata: {
      safetyLayer: true,
      builderAgentId: context.agent.record.id,
      agentRunId: context.runId ?? null,
      agentActionId: context.actionId ?? null,
      toolName: context.tool,
      actionType: context.action,
      parameters: result.sanitizedParameters,
      decision: result.decision,
      reason: result.reason,
      policyId: result.policyId,
      riskLevel: result.riskLevel,
      riskScore: result.riskScore,
      source: context.source ?? "agent_runtime",
      missionGoal: result.mission.goal,
    },
  });
}
