import { evaluateToolThroughControlLayer } from "./control/control-layer";
import { executeAuthorizedTool } from "@/lib/safety/passport/execute-authorized";
import { resolveAgentMission } from "@/lib/safety/mission";
import { bindApprovalPassport } from "@/lib/safety/approval-gate/gate";
import { getActionProposalById } from "@/lib/gateway/proposals/repository";
import { effectiveReviewDeadline } from "@/lib/gateway/review/timeout";
import { resolveActionType } from "./tools/definitions";
import { assertToolEnabledForAgent } from "./tools/registry";
import type { RuntimeActivityLogger } from "./activity/activity-logger";
import type { LoadedAgent, RunAgentResult, ToolExecutionOutcome } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PendingRuntimeApproval } from "../protection/types";
import { toolStepLabel } from "./model/task-intent";

function mapControlDecision(
  decision: "ALLOW" | "REVIEW" | "BLOCK"
): "allow" | "review" | "block" {
  return decision.toLowerCase() as "allow" | "review" | "block";
}

function mapActionStatus(
  decision: "ALLOW" | "REVIEW" | "BLOCK"
): "allowed" | "review_required" | "blocked" {
  if (decision === "ALLOW") return "allowed";
  if (decision === "BLOCK") return "blocked";
  return "review_required";
}

export type ProtectedToolResult =
  | { kind: "executed"; outcome: ToolExecutionOutcome; toolCalls: number }
  | { kind: "awaiting_approval"; result: RunAgentResult }
  | { kind: "failed"; result: RunAgentResult }
  | { kind: "blocked"; reason: string; toolCalls: number };

export async function executeProtectedTool(params: {
  admin: SupabaseClient;
  agent: LoadedAgent;
  userId: string;
  runId: string | null;
  task: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  activity: RuntimeActivityLogger;
  toolCalls: number;
  actionSequence: number;
  turns: number;
  maxRetries: number;
  messages?: Array<{ role: string; content: string }>;
  workflowNodeIndex?: number;
  lastToolName?: string | null;
  lastToolOutput?: Record<string, unknown>;
  summary?: string;
}): Promise<ProtectedToolResult> {
  assertToolEnabledForAgent(params.agent.enabledTools, params.toolName);
  const actionType = resolveActionType(params.toolName);
  const before = toolStepLabel(params.toolName, "before");

  await params.activity.logRunStep({
    runId: params.runId,
    key: `tool.${params.toolName}.start`,
    label: before.label,
    detail:
      typeof params.toolInput.query === "string"
        ? params.toolInput.query
        : before.detail ?? params.toolName,
  });

  const control = await evaluateToolThroughControlLayer(params.admin, {
    agent: params.agent,
    userId: params.userId,
    organizationId: params.agent.record.organizationId,
    toolName: params.toolName,
    toolInput: params.toolInput,
    actionType,
    runId: params.runId,
    source: "agent_runtime",
  });

  const agentActionId = await params.activity.recordAction({
    runId: params.runId,
    sequence: params.actionSequence,
    toolName: params.toolName,
    actionType,
    summary: control.plainEnglishSummary ?? control.reason,
    status: mapActionStatus(control.decision),
    proposalId: control.proposalId,
    policyDecision: mapControlDecision(control.decision),
  });

  if (control.decision === "REVIEW") {
    const missionGoal = resolveAgentMission(params.agent).goal ?? null;
    const proposal = control.proposalId
      ? await getActionProposalById(params.admin, {
          proposalId: control.proposalId,
          organizationId: params.agent.record.organizationId,
        })
      : null;
    const approvalExpiresAt = proposal
      ? effectiveReviewDeadline(proposal)
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (!params.runId) {
      return {
        kind: "failed",
        result: {
          runId: null,
          status: "failed",
          summary: null,
          error: "Cannot request approval without an active run.",
          proposalId: control.proposalId,
          toolCalls: params.toolCalls,
          turns: params.turns,
          steps: params.activity.getSteps(),
        },
      };
    }

    const passport = await bindApprovalPassport({
      admin: params.admin,
      organizationId: params.agent.record.organizationId,
      builderAgentId: params.agent.record.id,
      gatewayAgentId: params.agent.gatewayAgentId,
      agentRunId: params.runId,
      agentActionId,
      proposalId: control.proposalId!,
      tool: params.toolName,
      action: actionType,
      parameters: params.toolInput,
      missionGoal,
      expiresAt: approvalExpiresAt,
    });

    const pendingApproval: PendingRuntimeApproval = {
      proposalId: control.proposalId!,
      passportId: passport.passportId,
      toolName: params.toolName,
      toolInput: params.toolInput,
      actionType,
      agentActionId,
      turns: params.turns,
      toolCalls: params.toolCalls,
      actionSequence: params.actionSequence,
      messages: params.messages ?? [],
      protectionReason: control.why ?? control.reason,
      riskLevel: (control.riskLevel as PendingRuntimeApproval["riskLevel"]) ?? "medium",
      workflowNodeIndex: params.workflowNodeIndex,
      lastToolName: params.lastToolName ?? null,
      lastToolOutput: params.lastToolOutput ?? {},
      summary: params.summary,
    };

    await params.activity.logRunStep({
      runId: params.runId,
      key: `tool.${params.toolName}.approval`,
      label: "WAITING FOR APPROVAL",
      detail: control.why ?? control.reason,
      status: "needs_approval",
    });

    await params.activity.finishRun({
      runId: params.runId,
      status: "awaiting_approval",
      summary: control.plainEnglishSummary ?? "Waiting for your approval before continuing.",
      errorMessage: control.why ?? control.reason,
      metadata: { task: params.task, pendingApproval },
    });

    return {
      kind: "awaiting_approval",
      result: {
        runId: params.runId,
        status: "awaiting_approval",
        summary:
          control.plainEnglishSummary ??
          "Your agent needs your approval before this action can continue.",
        error: control.why ?? control.reason,
        proposalId: control.proposalId,
        toolCalls: params.toolCalls,
        turns: params.turns,
        steps: params.activity.getSteps(),
        protection: {
          summary: control.plainEnglishSummary ?? control.reason,
          why: control.why ?? control.reason,
          riskLevel: control.riskLevel,
        },
      },
    };
  }

  if (control.decision === "BLOCK") {
    await params.activity.recordToolExecution({
      runId: params.runId,
      agentActionId,
      proposalId: control.proposalId,
      toolName: params.toolName,
      input: params.toolInput,
      executed: false,
      output: { blocked: true },
      error: control.reason,
    });
    return {
      kind: "blocked",
      reason: control.reason,
      toolCalls: params.toolCalls,
    };
  }

  const missionGoal = resolveAgentMission(params.agent).goal ?? null;
  const toolContext = {
    agent: params.agent,
    runId: params.runId,
    userId: params.userId,
    organizationId: params.agent.record.organizationId,
  };

  let outcome = await executeAuthorizedTool({
    admin: params.admin,
    toolName: params.toolName,
    toolInput: params.toolInput,
    actionType,
    context: toolContext,
    safetyDecision: "ALLOW",
    missionGoal,
    agentActionId,
  });

  for (let retry = 0; !outcome.executed && retry < params.maxRetries; retry += 1) {
    outcome = await executeAuthorizedTool({
      admin: params.admin,
      toolName: params.toolName,
      toolInput: params.toolInput,
      actionType,
      context: toolContext,
      safetyDecision: "ALLOW",
      missionGoal,
      agentActionId,
    });
  }

  await params.activity.recordToolExecution({
    runId: params.runId,
    agentActionId,
    proposalId: control.proposalId,
    toolName: params.toolName,
    input: params.toolInput,
    executed: outcome.executed,
    output: outcome.output,
    error: outcome.executed ? null : outcome.error ?? "Tool execution failed.",
  });

  if (!outcome.executed) {
    const error = outcome.error ?? `${params.toolName} failed.`;
    await params.activity.logRunStep({
      runId: params.runId,
      key: `tool.${params.toolName}.failed`,
      label: toolStepLabel(params.toolName, "failed").label,
      detail: error,
      status: "failed",
    });
    await params.activity.finishRun({
      runId: params.runId,
      status: "failed",
      summary: null,
      errorMessage: error,
    });
    return {
      kind: "failed",
      result: {
        runId: params.runId,
        status: "failed",
        summary: null,
        error,
        proposalId: control.proposalId,
        toolCalls: params.toolCalls + 1,
        turns: params.turns,
        steps: params.activity.getSteps(),
      },
    };
  }

  const after = toolStepLabel(params.toolName, "after");
  await params.activity.logRunStep({
    runId: params.runId,
    key: `tool.${params.toolName}.done`,
    label: after.label,
    detail: after.detail ?? null,
  });

  return {
    kind: "executed",
    outcome,
    toolCalls: params.toolCalls + 1,
  };
}
