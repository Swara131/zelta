import type { SupabaseClient } from "@supabase/supabase-js";
import { ExecutionTokenError } from "@/lib/gateway/errors";
import type { AgentAuthContext } from "@/lib/gateway/types";
import {
  recordRuntimeAuditEventAsync,
  type RuntimeAuditEventName,
} from "@/lib/gateway/audit/runtime-events";
import { computeActionHash } from "@/lib/gateway/proposals/canonicalize";
import type { ActionProposalRow } from "@/lib/gateway/proposals/repository";
import {
  markActionProposalExecutedAtomically,
  revertActionProposalExecutionAtomically,
} from "@/lib/gateway/proposals/repository";
import { assertAgentMatchesAuth } from "@/lib/gateway/proposals/service";
import {
  applyReviewTimeoutIfExpired,
  effectiveReviewDeadline,
} from "@/lib/gateway/review/timeout";
import { EXECUTION_TOKEN_TTL_SECONDS } from "./constants";
import {
  generateExecutionTokenMaterial,
  hashExecutionToken,
  isPlausibleExecutionToken,
  verifyExecutionToken,
} from "./crypto";
import {
  consumeExecutionTokenAtomically,
  getActiveExecutionTokenForProposal,
  getExecutionTokenByHash,
  getProposalForAgentExecution,
  insertExecutionToken,
  revokeActiveTokensForProposal,
} from "./repository";
import type { GatewayProposalStatus } from "@/lib/gateway/proposals/types";
import type {
  ExternalProposalStatus,
  ProposalStatusResponse,
  VerifyExecutionInput,
  VerifyExecutionResult,
} from "./types";

export interface ExecutionTokenDeps {
  getProposal: typeof getProposalForAgentExecution;
  getActiveToken: typeof getActiveExecutionTokenForProposal;
  insertToken: typeof insertExecutionToken;
  getTokenByHash: typeof getExecutionTokenByHash;
  consumeToken: typeof consumeExecutionTokenAtomically;
  markExecuted: typeof markActionProposalExecutedAtomically;
  revertExecuted: typeof revertActionProposalExecutionAtomically;
  revokeActiveTokens: typeof revokeActiveTokensForProposal;
  generateToken: typeof generateExecutionTokenMaterial;
  hashToken: typeof hashExecutionToken;
  verifyToken: typeof verifyExecutionToken;
  computeHash: typeof computeActionHash;
  applyReviewTimeout: typeof applyReviewTimeoutIfExpired;
}

const defaultDeps: ExecutionTokenDeps = {
  getProposal: getProposalForAgentExecution,
  getActiveToken: getActiveExecutionTokenForProposal,
  insertToken: insertExecutionToken,
  getTokenByHash: getExecutionTokenByHash,
  consumeToken: consumeExecutionTokenAtomically,
  markExecuted: markActionProposalExecutedAtomically,
  revertExecuted: revertActionProposalExecutionAtomically,
  revokeActiveTokens: revokeActiveTokensForProposal,
  generateToken: generateExecutionTokenMaterial,
  hashToken: hashExecutionToken,
  verifyToken: verifyExecutionToken,
  computeHash: computeActionHash,
  applyReviewTimeout: applyReviewTimeoutIfExpired,
};

function computeTokenExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + EXECUTION_TOKEN_TTL_SECONDS * 1000).toISOString();
}

function recordRuntimeEvent(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    proposalId: string;
    event: RuntimeAuditEventName;
    agentId?: string | null;
    metadata?: Record<string, unknown>;
  }
): void {
  recordRuntimeAuditEventAsync(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: params.event,
    agentId: params.agentId ?? null,
    metadata: params.metadata,
  });
}

function denyExecution(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    proposalId: string;
    agentId: string;
    reason: string;
    code: ExecutionTokenError["code"];
    toolName?: string;
    actionType?: string;
  }
): never {
  recordRuntimeEvent(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: "execution.denied",
    agentId: params.agentId,
    metadata: {
      reason: params.reason,
      code: params.code,
      toolName: params.toolName,
      actionType: params.actionType,
    },
  });
  throw new ExecutionTokenError(params.reason, params.code);
}

export function resolveExternalProposalStatus(
  row: ActionProposalRow,
  now = new Date()
): ExternalProposalStatus {
  if (row.status === "executed" || row.executed_at) {
    return "executed";
  }

  if (row.status === "rejected") {
    return "rejected";
  }

  if (row.status === "blocked") {
    return "blocked";
  }

  if (row.status === "expired") {
    return "expired";
  }

  if (
    row.status === "review_required" &&
    new Date(effectiveReviewDeadline(row)) <= now
  ) {
    return "pending";
  }

  if (new Date(row.expires_at) <= now) {
    return "expired";
  }

  if (row.status === "approved" || row.status === "allowed") {
    return "approved";
  }

  return "pending";
}

function isExecutionEligible(row: ActionProposalRow, now = new Date()): boolean {
  return resolveExternalProposalStatus(row, now) === "approved";
}

function isExecutableProposalStatus(
  status: GatewayProposalStatus
): status is Extract<GatewayProposalStatus, "approved" | "allowed"> {
  return status === "approved" || status === "allowed";
}

export async function getProposalExecutionStatus(
  supabase: SupabaseClient,
  auth: AgentAuthContext,
  proposalId: string,
  deps: ExecutionTokenDeps = defaultDeps
): Promise<ProposalStatusResponse> {
  const proposal = await deps.getProposal(supabase, {
    proposalId,
    organizationId: auth.organizationId,
    agentId: auth.agentId,
  });

  if (!proposal) {
    throw new ExecutionTokenError("Action proposal not found.", "not_found");
  }

  const timeoutResult = await deps.applyReviewTimeout(supabase, proposal);
  const currentProposal = timeoutResult.row;

  const status = resolveExternalProposalStatus(currentProposal);
  const response: ProposalStatusResponse = {
    proposalId: currentProposal.id,
    status,
    actionHash: currentProposal.action_hash,
  };

  if (status === "expired") {
    recordRuntimeEvent(supabase, {
      organizationId: auth.organizationId,
      proposalId: currentProposal.id,
      event: "proposal.expired",
      agentId: auth.agentId,
      metadata: {
        toolName: currentProposal.tool_name,
        actionType: currentProposal.action_type,
        expiresAt: currentProposal.expires_at,
      },
    });
    return response;
  }

  if (currentProposal.status === "rejected" && timeoutResult.outcome === "auto_denied") {
    return {
      ...response,
      status: "rejected",
    };
  }

  if (!isExecutionEligible(currentProposal)) {
    return response;
  }

  const existing = await deps.getActiveToken(supabase, {
    proposalId: currentProposal.id,
    organizationId: auth.organizationId,
  });

  if (existing) {
    return {
      ...response,
      executionTokenIssued: true,
      executionTokenExpiresAt: existing.expires_at,
    };
  }

  const material = deps.generateToken();
  const expiresAt = computeTokenExpiresAt();

  await deps.insertToken(supabase, {
    organizationId: auth.organizationId,
    actionProposalId: currentProposal.id,
    tokenHash: material.tokenHash,
    tokenPrefix: material.tokenPrefix,
    expiresAt,
  });

  recordRuntimeEvent(supabase, {
    organizationId: auth.organizationId,
    proposalId: currentProposal.id,
    event: "token.issued",
    agentId: auth.agentId,
    metadata: {
      actionHash: currentProposal.action_hash,
      tokenPrefix: material.tokenPrefix,
      expiresAt,
    },
  });

  return {
    ...response,
    executionToken: material.plainToken,
    executionTokenExpiresAt: expiresAt,
    executionTokenIssued: true,
  };
}

export async function verifyProposalExecution(
  supabase: SupabaseClient,
  auth: AgentAuthContext,
  proposalId: string,
  input: VerifyExecutionInput,
  deps: ExecutionTokenDeps = defaultDeps
): Promise<VerifyExecutionResult> {
  if (!isPlausibleExecutionToken(input.executionToken)) {
    throw new ExecutionTokenError("Invalid execution token.", "token_mismatch");
  }

  const proposal = await deps.getProposal(supabase, {
    proposalId,
    organizationId: auth.organizationId,
    agentId: auth.agentId,
  });

  if (!proposal) {
    throw new ExecutionTokenError("Action proposal not found.", "not_found");
  }

  assertAgentMatchesAuth(auth, proposal.agent_id);

  const timeoutResult = await deps.applyReviewTimeout(supabase, proposal);
  const currentProposal = timeoutResult.row;

  const baseDeny = {
    organizationId: auth.organizationId,
    proposalId: currentProposal.id,
    agentId: auth.agentId,
    toolName: input.toolName,
    actionType: input.actionType,
  };

  if (resolveExternalProposalStatus(currentProposal) !== "approved") {
    denyExecution(supabase, {
      ...baseDeny,
      reason:
        currentProposal.status === "executed" || currentProposal.executed_at
          ? "Proposal has already been executed."
          : currentProposal.status === "rejected"
            ? "Proposal was rejected and cannot be executed."
            : "Proposal is not approved for execution.",
      code: "not_eligible",
    });
  }

  if (!isExecutableProposalStatus(currentProposal.status)) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Proposal is not approved for execution.",
      code: "not_eligible",
    });
  }

  const priorStatus = currentProposal.status;

  if (currentProposal.tool_name.trim() !== input.toolName.trim()) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "toolName does not match the approved action.",
      code: "tool_mismatch",
    });
  }

  if (currentProposal.action_type.trim() !== input.actionType.trim()) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "actionType does not match the approved action.",
      code: "action_type_mismatch",
    });
  }

  const recomputedHash = deps.computeHash({
    organizationId: auth.organizationId,
    agentId: currentProposal.agent_id,
    toolName: input.toolName,
    actionType: input.actionType,
    payload: input.payload,
  });

  if (recomputedHash !== currentProposal.action_hash) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Payload does not match the approved action hash.",
      code: "payload_mismatch",
    });
  }

  const tokenHash = deps.hashToken(input.executionToken);
  const stored = await deps.getTokenByHash(supabase, tokenHash);

  if (!stored) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token not found.",
      code: "token_mismatch",
    });
  }

  if (stored.organization_id !== auth.organizationId) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token organization mismatch.",
      code: "organization_mismatch",
    });
  }

  if (stored.action_proposal_id !== proposalId) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token does not match this proposal.",
      code: "proposal_mismatch",
    });
  }

  if (!deps.verifyToken(input.executionToken, stored.token_hash)) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token verification failed.",
      code: "token_mismatch",
    });
  }

  const now = new Date();

  if (stored.status === "used") {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token has already been used.",
      code: "replayed",
    });
  }

  if (stored.status !== "active") {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token is not active.",
      code: "not_eligible",
    });
  }

  if (new Date(stored.expires_at) <= now) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token has expired.",
      code: "expired",
    });
  }

  recordRuntimeEvent(supabase, {
    organizationId: auth.organizationId,
    proposalId: currentProposal.id,
    event: "token.verified",
    agentId: auth.agentId,
    metadata: {
      actionHash: currentProposal.action_hash,
      tokenPrefix: stored.token_prefix,
      toolName: input.toolName,
      actionType: input.actionType,
    },
  });

  const consumedAt = now.toISOString();

  const executedRow = await deps.markExecuted(supabase, {
    proposalId: currentProposal.id,
    organizationId: auth.organizationId,
    actionHash: currentProposal.action_hash,
    executedAt: consumedAt,
  });

  if (!executedRow) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Proposal has already been executed.",
      code: "not_eligible",
    });
  }

  const consumed = await deps.consumeToken(supabase, {
    tokenHash: stored.token_hash,
    proposalId,
    organizationId: auth.organizationId,
    consumedAt,
  });

  if (!consumed) {
    await deps.revertExecuted(supabase, {
      proposalId: currentProposal.id,
      organizationId: auth.organizationId,
      actionHash: currentProposal.action_hash,
      priorStatus,
      executedAt: consumedAt,
    });
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token was already consumed or expired.",
      code: "concurrent_use",
    });
  }

  await deps.revokeActiveTokens(supabase, {
    proposalId: currentProposal.id,
    organizationId: auth.organizationId,
    revokedAt: consumedAt,
  });

  recordRuntimeEvent(supabase, {
    organizationId: auth.organizationId,
    proposalId: currentProposal.id,
    event: "token.consumed",
    agentId: auth.agentId,
    metadata: {
      actionHash: currentProposal.action_hash,
      tokenPrefix: stored.token_prefix,
      consumedAt,
    },
  });

  return {
    allowed: true,
    proposalId: currentProposal.id,
    actionHash: currentProposal.action_hash,
    consumedAt,
  };
}

export function executionTokenErrorStatus(
  code: ExecutionTokenError["code"]
): number {
  switch (code) {
    case "not_found":
      return 404;
    case "not_eligible":
    case "expired":
    case "replayed":
    case "token_mismatch":
    case "payload_mismatch":
    case "tool_mismatch":
    case "action_type_mismatch":
    case "organization_mismatch":
    case "proposal_mismatch":
    case "concurrent_use":
      return 403;
    default:
      return 400;
  }
}
