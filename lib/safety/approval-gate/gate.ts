import type { SupabaseClient } from "@supabase/supabase-js";
import { executeRegisteredTool } from "@/lib/agents/tools/registry";
import type { LoadedAgent, ToolExecutionOutcome, ToolHandlerContext } from "@/lib/agents/runtime/types";
import {
  getActionProposalById,
  markActionProposalExecutedAtomically,
  type ActionProposalRow,
} from "@/lib/gateway/proposals/repository";
import { effectiveReviewDeadline } from "@/lib/gateway/review/timeout";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import { evaluateAction } from "@/lib/safety/gate";
import {
  consumeActionPassport,
  createPendingActionPassport,
  revokeActionPassport,
  verifyActionPassport,
} from "@/lib/safety/passport/service";
import {
  APPROVAL_GATE_DENIED_MESSAGE,
  APPROVAL_GATE_EXPIRED_MESSAGE,
  APPROVAL_GATE_INVALID_MESSAGE,
  APPROVAL_GATE_SAFETY_BLOCKED_MESSAGE,
} from "./constants";

export interface BindApprovalPassportInput {
  admin: SupabaseClient;
  organizationId: string;
  builderAgentId: string;
  gatewayAgentId: string;
  agentRunId: string | null;
  agentActionId?: string | null;
  proposalId: string;
  tool: string;
  action: string;
  parameters: Record<string, unknown>;
  missionGoal?: string | null;
  expiresAt: string;
}

export interface ExecuteApprovedActionParams {
  admin: SupabaseClient;
  proposalId: string;
  passportId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  actionType: string;
  context: ToolHandlerContext;
  missionGoal?: string | null;
  agentActionId?: string | null;
  userEmail?: string;
}

let testProposalLookup:
  | ((
      admin: SupabaseClient,
      params: { proposalId: string; organizationId: string }
    ) => Promise<ActionProposalRow | null>)
  | null = null;

let testToolExecutor:
  | ((
      toolName: string,
      input: Record<string, unknown>,
      context: ToolHandlerContext
    ) => Promise<ToolExecutionOutcome>)
  | null = null;

/** Test hook — inject proposal lookup for approval gate unit tests. */
export function setApprovalGateProposalLookupForTests(
  lookup: typeof testProposalLookup
): void {
  testProposalLookup = lookup;
}

/** Test hook — inject tool execution for approval gate unit tests. */
export function setApprovalGateToolExecutorForTests(
  executor: typeof testToolExecutor
): void {
  testToolExecutor = executor;
}

async function runApprovedTool(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolHandlerContext
): Promise<ToolExecutionOutcome> {
  if (testToolExecutor) {
    return testToolExecutor(toolName, input, context);
  }
  return executeRegisteredTool(toolName, input, context);
}

async function loadProposal(
  admin: SupabaseClient,
  params: { proposalId: string; organizationId: string }
): Promise<ActionProposalRow | null> {
  if (testProposalLookup) {
    return testProposalLookup(admin, params);
  }
  return getActionProposalById(admin, params);
}

function logApprovalGate(
  phase: "bound" | "verified" | "blocked" | "executed",
  params: Record<string, unknown>
): void {
  console.info(`[safety][approval-gate] ${phase}`, params);
}

function blockedOutcome(reason: string): ToolExecutionOutcome {
  return {
    executed: false,
    error: reason,
    output: { blocked: true, reason: "approval_gate" },
  };
}

export async function bindApprovalPassport(
  input: BindApprovalPassportInput
): Promise<{ passportId: string; actionHash: string; expiresAt: string }> {
  const created = await createPendingActionPassport(
    {
      organizationId: input.organizationId,
      builderAgentId: input.builderAgentId,
      gatewayAgentId: input.gatewayAgentId,
      agentRunId: input.agentRunId,
      agentActionId: input.agentActionId ?? null,
      actionProposalId: input.proposalId,
      tool: input.tool,
      action: input.action,
      parameters: input.parameters,
      missionGoal: input.missionGoal ?? null,
      safetyDecision: "REQUIRE_APPROVAL",
      expiresAt: input.expiresAt,
    },
    input.admin
  );

  logApprovalGate("bound", {
    proposalId: input.proposalId,
    passportId: created.passportId,
    builderAgentId: input.builderAgentId,
    agentRunId: input.agentRunId,
    tool: input.tool,
    action: input.action,
    expiresAt: created.expiresAt,
  });

  return created;
}

export async function revokeApprovalPassport(
  admin: SupabaseClient,
  passportId: string
): Promise<void> {
  await revokeActionPassport(passportId, admin);
  logApprovalGate("blocked", { passportId, reason: "revoked_after_denial" });
}

async function verifyHumanApprovalRecord(
  admin: SupabaseClient,
  params: {
    proposalId: string;
    passportId: string;
    organizationId: string;
    builderAgentId: string;
    gatewayAgentId: string;
    agentRunId: string;
    toolName: string;
    actionType: string;
  }
): Promise<{ ok: true; proposal: ActionProposalRow } | { ok: false; reason: string }> {
  const proposal = await loadProposal(admin, {
    proposalId: params.proposalId,
    organizationId: params.organizationId,
  });

  if (!proposal) {
    return { ok: false, reason: APPROVAL_GATE_INVALID_MESSAGE };
  }

  if (proposal.status === "rejected") {
    return { ok: false, reason: APPROVAL_GATE_DENIED_MESSAGE };
  }

  if (proposal.status !== "approved" && proposal.status !== "executed") {
    return { ok: false, reason: APPROVAL_GATE_INVALID_MESSAGE };
  }

  const deadline = effectiveReviewDeadline(proposal);
  const decidedAt = proposal.decided_at ?? proposal.executed_at;
  if (decidedAt && new Date(deadline) <= new Date(decidedAt)) {
    return { ok: false, reason: APPROVAL_GATE_EXPIRED_MESSAGE };
  }

  if (new Date(proposal.expires_at) <= new Date()) {
    return { ok: false, reason: APPROVAL_GATE_EXPIRED_MESSAGE };
  }

  const payload = proposal.action_payload ?? {};
  const runId =
    typeof payload._zeltaRuntimeRunId === "string" ? payload._zeltaRuntimeRunId : null;
  const builderAgentId =
    typeof payload._zeltaBuilderAgentId === "string"
      ? payload._zeltaBuilderAgentId
      : null;

  if (runId !== params.agentRunId) {
    return { ok: false, reason: APPROVAL_GATE_INVALID_MESSAGE };
  }

  if (builderAgentId !== params.builderAgentId) {
    return { ok: false, reason: APPROVAL_GATE_INVALID_MESSAGE };
  }

  if (proposal.agent_id !== params.gatewayAgentId) {
    return { ok: false, reason: APPROVAL_GATE_INVALID_MESSAGE };
  }

  if (proposal.tool_name !== params.toolName.trim()) {
    return { ok: false, reason: APPROVAL_GATE_INVALID_MESSAGE };
  }

  if (proposal.action_type !== params.actionType.trim()) {
    return { ok: false, reason: APPROVAL_GATE_INVALID_MESSAGE };
  }

  if (proposal.id !== params.proposalId) {
    return { ok: false, reason: APPROVAL_GATE_INVALID_MESSAGE };
  }

  return { ok: true, proposal };
}

function revalidateSafety(
  agent: LoadedAgent,
  params: {
    toolName: string;
    actionType: string;
    toolInput: Record<string, unknown>;
    runId: string;
  }
): { allowed: boolean; reason?: string } {
  const safety = evaluateAction({
    agent,
    tool: params.toolName,
    action: params.actionType,
    parameters: {
      ...params.toolInput,
      _zeltaRuntimeRunId: params.runId,
      _zeltaRuntimeSource: "agent_runtime_post_approval",
    },
    context: {
      runId: params.runId,
      source: "agent_runtime_post_approval",
    },
  });

  if (safety.decision === "BLOCK") {
    return { allowed: false, reason: APPROVAL_GATE_SAFETY_BLOCKED_MESSAGE };
  }

  return { allowed: true };
}

/**
 * Executes a human-approved action after verifying the approval record, passport,
 * action hash, and fresh safety evaluation.
 */
export async function executeApprovedAction(
  params: ExecuteApprovedActionParams
): Promise<ToolExecutionOutcome> {
  const approval = await verifyHumanApprovalRecord(params.admin, {
    proposalId: params.proposalId,
    passportId: params.passportId,
    organizationId: params.context.organizationId,
    builderAgentId: params.context.agent.record.id,
    gatewayAgentId: params.context.agent.gatewayAgentId,
    agentRunId: params.context.runId ?? "",
    toolName: params.toolName,
    actionType: params.actionType,
  });

  if (!approval.ok) {
    logApprovalGate("blocked", {
      proposalId: params.proposalId,
      passportId: params.passportId,
      reason: approval.reason,
    });
    return blockedOutcome(approval.reason);
  }

  const safety = revalidateSafety(params.context.agent, {
    toolName: params.toolName,
    actionType: params.actionType,
    toolInput: params.toolInput,
    runId: params.context.runId ?? "",
  });

  if (!safety.allowed) {
    logApprovalGate("blocked", {
      proposalId: params.proposalId,
      passportId: params.passportId,
      reason: "safety_revalidation_failed",
    });
    return blockedOutcome(safety.reason ?? APPROVAL_GATE_SAFETY_BLOCKED_MESSAGE);
  }

  const verifyInput = {
    passportId: params.passportId,
    organizationId: params.context.organizationId,
    builderAgentId: params.context.agent.record.id,
    gatewayAgentId: params.context.agent.gatewayAgentId,
    agentRunId: params.context.runId,
    missionGoal: params.missionGoal ?? null,
    safetyDecision: "REQUIRE_APPROVAL" as const,
    tool: params.toolName,
    action: params.actionType,
    parameters: params.toolInput,
  };

  const passport = await verifyActionPassport(verifyInput, params.admin);
  if (!passport.valid || !passport.passport) {
    logApprovalGate("blocked", {
      proposalId: params.proposalId,
      passportId: params.passportId,
      reason: passport.reason,
    });
    return blockedOutcome(passport.reason);
  }

  if (passport.passport.actionProposalId !== params.proposalId) {
    logApprovalGate("blocked", {
      proposalId: params.proposalId,
      passportId: params.passportId,
      reason: "proposal_passport_mismatch",
    });
    return blockedOutcome(APPROVAL_GATE_INVALID_MESSAGE);
  }

  const consumed = await consumeActionPassport(
    {
      ...verifyInput,
      allowedStatuses: ["active", "pending_approval"],
    },
    params.admin
  );

  if (!consumed.valid) {
    logApprovalGate("blocked", {
      proposalId: params.proposalId,
      passportId: params.passportId,
      reason: consumed.reason,
    });
    return blockedOutcome(consumed.reason);
  }

  logApprovalGate("verified", {
    proposalId: params.proposalId,
    passportId: params.passportId,
    builderAgentId: params.context.agent.record.id,
    agentRunId: params.context.runId,
    tool: params.toolName,
  });

  const outcome = await runApprovedTool(
    params.toolName,
    params.toolInput,
    params.context
  );

  if (outcome.executed) {
    try {
      await markActionProposalExecutedAtomically(params.admin, {
        proposalId: params.proposalId,
        organizationId: params.context.organizationId,
        actionHash: approval.proposal.action_hash,
        executedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[safety][approval-gate] failed to mark proposal executed", {
        proposalId: params.proposalId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  recordRuntimeAuditEventAsync(params.admin, {
    organizationId: params.context.organizationId,
    proposalId: params.proposalId,
    event: outcome.executed ? "token.consumed" : "policy.block",
    agentId: params.context.agent.gatewayAgentId,
    metadata: {
      passportId: params.passportId,
      builderAgentId: params.context.agent.record.id,
      agentRunId: params.context.runId,
      toolName: params.toolName,
      actionType: params.actionType,
      reviewerEmail: params.userEmail ?? null,
      executed: outcome.executed,
      error: outcome.executed ? null : outcome.error,
      approvalStatus: "approved",
    },
  });

  if (outcome.executed) {
    logApprovalGate("executed", {
      proposalId: params.proposalId,
      passportId: params.passportId,
      tool: params.toolName,
    });
  }

  return outcome;
}
